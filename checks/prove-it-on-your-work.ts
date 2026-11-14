import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { sections, written } from "./lib/markdown";
import { readLines } from "./lib/mini";

type Case = { question?: string; expected?: string; kind?: string };
type Tally = { passed?: number; total?: number };
type Results = { before?: Tally; after?: Tally; failures?: { case?: string; why?: string }[] };

const MOST_CASES_NEEDED = 10;
const COURSE_WORDS = /\b(TB-\d+|Tallgrass|Stemshure|Cropguard|spray desk)\b/i;
const PAGES = ["job", "number", "fix", "evidence", "next"];

function goldenCases(folder: string): Case[] {
  try {
    return readLines(join(folder, "golden.jsonl")) as Case[];
  } catch {
    // A line that is not JSON means the file is not a golden set yet.
    return [];
  }
}

function results(folder: string): Results | undefined {
  const file = join(folder, "results.json");
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Results;
  } catch {
    // A file that is not JSON cannot hold results.
    return undefined;
  }
}

const isWritten = (text: string | undefined) => written(text ?? "", 3);

export default [
  {
    says: "golden.jsonl has ten different cases, in two kinds or more, none from the spray desk",
    test: (folder) => {
      const cases = goldenCases(folder);
      const questions = new Set(cases.map((item) => (item.question ?? "").trim().toLowerCase()));
      const kinds = new Set(cases.map((item) => item.kind));
      const filled = cases.every((item) => isWritten(item.question) && written(item.expected, 1));
      const text = existsSync(join(folder, "golden.jsonl"))
        ? readFileSync(join(folder, "golden.jsonl"), "utf8")
        : "";
      const enough = questions.size >= MOST_CASES_NEEDED && kinds.size >= 2;
      return enough && filled && !COURSE_WORDS.test(text);
    },
    tryNext: "add real cases from your own job until you have ten, with at least two kinds",
  },
  {
    says: "results.json totals match your case count, and more cases pass after than before",
    test: (folder) => {
      const found = results(folder);
      const count = goldenCases(folder).length;
      const [before, after] = [found?.before, found?.after];
      if (!before || !after || count === 0) return false;
      const totalsMatch = before.total === count && after.total === count;
      return totalsMatch && Number(after.passed) > Number(before.passed);
    },
    tryNext: "run your cases before and after one fix, and write how many passed each time",
  },
  {
    says: "each case that still fails is listed with a reason, and comes from your golden file",
    test: (folder) => {
      const found = results(folder);
      const questions = new Set(goldenCases(folder).map((item) => item.question));
      const failures = found?.failures ?? [];
      const stillFailing = Number(found?.after?.total) - Number(found?.after?.passed);
      const listed = failures.length === stillFailing;
      const known = failures.every((item) => questions.has(item.case) && isWritten(item.why));
      return Boolean(found) && listed && known;
    },
    tryNext: "list every case that still fails after the fix: its question and why it fails",
  },
  {
    says: "CAPSTONE.md has all five sections written",
    test: (folder) => {
      const page = sections(folder, "CAPSTONE.md");
      return PAGES.every((name) => written(page[name], 5));
    },
    tryNext: "replace each TODO line with a few sentences of your own",
  },
  {
    says: "its Number section states the same before and after counts as results.json",
    test: (folder) => {
      const found = results(folder);
      const numbers = (sections(folder, "CAPSTONE.md").number ?? "").match(/\d+/g) ?? [];
      const wanted = [found?.before?.passed, found?.after?.passed, found?.after?.total];
      if (!found || wanted.some((value) => value === undefined)) return false;
      return wanted.every((value) => numbers.includes(String(value)));
    },
    tryNext: "write the before count, the after count and the total in the Number section",
  },
  {
    says: "its Evidence section names golden.jsonl and results.json",
    test: (folder) => {
      const evidence = sections(folder, "CAPSTONE.md").evidence ?? "";
      const named = evidence.includes("golden.jsonl") && evidence.includes("results.json");
      return (
        named &&
        existsSync(join(folder, "golden.jsonl")) &&
        existsSync(join(folder, "results.json"))
      );
    },
    tryNext: "name both files in Evidence, and keep them next to CAPSTONE.md",
  },
] satisfies Rule[];
