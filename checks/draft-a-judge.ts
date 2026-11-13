// Runs the learner's judge verb on the kit's judge cases and reads its verdicts.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { hasVerb, runVerb } from "./lib/contract";
import { calls, readJsonLines } from "./lib/world";
import type { Row } from "./read-the-traces";
import { parseJson } from "./write-a-code-check";

export const PART_TWO_KIT = join(ROOT, "parts", "02-measure-before-you-change", "kit");

export type JudgeSplit = "dev" | "held-out" | "grader";
export type JudgeRun = { code: number; verdicts: Map<string, unknown>; calls: Row[] };

export function judgeCases(split: JudgeSplit, kit = PART_TWO_KIT): Row[] {
  return readJsonLines(join(kit, "judge-cases", `${split}.jsonl`));
}

// The judge reads each case without its label.
function casesWithoutLabels(cases: Row[]) {
  return cases.map((row) => {
    const { pass: _pass, label_hash: _labelHash, ...withoutLabel } = row;
    return withoutLabel;
  });
}

function verdictsFrom(printed: string): Map<string, unknown> {
  const parsed = parseJson(printed);
  const verdicts = new Map<string, unknown>();
  if (!Array.isArray(parsed)) return verdicts;
  for (const item of parsed as Row[]) verdicts.set(String(item.case_id), item.verdict);
  return verdicts;
}

function runJudgeOnce(folder: string, split: JudgeSplit, kit: string): JudgeRun {
  const runsDir = mkdtempSync(join(tmpdir(), "judge-runs-"));
  try {
    const stdin = casesWithoutLabels(judgeCases(split, kit));
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    const run = runVerb(folder, "judge", { stdin, env: { RUNS_DIR: runsDir } });
    return { code: run.code, verdicts: verdictsFrom(run.stdout), calls: calls(runsDir) };
  } finally {
    rmSync(runsDir, { recursive: true, force: true });
  }
}

const savedRuns = new Map<string, JudgeRun>();

export function judgeRun(folder: string, split: JudgeSplit, kit = PART_TWO_KIT): JudgeRun {
  const key = `${folder}|${split}|${kit}`;
  let saved = savedRuns.get(key);
  if (!saved) {
    saved = runJudgeOnce(folder, split, kit);
    savedRuns.set(key, saved);
  }
  return saved;
}

export function verdictForEveryCase(folder: string, split: JudgeSplit, kit = PART_TWO_KIT) {
  const run = judgeRun(folder, split, kit);
  const cases = judgeCases(split, kit);
  return run.code === 0 && cases.every((row) => run.verdicts.has(String(row.case_id)));
}

function onlyPassOrFail(folder: string): boolean {
  const verdicts = [...judgeRun(folder, "dev").verdicts.values()];
  return (
    verdicts.length > 0 && verdicts.every((verdict) => verdict === "pass" || verdict === "fail")
  );
}

function oneJudgeCallPerCase(folder: string): boolean {
  const judgeCalls = judgeRun(folder, "dev").calls.filter((call) => call.role === "judge");
  return judgeCalls.length === judgeCases("dev").length;
}

function saysBoth(folder: string): boolean {
  const verdicts = [...judgeRun(folder, "dev").verdicts.values()];
  return verdicts.includes("pass") && verdicts.includes("fail");
}

export default [
  {
    says: "contract.toml names a judge verb",
    test: (folder) => hasVerb(folder, "judge"),
    tryNext: 'add judge = "uv run python judge.py" under [verbs] in contract.toml',
  },
  {
    says: "judge exits 0 on the 16 dev cases and gives a verdict for each one",
    test: (folder) => verdictForEveryCase(folder, "dev"),
    tryNext: "run the judge yourself: see the Walkthrough command in this step's README",
  },
  {
    says: 'every verdict is "pass" or "fail", never a score from 1 to 5',
    test: onlyPassOrFail,
    tryNext: "ask the model for PASS or FAIL, then turn the first word of its reply into a verdict",
  },
  {
    says: "the judge makes one call to the judge role per case",
    test: oneJudgeCallPerCase,
    tryNext: "call ask_judge once for each case, with the case's whole email in the prompt",
  },
  {
    says: "the judge says pass at least once and fail at least once",
    test: saysBoth,
    tryNext: "a judge that gives one answer to everything measures nothing; read its replies",
  },
] satisfies Rule[];
