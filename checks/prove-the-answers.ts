// The milestone: search and answers hold on the hidden test questions, and lines 1 and 2 of
// the scorecard still pass.
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Rule } from "../scripts/verify";
import { answeredShare, supportedShare } from "./check-the-citations";
import { runVerb } from "./lib/contract";
import { sections, written } from "./lib/markdown";
import { calls, readJsonLines } from "./lib/world";
import { PART_THREE_KIT } from "./load-the-documents";
import proveTheRecords from "./prove-the-records";
import { abstainedCount } from "./say-i-do-not-know";
import { type Row, recall } from "./search-the-passages";

function notesAreWritten(folder: string): boolean {
  const notes = sections(folder, "NOTES.md");
  const failedFirst = written(notes["where search failed first"], 20);
  const wouldCheck = written(notes["what i would check before agronomists use it"], 20);
  return failedFirst && wouldCheck;
}

// Line 2 of the scorecard, from part two: the judge on the grader's hashed labels.
function judgeOnGrader(folder: string): { verdicts: Row[]; calls: Row[] } {
  const runsDir = mkdtempSync(join(tmpdir(), "judge-runs-"));
  try {
    const cases = readJsonLines(join(PART_THREE_KIT, "judge-cases", "grader.jsonl"));
    const stdin = cases.map(({ label_hash: _labelHash, ...withoutLabel }) => withoutLabel);
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    const run = runVerb(folder, "judge", { stdin, env: { RUNS_DIR: runsDir } });
    const verdicts = run.code === 0 ? JSON.parse(run.stdout) : [];
    return { verdicts, calls: calls(runsDir) };
  } finally {
    rmSync(runsDir, { recursive: true, force: true });
  }
}

function judgeStillAgrees(folder: string): boolean {
  const cases = readJsonLines(join(PART_THREE_KIT, "judge-cases", "grader.jsonl"));
  const { verdicts, calls: judgeCalls } = judgeOnGrader(folder);
  const verdictOf = new Map(verdicts.map((item) => [item.case_id, item.verdict]));
  const passHash = (caseId: unknown) => createHash("sha256").update(`${caseId}|pass`).digest("hex");
  const personPasses = cases.filter((row) => row.label_hash === passHash(row.case_id));
  const personFails = cases.filter((row) => row.label_hash !== passHash(row.case_id));
  const kept = personPasses.filter((row) => verdictOf.get(row.case_id) === "pass").length;
  const caught = personFails.filter((row) => verdictOf.get(row.case_id) === "fail").length;
  const examples = judgeCalls.flatMap((call) => (call.example_case_ids ?? []) as string[]);
  const leaked = examples.some((caseId) => /^J-[HG]/.test(caseId));
  return !leaked && caught / personFails.length >= 0.8 && kept / personPasses.length >= 0.8;
}

function evalExitCode(folder: string, planted: boolean): number {
  const copy = mkdtempSync(join(dirname(folder), ".planted-"));
  const runsDir = mkdtempSync(join(tmpdir(), "eval-runs-"));
  try {
    cpSync(folder, copy, { recursive: true });
    if (planted)
      copyFileSync(join(PART_THREE_KIT, "planted", "extract.py"), join(copy, "extract.py"));
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    return runVerb(copy, "eval", { env: { RUNS_DIR: runsDir } }).code;
  } finally {
    rmSync(copy, { recursive: true, force: true });
    rmSync(runsDir, { recursive: true, force: true });
  }
}

// Line 1 of the scorecard: part one's rules on the hidden test inbox.
const lineOne = proveTheRecords.filter((rule) => rule.says.includes("test inbox"));

export default [
  {
    says:
      "NOTES.md answers Where search failed first " +
      "and What I would check before agronomists use it",
    test: notesAreWritten,
    tryNext: "write two to four sentences under each new heading in NOTES.md, from your own runs",
  },
  {
    says: "on the hidden test questions, recall@5 is 0.8 or more",
    test: (folder) => recall(folder, "test") >= 0.8,
    tryNext: "run uv run python recall.py; a change that only helps the dev questions fails here",
  },
  {
    says: "on the hidden test questions, 80% or more get an answer and 90% of those are supported",
    test: (folder) => answeredShare(folder, "test") >= 0.8 && supportedShare(folder, "test") >= 0.9,
    tryNext: "rerun bun run verify say-i-do-not-know on this folder and fix its FAIL lines first",
  },
  {
    says: "4 or more of the 5 hidden out-of-scope questions get abstained: true",
    test: (folder) => abstainedCount(folder, "out-of-scope-test") >= 4,
    tryNext: 'keep the "Not in the sources." instruction and the abstained flag from the last step',
  },
  {
    says: "line 2: the judge catches and keeps 80% on the grader's cases, with no leaked examples",
    test: judgeStillAgrees,
    tryNext: "keep judge.py from part two as it was, with examples from the dev cases only",
  },
  {
    says: "line 2: eval passes on your code and blocks the planted change",
    test: (folder) => evalExitCode(folder, false) === 0 && evalExitCode(folder, true) === 1,
    tryNext: "keep eval.py and evals/baseline.json from part two; run uv run python eval.py",
  },
  ...lineOne,
] satisfies Rule[];
