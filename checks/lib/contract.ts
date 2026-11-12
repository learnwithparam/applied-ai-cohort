// The learner's contract: contract.toml names a shell command for each verb. A check runs the
// command and judges what it did, so any language or framework passes.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../scripts/structure";
import { PYTHON, type Run, type Score, score, startWorld, type World } from "./world";

export function verbs(dir: string): Record<string, string> {
  const file = join(dir, "contract.toml");
  if (!existsSync(file)) return {};
  const parsed = Bun.TOML.parse(readFileSync(file, "utf8")) as { verbs?: Record<string, string> };
  return parsed.verbs ?? {};
}

export const hasVerb = (dir: string, verb: string) =>
  typeof verbs(dir)[verb] === "string" && verbs(dir)[verb].trim() !== "";

// "uv run python x.py" runs on the course's own Python, so a check never waits on uv.
const localCommand = (command: string) => command.replace(/^uv run (python3?|python)\b/, PYTHON);

export function runVerb(
  dir: string,
  verb: string,
  options: { stdin?: unknown; env?: Record<string, string> } = {},
): Run {
  const command = verbs(dir)[verb];
  if (!command) return { code: 2, stdout: "", stderr: `contract.toml has no ${verb} verb` };
  const result = spawnSync("sh", ["-c", localCommand(command)], {
    cwd: dir,
    input: options.stdin === undefined ? "" : JSON.stringify(options.stdin),
    env: { ...process.env, PYTHONPATH: ROOT, LLM_PROVIDER: "replay", ...options.env },
    encoding: "utf8",
    timeout: 120_000,
  });
  return { code: result.status ?? 2, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export const worldEnv = (world: World) => ({ WORLD_URL: world.url, RUNS_DIR: world.runsDir });

export type IntakeRun = { run: Run; score: Score; extra?: Run };

// Runs the intake verb on a fresh world, three times, because a check judges behaviour over
// three fresh runs. Results are kept per folder so each rule reads the same runs.
const cache = new Map<string, Promise<IntakeRun[]>>();
export function intakeRuns(
  dir: string,
  split: "dev" | "test" = "dev",
  after?: string,
): Promise<IntakeRun[]> {
  const key = `${dir}|${split}|${after ?? ""}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const runs: IntakeRun[] = [];
        for (let attempt = 0; attempt < 3; attempt++) {
          const world = await startWorld(split);
          try {
            const run = runVerb(dir, "intake", { env: worldEnv(world) });
            const extra = after ? runVerb(dir, after, { env: worldEnv(world) }) : undefined;
            runs.push({ run, score: score(world, split), extra });
          } finally {
            world.stop();
          }
        }
        return runs;
      })(),
    );
  }
  return cache.get(key)!;
}

export const ROOT_DIR = ROOT;
