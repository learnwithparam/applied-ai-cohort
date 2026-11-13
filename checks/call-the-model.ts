import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { hasVerb, runVerb } from "./lib/contract";
import { calls, devEmails, type InboxEmail } from "./lib/world";

type ExtractRun = { code: number; stdout: string; calls: number };

// Each email gets a fresh call log, so the calls counted are this run's calls only.
function extractOnce(folder: string, email: InboxEmail): ExtractRun {
  const runsDir = mkdtempSync(join(tmpdir(), "calls-"));
  // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
  const run = runVerb(folder, "extract", { stdin: email, env: { RUNS_DIR: runsDir } });
  return { code: run.code, stdout: run.stdout.trim(), calls: calls(runsDir).length };
}

// Runs extract on three dev emails. Results are kept per folder so each rule reads the same runs.
const savedRuns = new Map<string, ExtractRun[]>();

function extractRuns(folder: string): ExtractRun[] {
  let runs = savedRuns.get(folder);
  if (!runs) {
    const firstThree = devEmails().slice(0, 3);
    runs = firstThree.map((email) => extractOnce(folder, email));
    savedRuns.set(folder, runs);
  }
  return runs;
}

export default [
  {
    says: "contract.toml names an extract verb",
    test: (folder) => hasVerb(folder, "extract"),
    tryNext: 'add extract = "uv run python extract.py" under [verbs] in contract.toml',
  },
  {
    says: "extract exits 0 and prints the reply for 3 dev emails",
    test: (folder) => extractRuns(folder).every((run) => run.code === 0 && run.stdout.length > 0),
    tryNext:
      "run uv run world email TB-1001 | uv run python extract.py and read the error it prints",
  },
  {
    says: "each run made one model call through config.llm, logged in calls.jsonl",
    test: (folder) => extractRuns(folder).every((run) => run.calls >= 1),
    tryNext:
      'call complete("fast", messages) from config.llm; ' +
      "it logs every call, a hand-written reply logs none",
  },
] satisfies Rule[];
