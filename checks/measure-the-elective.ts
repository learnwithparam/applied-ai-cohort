import type { Rule } from "../scripts/verify";
import { verbRuns } from "./build-the-elective";
import type { IntakeRun } from "./lib/contract";
import { written } from "./lib/markdown";
import type { Score } from "./lib/world";
import { electivePlan, firstAmount, namedMetric, target } from "./pick-an-elective";

const BUDGET_USD = 0.01;

// Two numbers agree when they are within 2% of each other, so a rounded number still agrees.
export function agrees(writtenNumber: number | undefined, measuredNumber: number): boolean {
  if (writtenNumber === undefined) return false;
  const allowedGap = Math.max(1e-12, Math.abs(measuredNumber) * 0.02);
  return Math.abs(writtenNumber - measuredNumber) <= allowedGap;
}

// The value of a scorecard metric in one scored run.
export function metricValue(metric: string, score: Score): number {
  if (metric === "total cost") return score.costUsd;
  if (metric === "model calls") return score.calls;
  if (metric === "share booked correctly") return score.correctShare;
  return score.costUsd / score.bookedCorrect;
}

// The metric named in elective.md, measured on every dev run of one verb.
export async function measured(folder: string, verb: string): Promise<number[]> {
  const metric = namedMetric(folder);
  if (!metric) return [];
  const runs = await verbRuns(folder, verb);
  return runs.map((run) => metricValue(metric, run.score));
}

async function writtenMatchesRuns(folder: string, section: string, verb: string) {
  const writtenNumber = firstAmount(electivePlan(folder)[section]);
  const values = await measured(folder, verb);
  if (values.length === 0) return false;
  return values.every((value) => agrees(writtenNumber, value));
}

function better(direction: "at most" | "at least", after: number, before: number): boolean {
  if (direction === "at most") return after < before;
  return after > before;
}

async function movedAndMetTarget(folder: string): Promise<boolean> {
  const chosenTarget = target(folder);
  const before = await measured(folder, "intake");
  const after = await measured(folder, "elective");
  if (!chosenTarget || before.length === 0) return false;
  const direction = chosenTarget.direction;
  const metTarget = after.every((value) => {
    if (direction === "at most") return value <= chosenTarget.amount;
    return value >= chosenTarget.amount;
  });
  const moved = after.every((value, index) => better(direction, value, before[index]));
  return metTarget && moved;
}

async function qualityHeld(folder: string): Promise<boolean> {
  const before = await verbRuns(folder, "intake");
  const after = await verbRuns(folder, "elective");
  return after.every((run, index) => run.score.correctShare >= before[index].score.correctShare);
}

function keepsLineOne(elective: IntakeRun): boolean {
  const score = elective.score;
  const safe = score.bookedWrong === 0 && score.bookedOffLabel === 0;
  const handledOnce = score.lost === 0 && score.handledTwice === 0;
  const enoughBooked = score.correctShare >= 0.6;
  const underBudget = score.costUsd < BUDGET_USD;
  return elective.run.code === 0 && safe && handledOnce && enoughBooked && underBudget;
}

async function lineOneOnTestInbox(folder: string): Promise<boolean> {
  const runs = await verbRuns(folder, "elective", "test");
  return runs.every(keepsLineOne);
}

export default [
  {
    says: "elective.md has a Before and an After section, each with a number",
    test: (folder) => {
      const plan = electivePlan(folder);
      const before = written(plan.before, 1) && firstAmount(plan.before) !== undefined;
      const after = written(plan.after, 1) && firstAmount(plan.after) !== undefined;
      return before && after;
    },
    tryNext: "write the number you measured under ## Before and under ## After in elective.md",
  },
  {
    says: "the Before number is your metric from the intake verb on the dev inbox",
    test: (folder) => writtenMatchesRuns(folder, "before", "intake"),
    tryNext: "reset the world, run intake.py, then cost.py, and copy the number your Metric names",
  },
  {
    says: "the After number is your metric from the elective verb on the dev inbox",
    test: (folder) => writtenMatchesRuns(folder, "after", "elective"),
    tryNext:
      "reset the world, run elective.py, then cost.py, and copy the number your Metric names",
  },
  {
    says: "the metric moved the better way and meets the Target",
    test: movedAndMetTarget,
    tryNext: "compare After with your Target; change the elective, or set a target you can defend",
  },
  {
    says: "the share booked correctly did not drop",
    test: qualityHeld,
    tryNext: "find the emails the elective now sends to a person that intake booked right",
  },
  {
    says:
      "on the hidden test inbox, the elective keeps line 1: zero wrong or off label, " +
      "every email handled once, at least 60% booked right, under $0.01",
    test: lineOneOnTestInbox,
    tryNext:
      "serve the test inbox and run elective.py; a rule that fits only dev emails fails here",
  },
] satisfies Rule[];
