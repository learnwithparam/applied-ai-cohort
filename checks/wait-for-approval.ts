// Starts the learner's chain on a fresh world, waits until it asks the agronomist, then answers
// as the agronomist and reads what the application system holds. With crash, the check kills
// the chain during the wait and starts it again before it answers.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { verbs, worldEnv } from "./lib/contract";
import { PYTHON, python, REPLAY_ENV, type Score, score, startWorld, type World } from "./lib/world";
import { agronomistEmails, PART_FOUR_KIT, type Row, type Split } from "./route-the-inbox";

export type ApprovalRun = {
  requestsWhileWaiting: number;
  runningWhileWaiting: boolean;
  bookedWhileWaiting: number;
  exitCode: number;
  approvals: Row[];
  jobs: Row[];
  bookings: Row[];
  reviews: Row[];
  score: Score;
};

const REFUSAL = "Too close to the label limit after rain";

async function readTable(file: string, query: string): Promise<Row[]> {
  if (!existsSync(file)) return [];
  const { Database } = await import("bun:sqlite");
  const database = new Database(file, { readonly: true });
  try {
    return database.query(query).all() as Row[];
  } catch {
    // The table does not exist yet.
    return [];
  } finally {
    database.close();
  }
}

function startChain(folder: string, env: Record<string, string>) {
  const command = verbs(folder).chain ?? "exit 2";
  const local = command.replace(/^uv run (python3?|python)\b/, PYTHON);
  // exec makes the learner's process take the shell's place, so a kill reaches it.
  return Bun.spawn(["sh", "-c", `exec ${local}`], {
    cwd: folder,
    env,
    stdout: "ignore",
    stderr: "ignore",
  });
}

type Chain = ReturnType<typeof startChain>;

const approvalsFile = (world: World) => join(world.runsDir, "approvals.db");
const waitingRequests = (world: World) =>
  readTable(approvalsFile(world), "select * from approvals where status = 'waiting'");

// Waits until the chain has asked for every approval, or has stopped, or 20 seconds pass.
async function untilWaiting(chain: Chain, world: World, expected: number): Promise<number> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const waiting = (await waitingRequests(world)).length;
    if (waiting >= expected || chain.exitCode !== null) {
      await Bun.sleep(300);
      return (await waitingRequests(world)).length;
    }
    await Bun.sleep(100);
  }
  return (await waitingRequests(world)).length;
}

// Answers as the agronomist: no to the first request, yes to every other one.
async function answerAsAgronomist(world: World, env: Record<string, string>) {
  const tool = join(PART_FOUR_KIT, "approvals.py");
  const waiting = await waitingRequests(world);
  waiting.forEach((request, position) => {
    const answer =
      position === 0
        ? ["refuse", String(request.approval_id), REFUSAL]
        : ["approve", String(request.approval_id)];
    python([tool, ...answer], env);
  });
}

async function exitWithin(chain: Chain, seconds: number): Promise<number> {
  const timer = setTimeout(() => chain.kill(9), seconds * 1000);
  const code = await chain.exited;
  clearTimeout(timer);
  return code;
}

async function readOutcome(world: World, split: Split) {
  const bookings = await readTable(world.db, "select * from audit_log where action = 'book_job'");
  return {
    approvals: await readTable(approvalsFile(world), "select * from approvals"),
    jobs: await readTable(world.db, "select * from jobs"),
    bookings: bookings.map((entry) => JSON.parse(String(entry.detail))),
    reviews: await readTable(world.db, "select * from review_queue"),
    score: score(world, split),
  };
}

