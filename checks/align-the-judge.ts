// Scores the learner's judge against a person's labels on cases it was not tuned on.
import { createHash } from "node:crypto";
import type { Rule } from "../scripts/verify";
import {
  type JudgeSplit,
  judgeCases,
  judgeRun,
  PART_TWO_KIT,
  verdictForEveryCase,
} from "./draft-a-judge";
import type { Row } from "./read-the-traces";

const LOWEST_RATE = 0.8;

// The person's label. The grader keeps only a hash of it, so try both answers.
function personPasses(row: Row): boolean {
  if (typeof row.pass === "boolean") return row.pass;
  const passHash = createHash("sha256").update(`${row.case_id}|pass`).digest("hex");
  return row.label_hash === passHash;
}

// A fail is what the judge is there to catch, so a fail counts as a positive.
export function agreement(folder: string, split: JudgeSplit, kit = PART_TWO_KIT) {
  const verdicts = judgeRun(folder, split, kit).verdicts;
  let caught = 0;
  let kept = 0;
  let personFails = 0;
  let personPassesCount = 0;
  for (const row of judgeCases(split, kit)) {
    const verdict = verdicts.get(String(row.case_id));
    if (personPasses(row)) {
      personPassesCount += 1;
      if (verdict === "pass") kept += 1;
    } else {
      personFails += 1;
      if (verdict === "fail") caught += 1;
    }
  }
  return { truePositiveRate: caught / personFails, trueNegativeRate: kept / personPassesCount };
}

// Every case that went into a prompt as an example, from the judge's call log.
export function exampleIds(folder: string, split: JudgeSplit, kit = PART_TWO_KIT): string[] {
  const loggedCalls = judgeRun(folder, split, kit).calls;
  return loggedCalls.flatMap((call) => (call.example_case_ids ?? []) as string[]);
}

export function noLeakedExamples(folder: string, split: JudgeSplit, kit = PART_TWO_KIT) {
  const kept = new Set(["held-out", "grader"].flatMap((name) => idsOf(name as JudgeSplit, kit)));
  return exampleIds(folder, split, kit).every((caseId) => !kept.has(caseId));
}

const idsOf = (split: JudgeSplit, kit: string) =>
  judgeCases(split, kit).map((row) => String(row.case_id));

export default [
  {
    says: "the judge gives a verdict for each of the 16 held-out cases",
    test: (folder) => verdictForEveryCase(folder, "held-out"),
    tryNext: "rerun bun run verify draft-a-judge on this folder and fix its FAIL lines first",
  },
  {
    says: `on held-out cases, the judge catches ${LOWEST_RATE * 100}% or more of a person's fails`,
    test: (folder) => agreement(folder, "held-out").truePositiveRate >= LOWEST_RATE,
    tryNext: "say what a fail looks like, and show the judge labelled dev cases as examples",
  },
  {
    says: `on held-out cases, the judge keeps ${LOWEST_RATE * 100}% or more of a person's passes`,
    test: (folder) => agreement(folder, "held-out").trueNegativeRate >= LOWEST_RATE,
    tryNext: "say what still counts as a pass, such as a short form or lower case field name",
  },
  {
    says: "no held-out case is used as an example in the judge's prompt",
    test: (folder) => noLeakedExamples(folder, "held-out"),
    tryNext: "take examples from kit/judge-cases/dev.jsonl only; held-out cases are for scoring",
  },
] satisfies Rule[];
