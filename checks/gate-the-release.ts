import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseJson } from "../parts/07-ship-it/agent-checks";
import type { Rule } from "../scripts/verify";
import { hasVerb, verbs } from "./lib/contract";
import { PYTHON, REPLAY_ENV, type Run } from "./lib/world";

// The planted pull request: it trims the one line of the prompt that tells the model to follow
// a tool's advice. Nothing books wrong, but misspelled products stop being booked.
export const PLANTED_LINE = "If a tool returns an error, read it and follow its advice.";

function runEval(folder: string): Run {
  const command = (verbs(folder).eval ?? "false").replace(/^uv run (python3?|python)\b/, PYTHON);
  const result = spawnSync("sh", ["-c", command], {
    cwd: folder,
    env: { ...process.env, ...REPLAY_ENV },
    encoding: "utf8",
    timeout: 180_000,
  });
  return { code: result.status ?? 2, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

// The same folder with the planted change applied, in a scratch copy.
function runEvalOnPlantedChange(folder: string): Run {
  const scratch = mkdtempSync(join(tmpdir(), "planted-pr-"));
  try {
    cpSync(folder, scratch, { recursive: true });
    const prompt = join(scratch, "prompt.md");
    if (!existsSync(prompt)) return { code: 2, stdout: "", stderr: "no prompt.md" };
    const trimmed = readFileSync(prompt, "utf8").replace(`${PLANTED_LINE}\n`, "");
    writeFileSync(prompt, trimmed);
    return runEval(scratch);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

const saved = new Map<string, { clean: Run; planted: Run }>();

export function gateRuns(folder: string) {
  let found = saved.get(folder);
  if (!found) {
    found = { clean: runEval(folder), planted: runEvalOnPlantedChange(folder) };
    saved.set(folder, found);
  }
  return found;
}

export function workflowRunsTheGate(folder: string): boolean {
  const file = join(folder, "release-gate.yml");
  if (!existsSync(file) || !hasVerb(folder, "eval")) return false;
  const workflow = readFileSync(file, "utf8");
  const onPullRequests = /^on:\s*\n\s+pull_request:/m.test(workflow);
  const runsEval = workflow.includes(`run: ${verbs(folder).eval}`);
  return onPullRequests && runsEval;
}

export default [
  {
    says: "contract.toml names an eval verb",
    test: (folder) => hasVerb(folder, "eval"),
    tryNext: 'add eval = "uv run python gate.py" under [verbs] in contract.toml',
  },
  {
    says: "release-gate.yml runs on every pull request and has a step that runs the eval verb",
    test: workflowRunsTheGate,
    tryNext: "add a step with run: uv run python gate.py under on: pull_request",
  },
  {
    says: "on the clean folder, eval exits 0 and prints passed: true",
    test: (folder) => {
      const clean = gateRuns(folder).clean;
      return clean.code === 0 && parseJson(clean.stdout)?.passed === true;
    },
    tryNext:
      "run uv run python gate.py; if it fails here, the baseline is above what the agent does",
  },
  {
    says: "on the planted pull request that trims the prompt, eval exits 1 with passed: false",
    test: (folder) => {
      const planted = gateRuns(folder).planted;
      return planted.code === 1 && parseJson(planted.stdout)?.passed === false;
    },
    tryNext:
      "gate on the matched count as well as on wrong jobs: " +
      "a prompt can lose good bookings without booking anything wrong",
  },
] satisfies Rule[];
