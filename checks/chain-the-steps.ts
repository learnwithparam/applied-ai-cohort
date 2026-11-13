// Runs the learner's chain verb on a fresh world and reads the trace it writes.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { hasVerb, runVerb, worldEnv } from "./lib/contract";
import { type Run, readJsonLines, type Score, score, startWorld } from "./lib/world";
import { emailIds, type Row } from "./route-the-inbox";

export type ChainRun = { run: Run; trace: Row[]; reviews: Row[]; score: Score };

async function runChainOnce(folder: string): Promise<ChainRun> {
  const world = await startWorld("dev");
  try {
    const run = runVerb(folder, "chain", { env: worldEnv(world) });
    const traceFile = join(world.runsDir, "trace.jsonl");
    const trace = existsSync(traceFile) ? readJsonLines(traceFile) : [];
    const { Database } = await import("bun:sqlite");
    const database = new Database(world.db, { readonly: true });
    const reviews = database.query("select * from review_queue").all() as Row[];
    database.close();
    return { run, trace, reviews, score: score(world, "dev") };
  } finally {
    world.stop();
  }
}

const savedRuns = new Map<string, Promise<ChainRun>>();

export function chainRun(folder: string): Promise<ChainRun> {
  let saved = savedRuns.get(folder);
  if (!saved) {
    saved = runChainOnce(folder);
    savedRuns.set(folder, saved);
  }
  return saved;
}

// The steps the trace holds for one email, in the order they ran.
export function stepsFor(trace: Row[], emailId: string): Row[] {
  return trace.filter((row) => row.run_id === emailId);
}

const sameJson = (first: unknown, second: unknown) =>
  JSON.stringify(first) === JSON.stringify(second);

function inputIsLastOutput(steps: Row[]): boolean {
  return steps.every(
    (step, position) => position === 0 || sameJson(step.input, steps[position - 1].output),
  );
}

async function threeStepsForEveryEmail(folder: string): Promise<boolean> {
  const { trace } = await chainRun(folder);
  return emailIds("dev").every((emailId) => {
    const names = stepsFor(trace, emailId).map((step) => step.step);
    return names.join(",") === "extract,check,draft";
  });
}

async function everyRowHasBoth(folder: string): Promise<boolean> {
  const { trace } = await chainRun(folder);
  return trace.length > 0 && trace.every((row) => "input" in row && "output" in row);
}

async function eachInputIsLastOutput(folder: string): Promise<boolean> {
  const { trace } = await chainRun(folder);
  return emailIds("dev").every((emailId) => inputIsLastOutput(stepsFor(trace, emailId)));
}

export default [
  {
    says: "contract.toml names a chain verb, and it exits 0 on the dev inbox",
    test: async (folder) => hasVerb(folder, "chain") && (await chainRun(folder)).run.code === 0,
    tryNext: "start uv run world serve, then run uv run python chain.py and read the error",
  },
  {
    says: "the trace holds extract, check and draft for every inbox email, in that order",
    test: threeStepsForEveryEmail,
    tryNext: "write one line to runs/trace.jsonl after each step, with the email id as run_id",
  },
  {
    says: "every trace line holds the step's input and its output",
    test: everyRowHasBoth,
    tryNext: 'write "input" and "output" on every line, so you can see where a value changed',
  },
  {
    says: "each step's input is the output of the step before it",
    test: eachInputIsLastOutput,
    tryNext: "pass each step's output straight into the next step, and trace exactly that",
  },
] satisfies Rule[];
