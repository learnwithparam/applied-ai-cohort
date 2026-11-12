import type { Rule } from "../scripts/verify";
import { hasVerb, intakeRuns } from "./lib/contract";

type Cost = { total_usd: number; per_email_usd: number; per_correct_booking_usd: number };
const close = (left: number, right: number) =>
  Math.abs(left - right) <= Math.max(1e-9, Math.abs(right) * 0.01);

async function reports(dir: string) {
  return (await intakeRuns(dir, "dev", "cost")).map((run) => {
    let cost: Cost | undefined;
    try {
      cost = JSON.parse(run.extra?.stdout.trim() ?? "");
    } catch {
      /* not JSON */
    }
    return { cost, score: run.score, code: run.extra?.code ?? 2 };
  });
}

export default [
  {
    says: "contract.toml names a cost verb",
    test: (dir) => hasVerb(dir, "cost"),
    tryNext: 'add cost = "uv run python cost.py" under [verbs] in contract.toml',
  },
  {
    says: "after an intake run, cost prints total_usd, per_email_usd and per_correct_booking_usd as JSON",
    test: async (dir) =>
      (await reports(dir)).every(
        (report) =>
          report.code === 0 &&
          report.cost !== undefined &&
          ["total_usd", "per_email_usd", "per_correct_booking_usd"].every(
            (key) => typeof (report.cost as any)[key] === "number",
          ),
      ),
    tryNext:
      "run intake, then uv run python cost.py, and print one JSON object with the three numbers",
  },
  {
    says: "total_usd matches the sum of calls.jsonl",
    test: async (dir) =>
      (await reports(dir)).every(
        (report) => report.cost && close(report.cost.total_usd, report.score.cost_usd),
      ),
    tryNext: "add up cost_usd over every line of $RUNS_DIR/calls.jsonl",
  },
  {
    says: "per_email_usd is the total divided by the emails in the inbox",
    test: async (dir) =>
      (await reports(dir)).every(
        (report) =>
          report.cost &&
          close(report.cost.per_email_usd, report.score.cost_usd / report.score.emails),
      ),
    tryNext: "divide the total by the number of emails client.inbox() returns",
  },
  {
    says: "per_correct_booking_usd is the total divided by the jobs that match the desk's records",
    test: async (dir) =>
      (await reports(dir)).every(
        (report) =>
          report.cost &&
          close(
            report.cost.per_correct_booking_usd,
            report.score.cost_usd / report.score.booked_correct,
          ),
      ),
    tryNext:
      "count only booked jobs that match truth/dev.jsonl; an email sent to a person is not a correct booking",
  },
] satisfies Rule[];
