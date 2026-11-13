// The milestone: the judge agrees with the grader's labels, the planted change is blocked,
// and line 1 of the scorecard still holds on the hidden test inbox.
import type { Rule } from "../scripts/verify";
import { agreement, noLeakedExamples } from "./align-the-judge";
import { blocksPlanted, passesAsItIs } from "./block-a-bad-change";
import { verdictForEveryCase } from "./draft-a-judge";
import { sections, written } from "./lib/markdown";
import proveTheRecords from "./prove-the-records";

const LOWEST_RATE = 0.8;

function notesAreWritten(folder: string): boolean {
  const notes = sections(folder, "NOTES.md");
  const caught = written(notes["what the eval caught"], 20);
  const next = written(notes["what i would measure next"], 20);
  return caught && next;
}

function agreesWithGrader(folder: string): boolean {
  if (!verdictForEveryCase(folder, "grader")) return false;
  const rates = agreement(folder, "grader");
  return rates.truePositiveRate >= LOWEST_RATE && rates.trueNegativeRate >= LOWEST_RATE;
}

// Line 1 of the scorecard: part one's rules on the hidden test inbox.
const lineOne = proveTheRecords.filter((rule) => rule.says.includes("test inbox"));

export default [
  {
    says: "NOTES.md answers What the eval caught and What I would measure next",
    test: notesAreWritten,
    tryNext: "write two to four sentences under each new heading in NOTES.md, from your own runs",
  },
  {
    says: `on the grader's 12 cases, the judge catches and keeps ${LOWEST_RATE * 100}% or more`,
    test: agreesWithGrader,
    tryNext:
      "run uv run python agreement.py here; show labelled dev cases as examples in the prompt",
  },
  {
    says: "no held-out or grader case is used as an example in the judge's prompt",
    test: (folder) => noLeakedExamples(folder, "grader"),
    tryNext: "take examples from kit/judge-cases/dev.jsonl only",
  },
  {
    says: "eval passes on your code and blocks the planted change",
    test: (folder) => passesAsItIs(folder) && blocksPlanted(folder),
    tryNext: "save evals/baseline.json from good code; eval must exit 1 when a mode gets worse",
  },
  ...lineOne,
] satisfies Rule[];
