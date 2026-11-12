import { sections, written } from "./lib/markdown";
import type { Rule } from "../scripts/verify";

const brief = (dir: string) => sections(dir, "brief.md");
const NAMES = ["job", "cost today", "truth", "metric", "never"];

export default [
  {
    says: "brief.md has the sections Job, Cost today, Truth, Metric and Never, each written",
    test: (dir) => NAMES.every((name) => written(brief(dir)[name])),
    tryNext: "replace every TODO in brief.md with a sentence or two of your own",
  },
  {
    says: "the Metric has a number and a direction",
    test: (dir) => {
      const metric = brief(dir).metric ?? "";
      return /\d/.test(metric) && /\b(at least|at most|zero|no more than|no fewer than|under|over|above|below)\b/i.test(metric);
    },
    tryNext: 'write the metric as a number with a direction, such as "at least 60% booked with no person"',
  },
  {
    says: "the Truth names the desk's records file, truth/dev.jsonl",
    test: (dir) => (brief(dir).truth ?? "").includes("truth/dev.jsonl"),
    tryNext: "name the file that holds the desk's own records: truth/dev.jsonl",
  },
  {
    says: "the Never line is about the product label",
    test: (dir) => /\blabel\b/i.test(brief(dir).never ?? ""),
    tryNext: "say what the system must never do with the label rate; open seed.json to see each label",
  },
] satisfies Rule[];
