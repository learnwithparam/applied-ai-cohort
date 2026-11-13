import {
  devTasks,
  postRun,
  type ServedRun,
  startService,
  writesFor,
} from "../parts/07-ship-it/agent-checks";
import type { Rule } from "../scripts/verify";
import { TOKEN } from "./serve-the-contract";

// A limit of about three runs, so the fourth or fifth run is over budget.
const SPEND_LIMIT_USD = "0.0003";
const PAID_CALLS = 8;

type Probe = { answer: ServedRun; writes: number };
type LockSession = { noToken: Probe; wrongToken: Probe; paid: Probe[] };

async function probe(
  service: Awaited<ReturnType<typeof startService>>,
  index: number,
  token?: string,
) {
  const task = devTasks()[index];
  const answer = await postRun(service, task, token);
  return { answer, writes: await writesFor(service, task.email_id) };
}

async function oneSession(folder: string): Promise<LockSession> {
  const service = await startService(folder, {
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    PROJECT_API_TOKEN: TOKEN,
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    SPEND_LIMIT_USD,
  });
  try {
    const noToken = await probe(service, 0);
    const wrongToken = await probe(service, 1, "not-the-token");
    const paid: Probe[] = [];
    for (let index = 2; index < 2 + PAID_CALLS; index++) {
      paid.push(await probe(service, index, TOKEN));
    }
    return { noToken, wrongToken, paid };
  } finally {
    service.stop();
  }
}

const saved = new Map<string, Promise<LockSession[]>>();

export function lockSessions(folder: string): Promise<LockSession[]> {
  let found = saved.get(folder);
  if (!found) {
    found = (async () => {
      const all: LockSession[] = [];
      for (let attempt = 0; attempt < 3; attempt++) all.push(await oneSession(folder));
      return all;
    })();
    saved.set(folder, found);
  }
  return found;
}

async function everySession(folder: string, passes: (session: LockSession) => boolean) {
  const all = await lockSessions(folder);
  return all.every(passes);
}

const refusedUntouched = (found: Probe, status: number) =>
  found.answer.status === status && found.writes === 0;

function refusedForBudget(found: Probe): boolean {
  const reason = found.answer.body.toLowerCase();
  return refusedUntouched(found, 429) && /budget|limit/.test(reason);
}

export default [
  {
    says: "a call with no token gets 401, and the world is not touched",
    test: (folder) => everySession(folder, (session) => refusedUntouched(session.noToken, 401)),
    tryNext: "check the Authorization header before anything else, and answer 401 when it is wrong",
  },
  {
    says: "a call with the wrong token gets 401, and the world is not touched",
    test: (folder) => everySession(folder, (session) => refusedUntouched(session.wrongToken, 401)),
    tryNext: "compare the whole header with Bearer and PROJECT_API_TOKEN, never only its start",
  },
  {
    says: "calls with the right token run until the spending limit",
    test: (folder) => everySession(folder, (session) => session.paid[0].answer.status === 200),
    tryNext: "keep the stream working for a signed-in client; rerun serve-the-contract",
  },
  {
    says: "once the runs pass SPEND_LIMIT_USD, a call gets 429 with a reason, and nothing runs",
    test: (folder) => everySession(folder, (session) => session.paid.some(refusedForBudget)),
    tryNext: "add up each run's cost_usd, and refuse with 429 once the total reaches the limit",
  },
] satisfies Rule[];