async function runWithApprovals(
  folder: string,
  split: Split,
  crash: boolean,
): Promise<ApprovalRun> {
  const world = await startWorld(split);
  try {
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    const timing = { POLL_SECONDS: "0.1", APPROVAL_TIMEOUT_SECONDS: "15" };
    const env = { ...process.env, ...REPLAY_ENV, ...worldEnv(world), ...timing } as Record<
      string,
      string
    >;
    const expected = agronomistEmails(split);
    let chain = startChain(folder, env);
    const requestsWhileWaiting = await untilWaiting(chain, world, expected.length);
    const runningWhileWaiting = chain.exitCode === null;
    const jobsSoFar = await readTable(world.db, "select * from jobs");
    const bookedWhileWaiting = jobsSoFar.filter((job) =>
      expected.includes(String(job.email_id)),
    ).length;
    if (crash) {
      chain.kill(9);
      await chain.exited;
    }
    await answerAsAgronomist(world, env);
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    if (crash) chain = startChain(folder, { ...env, APPROVAL_TIMEOUT_SECONDS: "6" });
    const exitCode = await exitWithin(chain, 30);
    const outcome = await readOutcome(world, split);
    return { requestsWhileWaiting, runningWhileWaiting, bookedWhileWaiting, exitCode, ...outcome };
  } finally {
    world.stop();
  }
}

const savedRuns = new Map<string, Promise<ApprovalRun>>();

export function approvalRun(folder: string, split: Split, crash: boolean): Promise<ApprovalRun> {
  const key = `${folder}|${split}|${crash}`;
  let saved = savedRuns.get(key);
  if (!saved) {
    saved = runWithApprovals(folder, split, crash);
    savedRuns.set(key, saved);
  }
  return saved;
}

// Every approved request: its email has exactly one job, booked with that approval id.
export function approvedBookedOnceWithId(run: ApprovalRun): boolean {
  const approved = run.approvals.filter((request) => request.status === "approved");
  return (
    approved.length > 0 &&
    approved.every((request) => {
      const jobs = run.jobs.filter((job) => job.email_id === request.email_id);
      const booking = run.bookings.find((detail) => detail.email_id === request.email_id);
      return jobs.length === 1 && booking?.approval_id === request.approval_id;
    })
  );
}

export function refusedGoesToReview(run: ApprovalRun): boolean {
  const refused = run.approvals.filter((request) => request.status === "refused");
  return (
    refused.length > 0 &&
    refused.every((request) => {
      const booked = run.jobs.some((job) => job.email_id === request.email_id);
      const review = run.reviews.find((item) => item.email_id === request.email_id);
      return !booked && String(review?.reason ?? "").includes(REFUSAL);
    })
  );
}

export function handledOnceAndRight(run: ApprovalRun): boolean {
  const handled = run.score.lost === 0 && run.score.handledTwice === 0;
  return run.exitCode === 0 && handled && run.score.bookedWrong === 0;
}

export default [
  {
    says:
      "the chain asks for one approval per agronomist " +
      "email, keeps waiting, and books none of them",
    test: async (folder) => {
      const run = await approvalRun(folder, "dev", false);
      const expected = agronomistEmails("dev").length;
      return (
        run.requestsWhileWaiting === expected &&
        run.runningWhileWaiting &&
        run.bookedWhileWaiting === 0
      );
    },
    tryNext:
      "call approvals.request_approval for each agronomist email, then poll approvals.decision",
  },
  {
    says: "after the agronomist says yes, each approved email is booked once, with its approval id",
    test: async (folder) => approvedBookedOnceWithId(await approvalRun(folder, "dev", false)),
    tryNext: 'add "approval_id" to the job you post to /api/jobs after a yes',
  },
  {
    says:
      "after the agronomist says no, the email is not " +
      "booked and waits for a person with the reason",
    test: async (folder) => refusedGoesToReview(await approvalRun(folder, "dev", false)),
    tryNext: "send a refused request to /api/review, with the agronomist's reason in it",
  },
  {
    says: "the chain exits 0, every email is handled once, and zero jobs are booked wrong",
    test: async (folder) => handledOnceAndRight(await approvalRun(folder, "dev", false)),
    tryNext: "keep waiting until every request has an answer, then exit",
  },
] satisfies Rule[];
