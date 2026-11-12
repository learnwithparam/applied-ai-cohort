// The learner's contract: contract.toml names a shell command for each verb. A check runs the
// command and judges what it did, so any language or framework passes.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PYTHON, REPLAY_ENV, type Run, type Score, score, startWorld, type World } from "./world";

type Contract = { verbs?: Record<string, string> };
type VerbOptions = { stdin?: unknown; env?: Record<string, string> };

export function verbs(folder: string): Record<string, string> {
  const file = join(folder, "contract.toml");
  if (!existsSync(file)) return {};
  const contract = Bun.TOML.parse(readFileSync(file, "utf8")) as Contract;
  return contract.verbs ?? {};
}

export function hasVerb(folder: string, verb: string): boolean {
  const command = verbs(folder)[verb];
  return typeof command === "string" && command.trim() !== "";
}

// "uv run python x.py" runs on the course's own Python, so a check never waits on uv.
const localCommand = (command: string) => command.replace(/^uv run (python3?|python)\b/, PYTHON);

export function runVerb(folder: string, verb: string, options: VerbOptions = {}): Run {
  const command = verbs(folder)[verb];
  if (!command) return { code: 2, stdout: "", stderr: `contract.toml has no ${verb} verb` };
  let input = "";
  if (options.stdin !== undefined) input = JSON.stringify(options.stdin);
  const result = spawnSync("sh", ["-c", localCommand(command)], {
    cwd: folder,
    input,
    env: { ...process.env, ...REPLAY_ENV, ...options.env },
    encoding: "utf8",
    timeout: 120_000,
  });
  return { code: result.status ?? 2, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

// biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
export const worldEnv = (world: World) => ({ WORLD_URL: world.url, RUNS_DIR: world.runsDir });

// One intake run: what the verb printed, how the world scored it, and the verb run after it.
export type IntakeRun = { run: Run; score: Score; extra?: Run };

async function oneIntakeRun(folder: string, split: "dev" | "test", after?: string) {
  const world = await startWorld(split);
  try {
    const run = runVerb(folder, "intake", { env: worldEnv(world) });
    let extra: Run | undefined;
    if (after) extra = runVerb(folder, after, { env: worldEnv(world) });
    return { run, score: score(world, split), extra };
  } finally {
    world.stop();
  }
}

async function threeIntakeRuns(folder: string, split: "dev" | "test", after?: string) {
  const runs: IntakeRun[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    runs.push(await oneIntakeRun(folder, split, after));
  }
  return runs;
}

// Runs the intake verb on a fresh world, three times, because a check judges behaviour over
// three fresh runs. Results are kept per folder so each rule reads the same runs.
const savedRuns = new Map<string, Promise<IntakeRun[]>>();

export function intakeRuns(
  folder: string,
  split: "dev" | "test" = "dev",
  after?: string,
): Promise<IntakeRun[]> {
  const key = `${folder}|${split}|${after ?? ""}`;
  let runs = savedRuns.get(key);
  if (!runs) {
    runs = threeIntakeRuns(folder, split, after);
    savedRuns.set(key, runs);
  }
  return runs;
}
