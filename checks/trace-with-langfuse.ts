// Runs assignment/check.py against a Langfuse stack and turns its three Done-when lines into rules.
// A folder under solution/ or wrong/ gets its own throwaway stack, with random keys that are never
// printed. In CI the starter does too. On a learner's computer the starter is not run: the check
// reads the stack the learner started with assignment/compose.yml.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";

const ASSIGNMENT = join(ROOT, "assignment");
const LEARNER_ENV = join(ASSIGNMENT, ".env");
const PROJECT = "applied-ai-closing-proof";

type Lines = Record<string, string>;
type Stack = { envFile: string; scratch: string };

let stack: Promise<Stack | null> | undefined;
const answers = new Map<string, Promise<Lines>>();

function runQuietly(command: string[], envFile?: string) {
  const environment = { ...process.env };
  // uv reads its --env-file from this variable, so the secrets never appear in a command line.
  if (envFile) environment["UV_ENV_FILE"] = envFile;
  return spawnSync(command[0], command.slice(1), { cwd: ROOT, encoding: "utf8", env: environment });
}

function composeArguments(envFile: string, ...rest: string[]): string[] {
  const files = ["--env-file", envFile, "-p", PROJECT, "-f", join(ASSIGNMENT, "compose.yml")];
  return ["docker", "compose", ...files, ...rest];
}

function stopStack(started: Stack) {
  runQuietly(composeArguments(started.envFile, "down", "-v"));
  rmSync(started.scratch, { recursive: true, force: true });
}

async function startStack(): Promise<Stack | null> {
  if (runQuietly(["docker", "info"]).status !== 0) return null;
  const scratch = mkdtempSync(join(tmpdir(), "langfuse-proof-"));
  const envFile = join(scratch, "env");
  runQuietly(["uv", "run", "python", join(ASSIGNMENT, "keys.py"), "--out", envFile]);
  const started = { envFile, scratch };
  // docker compose down -v removes the containers and their volumes when verify ends.
  process.on("exit", () => stopStack(started));
  const waitFor = ["--wait", "--wait-timeout", "300"];
  const result = runQuietly(composeArguments(envFile, "up", "-d", ...waitFor));
  return result.status === 0 ? started : null;
}

const ownStack = () => {
  stack ??= startStack();
  return stack;
};

const wantsOwnStack = (folder: string) => !folder.endsWith("/problem") || Boolean(process.env.CI);

async function checkOnce(folder: string): Promise<Lines> {
  const own = wantsOwnStack(folder);
  const started = own ? await ownStack() : null;
  const envFile = started?.envFile ?? LEARNER_ENV;
  if (!existsSync(envFile)) return {};
  const since = Date.now() / 1000;
  if (own) {
    const script = join(folder, "trace.py");
    runQuietly(["uv", "run", "--group", "assignment", "python", script], envFile);
  }
  const out = join(mkdtempSync(join(tmpdir(), "langfuse-result-")), "result.json");
  const checkScript = join(ASSIGNMENT, "check.py");
  const args = ["uv", "run", "python", checkScript, "--since", String(own ? since : 0)];
  runQuietly([...args, "--out", out], envFile);
  return existsSync(out) ? JSON.parse(readFileSync(out, "utf8")).lines : {};
}

function answerFor(folder: string): Promise<Lines> {
  if (!answers.has(folder)) answers.set(folder, checkOnce(folder));
  return answers.get(folder) as Promise<Lines>;
}

const line = (says: string, tryNext: string): Rule => ({
  says,
  test: async (folder) => (await answerFor(folder))[says] === "pass",
  tryNext,
});

export default [
  line(
    "The Langfuse health endpoint returns 200",
    "run uv run python assignment/keys.py, then start the stack in assignment/compose.yml",
  ),
  line(
    "One trace exists with a model name and token counts",
    "wrap the model call so each call is a generation with model, input and output token counts",
  ),
  line(
    "The trace has a score named for a number the scorer reports",
    "call create_score on the trace with a name such as correct_share and the scorer's own value",
  ),
] satisfies Rule[];
