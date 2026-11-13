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
    tryNext: "rerun bun run verify lock-the-endpoint on this folder and fix its FAIL lines",
  },
  {
    says: "the release gate still passes the clean folder and blocks the planted pull request",
    test: (folder) => allPass(gateTheRelease, folder),
    tryNext: "rerun bun run verify gate-the-release on this folder",
  },
  {
    says: "RUNBOOK.md still has every section, with commands, numbers and email ids",
    test: (folder) => allPass(writeTheRunbook, folder),
    tryNext: "rerun bun run verify write-the-runbook on this folder",
  },
  {
    says: "SCORECARD.md matches the check's own numbers, and lines 1, 5, 6 and 7 say PASS",
    test: async (folder) => (await allPass(showTheScorecard, folder)) && measuredLinesPass(folder),
    tryNext: "rerun bun run verify show-the-scorecard; a FAIL line on the scorecard names the part",
  },
  {
    says: "NOTES.md answers What I would watch after release, from your own runs",
    test: (folder) => written(sections(folder, "NOTES.md")["what i would watch after release"], 20),
    tryNext: "write two to four sentences under ## What I would watch after release in NOTES.md",
  },
] satisfies Rule[];
