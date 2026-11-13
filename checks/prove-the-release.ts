import type { Rule } from "../scripts/verify";
import gateTheRelease from "./gate-the-release";
import { sections, written } from "./lib/markdown";
import lockTheEndpoint from "./lock-the-endpoint";
import proveTheRecords from "./prove-the-records";
import serveTheContract from "./serve-the-contract";
import showTheScorecard, { rowsFor } from "./show-the-scorecard";
import writeTheRunbook from "./write-the-runbook";

// True when every rule of an earlier step holds on this folder.
async function allPass(rules: Rule[], folder: string): Promise<boolean> {
  for (const rule of rules) {
    if (!(await rule.test(folder))) return false;
  }
  return true;
}

function measuredLinesPass(folder: string): boolean {
  const rows = rowsFor(folder) ?? [];
  const measured = rows.filter((row) => [1, 5, 6, 7].includes(row.line));
  return measured.length === 4 && measured.every((row) => row.status === "PASS");
}

export default [
  {
    says: "line 1 still passes: every prove-the-records rule holds on this folder",
    test: (folder) => allPass(proveTheRecords, folder),
    tryNext: "run bun run verify prove-the-records on your part one work, then copy it in here",
  },
  {
    says: "the service still streams, signs in and stops at its spending limit",
    test: async (folder) =>
      (await allPass(serveTheContract, folder)) && (await allPass(lockTheEndpoint, folder)),
    tryNext:
      "run serve.py here with SPEND_LIMIT_USD=0.0003: no token gets 401, and run six gets 429",
  },
  {
    says: "the release gate still passes the clean folder and blocks the planted pull request",
    test: (folder) => allPass(gateTheRelease, folder),
    tryNext: "run uv run python gate.py in this folder; it must print passed: true",
  },
  {
    says: "RUNBOOK.md still has every section, with commands, numbers and email ids",
    test: (folder) => allPass(writeTheRunbook, folder),
    tryNext: "compare RUNBOOK.md here with the five Done when lines of write-the-runbook",
  },
  {
    says: "SCORECARD.md matches the check's own numbers, and lines 1, 5, 6 and 7 say PASS",
    test: async (folder) => (await allPass(showTheScorecard, folder)) && measuredLinesPass(folder),
    tryNext: "run uv run python scorecard.py in this folder; a FAIL line on it names the part",
  },
  {
    says: "NOTES.md answers What I would watch after release, from your own runs",
    test: (folder) => written(sections(folder, "NOTES.md")["what i would watch after release"], 20),
    tryNext: "write two to four sentences under ## What I would watch after release in NOTES.md",
  },
] satisfies Rule[];
