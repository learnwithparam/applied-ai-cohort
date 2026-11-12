import type { Rule } from "../scripts/verify";
import { hasVerb, intakeRuns } from "./lib/contract";
import type { Score } from "./lib/world";

// The learner's cost verb prints these three numbers, in snake_case, as JSON.
const COST_KEYS = ["total_usd", "per_email_usd", "per_correct_booking_usd"];
type Cost = Record<string, unknown>;
type CostReport = { cost: Cost | undefined; score: Score; code: number };

// Two amounts agree when they are within 1% of each other.
// A missing amount never agrees. Null counts as zero, the way JavaScript subtracts it.
function close(learnerAmount: unknown, rightAmount: number): boolean {
  const allowedGap = Math.max(1e-9, Math.abs(rightAmount) * 0.01);
  return Math.abs(Number(learnerAmount) - rightAmount) <= allowedGap;
}

function parseCost(printed: string | undefined): Cost | undefined {
  try {
    return JSON.parse(printed?.trim() ?? "");
  } catch {
    // The cost verb printed something that is not JSON.
    return undefined;
  }
}

// Runs intake, then cost, on three fresh dev worlds.
async function reports(folder: string): Promise<CostReport[]> {
  const runs = await intakeRuns(folder, "dev", "cost");
  return runs.map((intake) => {
    const cost = parseCost(intake.extra?.stdout);
    return { cost, score: intake.score, code: intake.extra?.code ?? 2 };
  });
}

function printsAllThree(report: CostReport): boolean {
  if (report.code !== 0 || report.cost === undefined) return false;
  const cost = report.cost;
  return COST_KEYS.every((key) => typeof cost[key] === "number");
}

async function everyReport(folder: string, passes: (report: CostReport) => boolean) {
  const allReports = await reports(folder);
  return allReports.every(passes);
}

export default [
  {
    says: "contract.toml names a cost verb",
    test: (folder) => hasVerb(folder, "cost"),
    tryNext: 'add cost = "uv run python cost.py" under [verbs] in contract.toml',
  },
  {
    says:
      "after an intake run, cost prints total_usd, per_email_usd " +
      "and per_correct_booking_usd as JSON",
    test: (folder) => everyReport(folder, printsAllThree),
    tryNext:
      "run intake, then uv run python cost.py, and print one JSON object with the three numbers",
  },
  {
    says: "total_usd matches the sum of calls.jsonl",
    test: (folder) =>
      everyReport(folder, (report) => close(report.cost?.total_usd, report.score.costUsd)),
    tryNext: "add up cost_usd over every line of $RUNS_DIR/calls.jsonl",
  },
  {
    says: "per_email_usd is the total divided by the emails in the inbox",
    test: (folder) =>
      everyReport(folder, (report) => {
        const perEmail = report.score.costUsd / report.score.emails;
        return close(report.cost?.per_email_usd, perEmail);
      }),
    tryNext: "divide the total by the number of emails client.inbox() returns",
  },
  {
    says: "per_correct_booking_usd is the total divided by the jobs that match the desk's records",
    test: (folder) =>
      everyReport(folder, (report) => {
        const perCorrectBooking = report.score.costUsd / report.score.bookedCorrect;
        return close(report.cost?.per_correct_booking_usd, perCorrectBooking);
      }),
    tryNext:
      "count only booked jobs that match truth/dev.jsonl; " +
      "an email sent to a person is not a correct booking",
  },
] satisfies Rule[];
