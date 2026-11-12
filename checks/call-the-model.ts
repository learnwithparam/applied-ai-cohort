import { hasVerb, runVerb } from "./lib/contract";
import { calls, devEmails } from "./lib/world";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";

// Runs extract on three dev emails, each with a fresh call log.
const cache = new Map<string, { code: number; stdout: string; calls: number }[]>();
function results(dir: string) {
  if (!cache.has(dir)) {
    cache.set(dir, devEmails().slice(0, 3).map((email) => {
      const runsDir = mkdtempSync(join(tmpdir(), "calls-"));
      const run = runVerb(dir, "extract", { stdin: email, env: { RUNS_DIR: runsDir } });
      return { code: run.code, stdout: run.stdout.trim(), calls: calls(runsDir).length };
    }));
  }
  return cache.get(dir)!;
}

export default [
  {
    says: "contract.toml names an extract verb",
    test: (dir) => hasVerb(dir, "extract"),
    tryNext: 'add extract = "uv run python extract.py" under [verbs] in contract.toml',
  },
  {
    says: "extract exits 0 and prints the reply for 3 dev emails",
    test: (dir) => results(dir).every((run) => run.code === 0 && run.stdout.length > 0),
    tryNext: "run uv run world email TB-1001 | uv run python extract.py and read the error it prints",
  },
  {
    says: "each run made one model call through config.llm, logged in calls.jsonl",
    test: (dir) => results(dir).every((run) => run.calls >= 1),
    tryNext: 'call complete("fast", messages) from config.llm; it logs every call, a hand-written reply logs none',
  },
] satisfies Rule[];
