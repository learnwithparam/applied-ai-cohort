import type { Rule } from "../scripts/verify";
import { verbRuns } from "./build-the-elective";
import { sections, written } from "./lib/markdown";
import { agrees, metricValue } from "./measure-the-elective";

const tradeReport = (folder: string) => sections(folder, "trade.md");

// Every number in a piece of text. "65%" gives 0.65, and "$0.0000213" gives 0.0000213.
function allAmounts(text: string | undefined): number[] {
  const amounts: number[] = [];
  for (const match of (text ?? "").matchAll(/(\d+(?:\.\d+)?(?:e-?\d+)?)(\s*%)?/gi)) {
    const amount = Number(match[1]);
    if (match[2]) amounts.push(amount / 100);
    else amounts.push(amount);
  }
  return amounts;
}

// The first dev run of a verb, measured on one scorecard number.
async function firstRunValue(folder: string, verb: string, metric: string): Promise<number> {
  const runs = await verbRuns(folder, verb);
  return metricValue(metric, runs[0].score);
}

async function beforeAndAfter(folder: string, metric: string): Promise<[number, number]> {
  const before = await firstRunValue(folder, "intake", metric);
  const after = await firstRunValue(folder, "elective", metric);
  return [before, after];
}

// True when the section names both the before and the after value of the metric.
async function namesBothValues(folder: string, section: string, metric: string) {
  const amounts = allAmounts(tradeReport(folder)[section]);
  const values = await beforeAndAfter(folder, metric);
  return values.every((value) => amounts.some((amount) => agrees(amount, value)));
}

// The trade names the change in cost per correct booking as a percent, within 2 points.
async function namesTheChange(folder: string): Promise<boolean> {
  const text = tradeReport(folder)["the trade"] ?? "";
  if (!written(text, 15)) return false;
  const [before, after] = await beforeAndAfter(folder, "cost per correct booking");
  const changeInPoints = (Math.abs(after - before) / before) * 100;
  const percents = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((match) => Number(match[1]));
  return percents.some((percent) => Math.abs(percent - changeInPoints) <= 2);
}

export default [
  {
    says: "trade.md has the sections Quality, Cost per outcome and The trade, each written",
    test: (folder) => {
      const report = tradeReport(folder);
      const names = ["quality", "cost per outcome", "the trade"];
      return names.every((name) => written(report[name]));
    },
    tryNext: "replace every TODO in trade.md with your own sentences and numbers",
  },
  {
    says: "Quality gives the share booked correctly before and after, as measured on dev",
    test: (folder) => namesBothValues(folder, "quality", "share booked correctly"),
    tryNext: "write the share of dev emails booked right by intake.py and by elective.py, as a %",
  },
  {
    says: "Cost per outcome gives the cost per correct booking before and after, as measured",
    test: (folder) => namesBothValues(folder, "cost per outcome", "cost per correct booking"),
    tryNext: "copy per_correct_booking_usd from cost.py after each run, never your target",
  },
  {
    says: "The trade names the change in cost per correct booking as a percent, from the run",
    test: namesTheChange,
    tryNext:
      "divide the change in cost per correct booking by the Before number, and say what it bought",
  },
] satisfies Rule[];
