import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { sections, written } from "./lib/markdown";
import { firstAmount } from "./pick-an-elective";

type Case = { name: string; correct: boolean; cost: number };

const MOST_ROWS_NEEDED = 10;
const COURSE_WORDS = /\b(TB-\d+|Tallgrass|Stemshure|Cropguard|spray desk)\b/i;

// What each metric name measures, and which way counts as better.
const METRICS = {
  "share correct": "at least",
  "cost per correct": "at most",
  "total cost": "at most",
} as const;
type MetricName = keyof typeof METRICS;

function readCases(folder: string): Case[] | undefined {
  const file = join(folder, "cases.csv");
  if (!existsSync(file)) return undefined;
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
  if (lines[0]?.trim() !== "case,correct,cost_usd") return undefined;
  const cases: Case[] = [];
  for (const line of lines.slice(1)) {
    const [name, correct, cost] = line.split(",").map((part) => part.trim());
    const dollars = Number(cost);
    const answer = (correct ?? "").toLowerCase();
    if (!name || !["yes", "no"].includes(answer) || Number.isNaN(dollars) || dollars < 0) {
      return undefined;
    }
    cases.push({ name, correct: answer === "yes", cost: dollars });
  }
  return cases;
}

function measured(cases: Case[], metric: MetricName): number | undefined {
  const right = cases.filter((item) => item.correct).length;
  const total = cases.reduce((sum, item) => sum + item.cost, 0);
  if (metric === "share correct") return right / cases.length;
  if (metric === "total cost") return total;
  return right === 0 ? undefined : total / right;
}

function namedMetric(folder: string): MetricName | undefined {
  const text = (sections(folder, "brief.md").metric ?? "").toLowerCase();
  const found = (Object.keys(METRICS) as MetricName[]).filter((name) => text.includes(name));
  return found.length === 1 ? found[0] : undefined;
}

function direction(text: string): "at least" | "at most" | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("at least")) return "at least";
  if (lower.includes("at most")) return "at most";
  return undefined;
}

const BRIEF_SECTIONS = ["capability", "your data", "metric", "baseline", "target", "evidence"];

export default [
  {
    says: "cases.csv has at least ten cases with a name, yes or no, and a cost",
    test: (folder) => (readCases(folder)?.length ?? 0) >= MOST_ROWS_NEEDED,
    tryNext:
      "use the header case,correct,cost_usd and one row per case, with yes or no in the middle",
  },
  {
    says: "none of the cases come from the spray desk",
    test: (folder) => {
      const file = join(folder, "cases.csv");
      return readCases(folder) !== undefined && !COURSE_WORDS.test(readFileSync(file, "utf8"));
    },
    tryNext: "replace the sample rows with cases from your own work",
  },
  {
    says: "every section of brief.md is written",
    test: (folder) => {
      const brief = sections(folder, "brief.md");
      return BRIEF_SECTIONS.every((name) => written(brief[name], 2));
    },
    tryNext: "replace each TODO line with a sentence of your own",
  },
  {
    says: "the Baseline matches what your own cases give for the metric you named",
    test: (folder) => {
      const cases = readCases(folder);
      const metric = namedMetric(folder);
      if (!cases || cases.length === 0 || !metric) return false;
      const actual = measured(cases, metric);
      const claimed = firstAmount(sections(folder, "brief.md").baseline);
      if (actual === undefined || claimed === undefined) return false;
      return Math.abs(actual - claimed) <= Math.abs(actual) * 0.01 + 1e-9;
    },
    tryNext: "name one metric, run measure.py on your cases.csv, and copy that number",
  },
  {
    says: "the Target points the right way and beats the Baseline",
    test: (folder) => {
      const metric = namedMetric(folder);
      const brief = sections(folder, "brief.md");
      const claimed = firstAmount(brief.baseline);
      const wanted = firstAmount(brief.target);
      const way = direction(brief.target ?? "");
      if (!metric || claimed === undefined || wanted === undefined) return false;
      if (way !== METRICS[metric]) return false;
      return way === "at least" ? wanted > claimed : wanted < claimed;
    },
    tryNext:
      "a share goes up, so say at least and a bigger number; a cost goes down, so say at most",
  },
  {
    says: "the Evidence names cases.csv, and the file exists",
    test: (folder) => {
      const evidence = sections(folder, "brief.md").evidence ?? "";
      return evidence.includes("cases.csv") && existsSync(join(folder, "cases.csv"));
    },
    tryNext: "write the file name cases.csv in the Evidence section",
  },
] satisfies Rule[];
