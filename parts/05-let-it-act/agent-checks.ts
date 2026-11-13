// Helpers the let-it-act checks share: talk to the learner's MCP server, run their agent on
// many tasks against a fresh world, play the person at the approval desk, and read what the
// world holds afterwards. Nothing here reads what the agent says about its own work.
import { Database } from "bun:sqlite";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { verbs, worldEnv } from "../../checks/lib/contract";
import {
  devEmails,
  type InboxEmail,
  PYTHON,
  REPLAY_ENV,
  type Run,
  readJsonLines,
  type Score,
  score,
  startWorld,
  WORLD_DIR,
  type World,
} from "../../checks/lib/world";

type Split = "dev" | "test";
type Json = Record<string, unknown>;

// "uv run python x.py" runs on the course's own Python, so a check never waits on uv.
const localCommand = (command: string) => command.replace(/^uv run (python3?|python)\b/, PYTHON);

// Runs one verb without blocking, so the approval desk in this process can answer meanwhile.
export async function runVerbAsync(
  folder: string,
  verb: string,
  stdin: unknown,
  env: Record<string, string>,
): Promise<Run> {
  const command = verbs(folder)[verb];
  if (!command) return { code: 2, stdout: "", stderr: `contract.toml has no ${verb} verb` };
  const child = Bun.spawn(["sh", "-c", localCommand(command)], {
    cwd: folder,
    env: { ...process.env, ...REPLAY_ENV, ...env },
    stdin: new Blob([stdin === undefined ? "" : JSON.stringify(stdin)]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(() => child.kill(), 60_000);
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  const code = await child.exited;
  clearTimeout(timer);
  return { code, stdout, stderr };
}

export function parseJson(printed: string | undefined): Json | undefined {
  try {
    const lines = (printed ?? "").trim().split("\n");
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    // The verb printed something that is not JSON.
    return undefined;
  }
}

// ---------- MCP ----------

export type ToolAnswer = { text: string; isError: boolean };
export type McpSession = { tools: Json[]; answers: (ToolAnswer | undefined)[]; alive: boolean };

function request(id: number, method: string, params: Json): string {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params });
}

function mcpLines(calls: { name: string; arguments: Json }[]): string {
  const lines = [
    request(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {} }),
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    request(2, "tools/list", {}),
  ];
  calls.forEach((call, index) => {
    lines.push(request(10 + index, "tools/call", call));
  });
  // A last tools/list proves the server is still alive after every call.
  lines.push(request(99, "tools/list", {}));
  return `${lines.join("\n")}\n`;
}

function responsesById(stdout: string): Map<number, Json> {
  const found = new Map<number, Json>();
  for (const line of stdout.split("\n")) {
    try {
      const message = JSON.parse(line);
      if (typeof message.id === "number") found.set(message.id, message);
    } catch {
      // A line that is not JSON-RPC, such as a stray print, is skipped.
    }
  }
  return found;
}

function toolAnswer(response: Json | undefined): ToolAnswer | undefined {
  const result = response?.result as Json | undefined;
  if (!result) return undefined;
  const content = (result.content as { text?: string }[] | undefined) ?? [];
  const text = content.map((part) => part.text ?? "").join("\n");
  return { text, isError: result.isError === true };
}

// Starts the learner's tools verb as an MCP server, lists the tools and calls each one given.
export function mcpSession(
  folder: string,
  world: World,
  calls: { name: string; arguments: Json }[],
) {
  const command = verbs(folder).tools;
  if (!command) return { tools: [], answers: [], alive: false };
  const result = spawnSync("sh", ["-c", localCommand(command)], {
    cwd: folder,
    input: mcpLines(calls),
    env: { ...process.env, ...REPLAY_ENV, ...worldEnv(world) },
    encoding: "utf8",
    timeout: 30_000,
  });
  const responses = responsesById(result.stdout ?? "");
  const listed = responses.get(2)?.result as { tools?: Json[] } | undefined;
  const answers = calls.map((_, index) => toolAnswer(responses.get(10 + index)));
  return { tools: listed?.tools ?? [], answers, alive: responses.has(99) };
}

// ---------- The approval desk ----------

