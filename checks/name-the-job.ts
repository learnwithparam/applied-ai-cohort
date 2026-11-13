import type { Rule } from "../scripts/verify";
import { sections, written } from "./lib/markdown";

const brief = (folder: string) => sections(folder, "brief.md");
const SECTION_NAMES = ["job", "cost today", "truth", "metric", "never"];

// Words that give a number its direction, as in "at least 60%" or "zero wrong".
const DIRECTION_WORDS =
  /\b(at least|at most|zero|no more than|no fewer than|under|over|above|below)\b/i;

function hasNumberAndDirection(folder: string): boolean {
  const metric = brief(folder).metric ?? "";
  return /\d/.test(metric) && DIRECTION_WORDS.test(metric);
}

export default [
  {
    says: "brief.md has the sections Job, Cost today, Truth, Metric and Never, each written",
    test: (folder) => SECTION_NAMES.every((name) => written(brief(folder)[name])),
    tryNext: "replace every TODO in brief.md with a sentence or two of your own",
  },
  {
    says: "the Metric has a number and a direction",
    test: hasNumberAndDirection,
    tryNext:
      'write the metric as a number with a direction, such as "at least 60% booked with no person"',
  },
  {
    says: "the Truth names the desk's records file, truth/dev.jsonl",
    test: (folder) => (brief(folder).truth ?? "").includes("truth/dev.jsonl"),
    tryNext: "name the file that holds the desk's own records: truth/dev.jsonl",
  },
  {
    says: "the Never line is about the product label",
    test: (folder) => /\blabel\b/i.test(brief(folder).never ?? ""),
    tryNext:
      "say what the system must never do with the label rate; open seed.json to see each label",
  },
] satisfies Rule[];
