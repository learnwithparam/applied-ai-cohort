// The act verb on Google ADK, on every dev email, three fresh runs against a fresh world each time.
// It reads the ADK event log the learner's agent writes, so the tool order is judged from what ADK
// recorded, never from what the model said.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { devTasks, parseJson, runVerbAsync, type Task } from "../parts/05-let-it-act/agent-checks";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { hasVerb, worldEnv } from "./lib/contract";
import { type Run, readJsonLines, type Score, score, startWorld, type World } from "./lib/world";

type Json = Record<string, unknown>;
type ActResult = { task: Task; run: Run; printed: Json | undefined };

// biome-ignore lint/style/useNamingConvention: the event log is ADK's JSON, with snake_case keys.
type AdkEvent = { run_id?: string; content?: { parts?: { function_call?: { name?: string } }[] } };

type AdkRun = { acts: ActResult[]; score: Score; events: AdkEvent[] };

// The course's Python needs google-adk, so the check installs the adk group before the runs.
function installAdkGroup() {
  const sync = spawnSync("uv", ["sync", "--group", "adk"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 600_000,
  });
  if (sync.status !== 0) throw new Error(`uv sync --group adk failed: ${sync.stderr}`);
}

function adkEvents(runsDir: string): AdkEvent[] {
  const file = join(runsDir, "adk-events.jsonl");
  return existsSync(file) ? (readJsonLines(file) as AdkEvent[]) : [];
}

// Runs the act verb on every dev email, four at a time, against one world.
async function actOnEveryEmail(folder: string, world: World): Promise<ActResult[]> {
  const env = worldEnv(world);
  const acts: ActResult[] = [];
  const waiting = devTasks();
  const worker = async () => {
    for (let task = waiting.shift(); task; task = waiting.shift()) {
      const run = await runVerbAsync(folder, "act", task, env);
      acts.push({ task, run, printed: parseJson(run.stdout) });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return acts;
}

async function oneFreshRun(folder: string): Promise<AdkRun> {
  const world = await startWorld("dev");
  try {
    const acts = await actOnEveryEmail(folder, world);
    return { acts, score: score(world, "dev"), events: adkEvents(world.runsDir) };
  } finally {
    world.stop();
  }
}

async function threeFreshRuns(folder: string): Promise<AdkRun[]> {
  installAdkGroup();
  const found: AdkRun[] = [];
  for (let attempt = 0; attempt < 3; attempt++) found.push(await oneFreshRun(folder));
  return found;
}

// Three fresh runs per folder, kept so every rule reads the same runs.
const savedRuns = new Map<string, Promise<AdkRun[]>>();

function adkRuns(folder: string): Promise<AdkRun[]> {
  let runs = savedRuns.get(folder);
  if (!runs) {
    runs = threeFreshRuns(folder);
    savedRuns.set(folder, runs);
  }
  return runs;
}

async function everyRun(folder: string, passes: (run: AdkRun) => boolean): Promise<boolean> {
  return (await adkRuns(folder)).every(passes);
}

const printsRunIdAndStop = (run: AdkRun) =>
  run.acts.every((act) => {
    const printed = act.printed ?? {};
    return typeof printed.run_id === "string" && typeof printed.stop_reason === "string";
  });

const allActsExitZero = (run: AdkRun) => run.acts.every((act) => act.run.code === 0);

// Every email ends booked or with a person, once each.
const handledOnce = (run: AdkRun) => run.score.lost === 0 && run.score.handledTwice === 0;

// The tool names one run made, in the order ADK recorded them.
function toolNames(events: AdkEvent[], runId: string): string[] {
  const names: string[] = [];
  for (const event of events) {
    if (event.run_id !== runId) continue;
    for (const part of event.content?.parts ?? []) {
      const name = part.function_call?.name;
      if (name) names.push(name);
    }
  }
  return names;
}

// Every booking comes after a grower lookup in the same run.
function growerBeforeEveryBooking(run: AdkRun): boolean {
  return run.acts.every((act) => {
    const names = toolNames(run.events, String(act.printed?.run_id ?? ""));
    const bookingAt = names.indexOf("book_job");
    if (bookingAt === -1) return true;
    const lookupAt = names.indexOf("find_grower");
    return lookupAt !== -1 && lookupAt < bookingAt;
  });
}

export default [
  {
    says: "contract.toml names an act verb",
    test: (folder) => hasVerb(folder, "act"),
    tryNext: 'add act = "uv run --group adk python agent.py" under [verbs] in contract.toml',
  },
  {
    says: "act exits 0 on every dev email, 3 fresh runs out of 3",
    test: (folder) => everyRun(folder, allActsExitZero),
    tryNext:
      "run uv run world email TB-1001 | uv run --group adk python agent.py, and read the error",
  },
  {
    says: "act prints one line of JSON with a run_id and a stop_reason",
    test: (folder) => everyRun(folder, printsRunIdAndStop),
    tryNext: "end agent.py by printing the dict that act returns, as one line of JSON",
  },
  {
    says: "every dev email reaches an end state: booked or with a person, once each",
    test: (folder) => everyRun(folder, handledOnce),
    tryNext: "pass your four tools to Agent, and let book_job answer a repeat from BOOKED",
  },
  {
    says: "the agent does the work: at least 20 of the 40 dev emails end with a booked job",
    test: (folder) => everyRun(folder, (run) => run.score.booked >= 20),
    tryNext: "write the four tools and pass them to Agent, so the model can book the job",
  },
  {
    says: "the event log shows find_grower before every book_job",
    test: (folder) => everyRun(folder, growerBeforeEveryBooking),
    tryNext: "keep find_grower in the tools, and read runs/adk-events.jsonl to see the call order",
  },
] satisfies Rule[];