export type ApprovalDesk = { url: string; issued: Json[]; stop: () => void };

// Plays the person at the approval desk: says yes to every request and writes down each id.
export function startApprovalDesk(): ApprovalDesk {
  const issued: Json[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (incoming) => {
      const job = (await incoming.json()) as Json;
      const approvalId = `APR-${1000 + issued.length}`;
      // biome-ignore lint/style/useNamingConvention: the learner's Python reads snake_case.
      issued.push({ ...job, approval_id: approvalId });
      // biome-ignore lint/style/useNamingConvention: the learner's Python reads snake_case.
      return Response.json({ approval_id: approvalId, approved: true });
    },
  });
  return { url: `http://127.0.0.1:${server.port}`, issued, stop: () => server.stop(true) };
}

// ---------- Running the agent ----------

export type Task = {
  // biome-ignore lint/style/useNamingConvention: the learner's files use snake_case keys.
  email_id: string;
  text: string;
};

export type AgentRun = {
  acts: { task: Task; run: Run; printed: Json | undefined }[];
  score: Score;
  jobs: Json[];
  reviews: Json[];
  audit: Json[];
  calls: Json[];
  trace: Json[];
  issued: Json[];
  extra?: Run;
};

export type Scenario = {
  split: Split;
  tasks: Task[];
  withDesk: boolean;
  after?: string;
  runsDirOverride?: (runsDir: string) => void;
};

export function testEmails(): InboxEmail[] {
  const hashes = readJsonLines(join(WORLD_DIR, "truth", "test.hashes.jsonl"));
  return hashes.map((row) => {
    const emailId = String(row.email_id);
    const text = readFileSync(join(WORLD_DIR, "inbox", "test", `${emailId}.txt`), "utf8");
    // biome-ignore lint/style/useNamingConvention: the learner's Python reads "email_id".
    return { email_id: emailId, text };
  });
}

export const devTasks = (): Task[] => devEmails();

// A task built from an inbox email with lines added at the end, the way a planted task is.
export function plantedTask(emailId: string, addedLines: string): Task {
  const email = [...devEmails(), ...testEmails()].find((item) => item.email_id === emailId);
  if (!email) throw new Error(`no inbox email ${emailId}`);
  // biome-ignore lint/style/useNamingConvention: the learner's Python reads "email_id".
  return { email_id: emailId, text: `${email.text.trimEnd()}\n\n${addedLines}\n` };
}

function readAudit(world: World): Json[] {
  const database = new Database(world.db, { readonly: true });
  const rows = database.query("select action, detail from audit_log order by entry_id").all();
  database.close();
  return (rows as { action: string; detail: string }[]).map((row) => ({
    action: row.action,
    ...JSON.parse(row.detail),
  }));
}

async function readWorld(world: World, split: Split) {
  const jobs = (await (await fetch(`${world.url}/api/jobs`)).json()) as Json[];
  const reviews = (await (await fetch(`${world.url}/api/review`)).json()) as Json[];
  const tracePath = join(world.runsDir, "trace.jsonl");
  const trace = existsSync(tracePath) ? readJsonLines(tracePath) : [];
  const callsPath = join(world.runsDir, "calls.jsonl");
  const calls = existsSync(callsPath) ? readJsonLines(callsPath) : [];
  return { score: score(world, split), jobs, reviews, audit: readAudit(world), trace, calls };
}

