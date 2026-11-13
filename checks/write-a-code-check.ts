// Runs the learner's eval verb and reads the pass rate it prints for each failure mode.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { goldenCases } from "./build-the-golden-set";
import { hasVerb, runVerb } from "./lib/contract";
import { calls, type Run } from "./lib/world";
import type { Row } from "./read-the-traces";

export type EvalRun = { run: Run; report: Row | undefined; calls: Row[] };

export function parseJson(printed: string): Row | undefined {
  try {
    return JSON.parse(printed.trim());
  } catch {
    // The verb printed something that is not JSON.
    return undefined;
  }
}

// Runs eval once in the given folder, with its own empty call log.
export function runEvalIn(folder: string): EvalRun {
  const runsDir = mkdtempSync(join(tmpdir(), "eval-runs-"));
  try {
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    const run = runVerb(folder, "eval", { env: { RUNS_DIR: runsDir } });
    return { run, report: parseJson(run.stdout), calls: calls(runsDir) };
  } finally {
    rmSync(runsDir, { recursive: true, force: true });
  }
}

const savedRuns = new Map<string, EvalRun>();

export function evalRun(folder: string): EvalRun {
  let saved = savedRuns.get(folder);
  if (!saved) {
    saved = runEvalIn(folder);
    savedRuns.set(folder, saved);
  }
  return saved;
}

export function passRates(run: EvalRun): Record<string, unknown> {
  const rates = run.report?.pass_rate_by_mode;
  if (typeof rates !== "object" || rates === null) return {};
  return rates as Record<string, unknown>;
}

const isRate = (value: unknown) => typeof value === "number" && value >= 0 && value <= 1;

function goldenModes(folder: string): string[] {
  const modes = goldenCases(folder).map((goldenCase) => String(goldenCase.mode));
  return [...new Set(modes)];
}

function oneCallPerCase(folder: string): boolean {
  const fastCalls = evalRun(folder).calls.filter((call) => call.role === "fast");
  const caseCount = goldenCases(folder).length;
  return caseCount > 0 && fastCalls.length === caseCount;
}

function everyModeHasRate(folder: string): boolean {
  const rates = passRates(evalRun(folder));
  const modes = goldenModes(folder);
  const withoutRate = modes.filter((mode) => !isRate(rates[mode]));
  return modes.length > 0 && withoutRate.length <= 1;
}

// The failure-mode cases were labelled fail by a person, so a code check that agrees fails them.
function agreesWithLabels(folder: string): boolean {
  const rates = passRates(evalRun(folder));
  if (rates.clean !== 1) return false;
  const failureRates = Object.entries(rates).filter(
    ([mode, rate]) => mode !== "clean" && isRate(rate),
  );
  return failureRates.length > 0 && failureRates.every(([, rate]) => Number(rate) <= 0.5);
}

export default [
  {
    says: "contract.toml names an eval verb",
    test: (folder) => hasVerb(folder, "eval"),
    tryNext: 'add eval = "uv run python eval.py" under [verbs] in contract.toml',
  },
  {
    says: "eval exits 0 and prints pass_rate_by_mode as JSON",
    test: (folder) => evalRun(folder).run.code === 0 && evalRun(folder).report !== undefined,
    tryNext: "run uv run python eval.py and read the error it prints",
  },
  {
    says: "eval runs every golden case through extract: one model call per case",
    test: oneCallPerCase,
    tryNext: "call read_request once for each line of evals/golden.jsonl; never copy old results",
  },
  {
    says: "every mode in golden.jsonl gets a pass rate from 0 to 1, except one left for a judge",
    test: everyModeHasRate,
    tryNext: "add one check to CODE_CHECKS for clean and for each mode code can judge",
  },
  {
    says: "your code checks agree with your labels: clean passes, each failure mode fails",
    test: agreesWithLabels,
    tryNext: "a check must look at what the mode is about; for rate-per-acre that is the unit too",
  },
] satisfies Rule[];
