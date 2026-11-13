// Starts the learner's work against a fresh copy of the co-op's application system, then reads
// what happened from the system's state and the call log. Never from the model's reply.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../../scripts/structure";

// The Python that runs the world and the learner's verbs: the uv environment when it exists,
// otherwise the system python3. Replay mode needs only the standard library, so CI needs no uv.
const UV_PYTHON = join(ROOT, ".venv", "bin", "python");
export const PYTHON = existsSync(UV_PYTHON) ? UV_PYTHON : "python3";

export const WORLD_DIR = join(ROOT, "worlds", "tallgrass_bend");

// What the world's score command reports about one run.
export type Score = {
  split: string;
  emails: number;
  booked: number;
  sentToReview: number;
  bookedCorrect: number;
  bookedWrong: number;
  bookedOffLabel: number;
  lost: number;
  handledTwice: number;
  correctShare: number;
  calls: number;
  costUsd: number;
};

export type Run = { code: number; stdout: string; stderr: string };

export type World = { url: string; db: string; runsDir: string; scratch: string; stop: () => void };

// One inbox email as the learner's extract reads it. The keys stay in snake_case because
// the learner's Python reads them.
export type InboxEmail = Record<"email_id" | "text", string>;

type Split = "dev" | "test";

// Every Python the checks start can import the course's code and answers from the replay.
// biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
export const REPLAY_ENV = { PYTHONPATH: ROOT, LLM_PROVIDER: "replay" };

const baseEnv = (extra: Record<string, string> = {}) => ({
  ...process.env,
  ...REPLAY_ENV,
  ...extra,
});

export function python(args: string[], extra: Record<string, string> = {}, folder = ROOT): Run {
  const options = { cwd: folder, env: baseEnv(extra), encoding: "utf8", timeout: 60_000 } as const;
  const result = spawnSync(PYTHON, args, options);
  return { code: result.status ?? 2, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export function readJsonLines(file: string): Record<string, unknown>[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const filledLines = lines.filter(Boolean);
  return filledLines.map((line) => JSON.parse(line));
}

async function freePort(): Promise<number> {
  const server = Bun.serve({ port: 0, fetch: () => new Response("") });
  const port = server.port;
  server.stop(true);
  return port;
}

async function isUp(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/health`);
    return response.ok;
  } catch {
    // The server is not listening yet.
    return false;
  }
}

async function waitUntilUp(url: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await isUp(url)) return;
    await Bun.sleep(50);
  }
}

function serveWorld(db: string, port: number, split: Split): ChildProcess {
  const args = ["-m", "worlds", "serve", "--db", db, "--port", String(port), "--split", split];
  return spawn(PYTHON, args, { cwd: ROOT, env: baseEnv(), stdio: "ignore" });
}

export async function startWorld(split: Split = "dev"): Promise<World> {
  const scratch = mkdtempSync(join(tmpdir(), "tallgrass-"));
  const db = join(scratch, "coop.db");
  const runsDir = join(scratch, "runs");
  const reset = python(["-m", "worlds", "reset", "--db", db]);
  if (reset.code !== 0) throw new Error(`the world could not reset: ${reset.stderr}`);

  const port = await freePort();
  const server = serveWorld(db, port, split);
  const url = `http://127.0.0.1:${port}`;
  await waitUntilUp(url);

  const stop = () => {
    server.kill();
    rmSync(scratch, { recursive: true, force: true });
  };
  return { url, db, runsDir, scratch, stop };
}

// The score command prints snake_case keys, such as "booked_wrong". Code here reads "bookedWrong".
function camelCaseKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const renamed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    renamed[camelKey] = value;
  }
  return renamed;
}

// Reads the JSON the score command printed.
export function parseScore(printed: string): Score {
  return camelCaseKeys(JSON.parse(printed)) as Score;
}

export function score(world: World, split: Split = "dev"): Score {
  const args = ["-m", "worlds.score", "--db", world.db, "--split", split];
  const result = python([...args, "--runs", world.runsDir]);
  if (result.code !== 0) throw new Error(`the score could not run: ${result.stderr}`);
  return parseScore(result.stdout);
}

export function calls(runsDir: string): Record<string, unknown>[] {
  const file = join(runsDir, "calls.jsonl");
  if (!existsSync(file)) return [];
  return readJsonLines(file);
}

export function devEmails(): InboxEmail[] {
  const truth = readJsonLines(join(WORLD_DIR, "truth", "dev.jsonl"));
  return truth.map((row) => {
    const emailId = String(row.email_id);
    const text = readFileSync(join(WORLD_DIR, "inbox", "dev", `${emailId}.txt`), "utf8");
    // biome-ignore lint/style/useNamingConvention: the learner's Python reads "email_id".
    return { email_id: emailId, text };
  });
}
