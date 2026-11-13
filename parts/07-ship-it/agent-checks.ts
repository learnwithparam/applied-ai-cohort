// Helpers the ship-it checks share. They run the learner's agent and HTTP service against a
// fresh world, play the approval desk and the trace store, and read what the world holds
// afterwards. Nothing here reads what the agent says about its own work.
// The agent helpers are the same as in parts five and six, so this part can be checked on its own.
import { Database } from "bun:sqlite";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

// ---------- The trace store ----------

export type Span = Json & { traceId: string; name: string; attributes: Json };
export type TraceStore = { url: string; spans: Span[]; stop: () => void };

type OtlpAttribute = { key: string; value: Record<string, unknown> };
type OtlpSpan = Json & { attributes?: OtlpAttribute[] };
type OtlpPayload = { resourceSpans?: { scopeSpans?: { spans?: OtlpSpan[] }[] }[] };

// An OTLP attribute value, such as {"intValue": "120"}, as a plain number or text.
function plainValue(value: Record<string, unknown>): unknown {
  if ("intValue" in value) return Number(value.intValue);
  return Object.values(value)[0];
}

function flatSpan(span: OtlpSpan): Span {
  const attributes: Json = {};
  for (const attribute of span.attributes ?? []) {
    attributes[attribute.key] = plainValue(attribute.value);
  }
  return { ...span, attributes } as Span;
}

function flatSpans(payload: OtlpPayload): Span[] {
  const scopes = (payload.resourceSpans ?? []).flatMap((resource) => resource.scopeSpans ?? []);
  const spans = scopes.flatMap((scope) => scope.spans ?? []);
  return spans.map(flatSpan);
}

// A small trace store: it takes OTLP JSON at /v1/traces and lists every span at /api/spans.
export function startTraceStore(): TraceStore {
  const spans: Span[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (incoming) => {
      if (incoming.method === "GET") return Response.json(spans);
      try {
        spans.push(...flatSpans((await incoming.json()) as OtlpPayload));
      } catch {
        // A body that is not OTLP JSON adds no spans; the check then finds none.
      }
      return Response.json({});
    },
  });
  return { url: `http://127.0.0.1:${server.port}`, spans, stop: () => server.stop(true) };
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
  spans: Span[];
  files: Record<string, string>;
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

// Every Markdown file the learner's verbs wrote into the runs folder, by name.
function markdownFiles(runsDir: string): Record<string, string> {
  const files: Record<string, string> = {};
  if (!existsSync(runsDir)) return files;
  for (const name of readdirSync(runsDir)) {
    if (name.endsWith(".md")) files[name] = readFileSync(join(runsDir, name), "utf8");
  }
  return files;
}

async function oneAgentRun(folder: string, scenario: Scenario): Promise<AgentRun> {
  const world = await startWorld(scenario.split);
  const desk = scenario.withDesk ? startApprovalDesk() : undefined;
  const store = startTraceStore();
  // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
  const env: Record<string, string> = { ...worldEnv(world), TRACES_URL: store.url };
  if (desk) env.APPROVALS_URL = desk.url;
  try {
    const acts = await actOnAll(folder, scenario.tasks, env);
    scenario.runsDirOverride?.(world.runsDir);
    let extra: Run | undefined;
    if (scenario.after) extra = await runVerbAsync(folder, scenario.after, undefined, env);
    const state = await readWorld(world, scenario.split);
    const files = markdownFiles(world.runsDir);
    return { acts, ...state, issued: desk?.issued ?? [], spans: store.spans, files, extra };
  } finally {
    store.stop();
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

// Each task's email ends booked or with a person, once. Emails that were not tasks are ignored.
export function tasksHandledOnce(run: AgentRun): boolean {
  return run.acts.every((act) => {
    const emailId = act.task.email_id;
    const jobs = run.jobs.filter((job) => job.email_id === emailId).length;
    const reviews = run.reviews.filter((item) => item.email_id === emailId).length;
    return jobs + reviews === 1;
  });
}

// ---------- The grader's guard sets ----------

export type GuardRow = Task;
type GraderSets = { attack: GuardRow[]; benign: GuardRow[] };

export const graderSets = (): GraderSets =>
  JSON.parse(readFileSync(join(import.meta.dir, "grader-sets.json"), "utf8"));

// ---------- The HTTP service ----------

export type Service = { url: string; world: World; stop: () => void };
export type ServiceSettings = Record<string, string>;

async function freePort(): Promise<number> {
  const probe = Bun.serve({ port: 0, fetch: () => new Response("") });
  const port = probe.port;
  probe.stop(true);
  return port;
}

async function waitForService(url: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch(url);
      return;
    } catch {
      // Nothing is listening yet.
      await Bun.sleep(50);
    }
  }
}

// Starts the learner's serve verb on a free port, against a fresh dev world.
export async function startService(folder: string, settings: ServiceSettings): Promise<Service> {
  const world = await startWorld("dev");
  const port = await freePort();
  const command = (verbs(folder).serve ?? "false").replace(/^uv run (python3?|python)\b/, PYTHON);
  const env = {
    ...process.env,
    ...REPLAY_ENV,
    ...worldEnv(world),
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    PORT: String(port),
    ...settings,
  };
  const child = Bun.spawn(["sh", "-c", `exec ${command}`], {
    cwd: folder,
    env,
    stdout: "ignore",
    stderr: "ignore",
  });
  const url = `http://127.0.0.1:${port}`;
  await waitForService(url);
  const stop = () => {
    child.kill();
    world.stop();
  };
  return { url, world, stop };
}

export type ServedRun = {
  status: number;
  contentType: string;
  events: { name: string; data: Json }[];
  body: string;
  firstEventMs: number;
};

function parseEvents(body: string): ServedRun["events"] {
  const events: ServedRun["events"] = [];
  for (const block of body.split("\n\n")) {
    const name = block.match(/^event: (.+)$/m)?.[1];
    const data = block.match(/^data: (.+)$/m)?.[1];
    if (name && data) events.push({ name, data: parseJson(data) ?? {} });
  }
  return events;
}

// Reads the whole answer, and notes how long the first chunk took to arrive.
async function readAnswer(response: Response, startedAt: number) {
  let body = "";
  let firstEventMs = -1;
  const decoder = new TextDecoder();
  if (!response.body) return { body, firstEventMs };
  for await (const chunk of response.body) {
    if (firstEventMs < 0) firstEventMs = performance.now() - startedAt;
    body += decoder.decode(chunk);
  }
  return { body, firstEventMs };
}

export async function postRun(service: Service, task: Task, token?: string): Promise<ServedRun> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  const startedAt = performance.now();
  const response = await fetch(`${service.url}/v1/runs`, {
    method: "POST",
    headers,
    body: JSON.stringify({ verb: "act", input: task }),
  });
  const { body, firstEventMs } = await readAnswer(response, startedAt);
  const contentType = response.headers.get("content-type") ?? "";
  return { status: response.status, contentType, events: parseEvents(body), body, firstEventMs };
}

// How many jobs and reviews the world holds for one email.
export async function writesFor(service: Service, emailId: string): Promise<number> {
  const jobs = (await (await fetch(`${service.world.url}/api/jobs`)).json()) as Json[];
  const reviews = (await (await fetch(`${service.world.url}/api/review`)).json()) as Json[];
  const all = [...jobs, ...reviews];
  return all.filter((item) => item.email_id === emailId).length;
}
