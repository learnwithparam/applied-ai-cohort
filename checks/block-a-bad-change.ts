// Runs the learner's eval on their code as it is, then on a copy with the planted bad change.
import { copyFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Rule } from "../scripts/verify";
import { goldenCases } from "./build-the-golden-set";
import { PART_TWO_KIT } from "./draft-a-judge";
import { type EvalRun, evalRun, runEvalIn } from "./write-a-code-check";

// The copy sits beside the learner's folder, so their code still finds the part's kit/ folder.
function runEvalOnPlantedCopy(folder: string, kit: string): EvalRun {
  const copy = mkdtempSync(join(dirname(folder), ".planted-"));
  try {
    cpSync(folder, copy, { recursive: true });
    copyFileSync(join(kit, "planted", "extract.py"), join(copy, "extract.py"));
    return runEvalIn(copy);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}

const savedRuns = new Map<string, EvalRun>();

export function plantedRun(folder: string, kit = PART_TWO_KIT): EvalRun {
  const key = `${folder}|${kit}`;
  let saved = savedRuns.get(key);
  if (!saved) {
    saved = runEvalOnPlantedCopy(folder, kit);
    savedRuns.set(key, saved);
  }
  return saved;
}

function baselineCoversEveryMode(folder: string): boolean {
  const file = join(folder, "evals", "baseline.json");
  if (!existsSync(file)) return false;
  const baseline = JSON.parse(readFileSync(file, "utf8"));
  const modes = goldenCases(folder).map((goldenCase) => String(goldenCase.mode));
  return modes.length > 0 && modes.every((mode) => typeof baseline[mode] === "number");
}

export function namesCleanAsWorse(folder: string, kit = PART_TWO_KIT): boolean {
  const regressions = plantedRun(folder, kit).report?.regressions;
  return Array.isArray(regressions) && regressions.includes("clean");
}

export const passesAsItIs = (folder: string) => evalRun(folder).run.code === 0;
export const blocksPlanted = (folder: string, kit = PART_TWO_KIT) =>
  plantedRun(folder, kit).run.code === 1;

export default [
  {
    says: "evals/baseline.json holds a pass rate for every mode in golden.jsonl",
    test: baselineCoversEveryMode,
    tryNext: "add --save-baseline to eval.py, run it once on your good code, and commit the file",
  },
  {
    says: "eval exits 0 on your code as it is",
    test: passesAsItIs,
    tryNext: "save the baseline again from your current code, then run uv run python eval.py",
  },
  {
    says: "eval exits 1 when the planted change replaces extract.py",
    test: (folder) => blocksPlanted(folder),
    tryNext: "compare every mode in the baseline; a mode that is missing now counts as worse",
  },
  {
    says: "on the planted change, eval lists clean under regressions",
    test: (folder) => namesCleanAsWorse(folder),
    tryNext: 'print {"regressions": [...]} with each mode that passes fewer cases than before',
  },
] satisfies Rule[];
