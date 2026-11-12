// Starts the learner's work against a fresh copy of the co-op's application system, then reads
// what happened from the system's state and the call log. Never from the model's reply.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../../scripts/structure";

// The Python that runs the world and the learner's verbs: the uv environment when it exists,
// otherwise the system python3. Replay mode needs only the standard library, so CI needs no uv.
export const PYTHON = existsSync(join(ROOT, ".venv", "bin", "python"))
  ? join(ROOT, ".venv", "bin", "python")
  : "python3";

export type Score = {
  split: string;
  emails: number;
  booked: number;
  sent_to_review: number;
  booked_correct: number;
  booked_wrong: number;
  booked_off_label: number;
  lost: number;
  handled_twice: number;
  correct_share: number;
  calls: number;
  cost_usd: number;
};

export type Run = { code: number; stdout: string; stderr: string };

export type World = { url: string; db: string; runsDir: string; scratch: string; stop: () => void };

const baseEnv = (extra: Record<string, string> = {}) => ({
  ...process.env,
  PYTHONPATH: ROOT,
  LLM_PROVIDER: "replay",
  ...extra,
});

export function python(args: string[], extra: Record<string, string> = {}, cwd = ROOT): Run {
  const result = spawnSync(PYTHON, args, {
    cwd,
    env: baseEnv(extra),
    encoding: "utf8",
    timeout: 60_000,
  });
  return { code: result.status ?? 2, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

async function freePort(): Promise<number> {
  const server = Bun.serve({ port: 0, fetch: () => new Response("") });
  const port = server.port;
  server.stop(true);
  return port;
}

export async function startWorld(split: "dev" | "test" = "dev"): Promise<World> {
  const scratch = mkdtempSync(join(tmpdir(), "tallgrass-"));
  const db = join(scratch, "coop.db");
  const runsDir = join(scratch, "runs");
  const reset = python(["-m", "worlds", "reset", "--db", db]);
  if (reset.code !== 0) throw new Error(`the world could not reset: ${reset.stderr}`);
  const port = await freePort();
  const child = spawn(
    PYTHON,
    ["-m", "worlds", "serve", "--db", db, "--port", String(port), "--split", split],
    {
      cwd: ROOT,
      env: baseEnv(),
      stdio: "ignore",
    },
  );
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(`${url}/api/health`)).ok) break;
    } catch {
      /* not up yet */
    }
    await Bun.sleep(50);
  }
  return {
    url,
    db,
    runsDir,
    scratch,
    stop: () => {
      child.kill();
      rmSync(scratch, { recursive: true, force: true });
    },
  };
}

export function score(world: World, split: "dev" | "test" = "dev"): Score {
  const result = python([
    "-m",
    "worlds.score",
    "--db",
    world.db,
    "--split",
    split,
    "--runs",
    world.runsDir,
  ]);
  if (result.code !== 0) throw new Error(`the score could not run: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

export function calls(runsDir: string): Record<string, unknown>[] {
  const file = join(runsDir, "calls.jsonl");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export const WORLD_DIR = join(ROOT, "worlds", "tallgrass_bend");

export function devEmails(): { email_id: string; text: string }[] {
  const truth = readFileSync(join(WORLD_DIR, "truth", "dev.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return truth.map((row) => ({
    email_id: row.email_id,
    text: readFileSync(join(WORLD_DIR, "inbox", "dev", `${row.email_id}.txt`), "utf8"),
  }));
}