// Runs the act verb on every task, four at a time, against one world.
async function actOnAll(folder: string, tasks: Task[], env: Record<string, string>) {
  const acts: AgentRun["acts"] = [];
  const waiting = [...tasks];
  const worker = async () => {
    for (let task = waiting.shift(); task; task = waiting.shift()) {
      const run = await runVerbAsync(folder, "act", task, env);
      acts.push({ task, run, printed: parseJson(run.stdout) });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return acts;
}

async function oneAgentRun(folder: string, scenario: Scenario): Promise<AgentRun> {
  const world = await startWorld(scenario.split);
  const desk = scenario.withDesk ? startApprovalDesk() : undefined;
  const env: Record<string, string> = { ...worldEnv(world) };
  if (desk) env.APPROVALS_URL = desk.url;
  try {
    const acts = await actOnAll(folder, scenario.tasks, env);
    scenario.runsDirOverride?.(world.runsDir);
    let extra: Run | undefined;
    if (scenario.after) extra = await runVerbAsync(folder, scenario.after, undefined, env);
    const state = await readWorld(world, scenario.split);
    return { acts, ...state, issued: desk?.issued ?? [], extra };
  } finally {
    desk?.stop();
    world.stop();
  }
}

const savedRuns = new Map<string, Promise<AgentRun[]>>();

// Three fresh runs of a scenario, kept per folder and name so every rule reads the same runs.
export function agentRuns(folder: string, name: string, scenario: Scenario): Promise<AgentRun[]> {
  const key = `${folder}|${name}`;
  let runs = savedRuns.get(key);
  if (!runs) {
    runs = (async () => {
      const found: AgentRun[] = [];
      for (let attempt = 0; attempt < 3; attempt++) found.push(await oneAgentRun(folder, scenario));
      return found;
    })();
    savedRuns.set(key, runs);
  }
  return runs;
}

export async function everyRun(runs: Promise<AgentRun[]>, passes: (run: AgentRun) => boolean) {
  return (await runs).every(passes);
}

// ---------- Reading the end state ----------

// Two rates closer than 0.005 L/ha are the same rate, as in worlds/score.py.
const RATE_TOLERANCE = 0.005;

type DeskRecord = Json & {
  // biome-ignore lint/style/useNamingConvention: the learner's files use snake_case keys.
  email_id: string;
  outcome: string;
};

export function deskRecords(): DeskRecord[] {
  return readJsonLines(join(WORLD_DIR, "truth", "dev.jsonl")) as DeskRecord[];
}

function sameJob(job: Json, record: Json): boolean {
  const ids = ["grower_id", "field_id", "product_code"];
  const sameIds = ids.every((key) => job[key] === record[key]);
  const rateGap = Math.abs(Number(job.rate_l_per_ha) - Number(record.rate_l_per_ha));
  return sameIds && rateGap < RATE_TOLERANCE;
}

// True when the system holds exactly what the desk did with this email.
export function matchesDesk(record: DeskRecord, run: AgentRun): boolean {
  const emailJobs = run.jobs.filter((job) => job.email_id === record.email_id);
  const emailReviews = run.reviews.filter((item) => item.email_id === record.email_id);
  if (record.outcome === "booked") {
    return emailJobs.length === 1 && emailReviews.length === 0 && sameJob(emailJobs[0], record);
  }
  return emailJobs.length === 0 && emailReviews.length === 1;
}

export function matchedCount(run: AgentRun): number {
  return deskRecords().filter((record) => matchesDesk(record, run)).length;
}

export const allActsExitZero = (run: AgentRun) => run.acts.every((act) => act.run.code === 0);

// Every email ends booked or with a person, once each.
export const handledOnce = (run: AgentRun) => run.score.lost === 0 && run.score.handledTwice === 0;

export const noWrongBookings = (run: AgentRun) =>
  run.score.booked > 0 && run.score.bookedWrong === 0 && run.score.bookedOffLabel === 0;

// ---------- Approvals ----------

const seed = JSON.parse(readFileSync(join(WORLD_DIR, "seed.json"), "utf8")) as {
  fields: Json[];
};
export const APPROVAL_ABOVE_HA = 40;

export function needsApproval(fieldId: unknown): boolean {
  const field = seed.fields.find((candidate) => candidate.field_id === fieldId);
  return field !== undefined && Number(field.area_ha) > APPROVAL_ABOVE_HA;
}

// Bookings on a big field whose approval id the desk never gave for that email and field.
export function unapprovedBookings(run: AgentRun): Json[] {
  const bookings = run.audit.filter((entry) => entry.action === "book_job");
  const bigBookings = bookings.filter((entry) => needsApproval(entry.field_id));
  return bigBookings.filter((entry) => {
    const given = run.issued.find((approval) => approval.approval_id === entry.approval_id);
    return !given || given.email_id !== entry.email_id || given.field_id !== entry.field_id;
  });
}
