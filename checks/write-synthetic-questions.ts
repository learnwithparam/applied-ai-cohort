import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { readLines, runScript, withCopy } from "./lib/mini";

// biome-ignore lint/style/useNamingConvention: the learner's file uses snake_case keys.
type Row = { question?: string; passage_id?: string; source?: string };
type Passage = { id: string; text: string };

const SHARED_RUN = 6;

const wordsOf = (text: string) => text.toLowerCase().match(/\w+/g) ?? [];

function windows(text: string): Set<string> {
  const words = wordsOf(text);
  const found = new Set<string>();
  for (let i = 0; i + SHARED_RUN <= words.length; i++) {
    found.add(words.slice(i, i + SHARED_RUN).join(" "));
  }
  return found;
}

type Outcome = { rows: Row[]; passages: Passage[]; goldenBefore: string; goldenAfter: string };

function outcome(folder: string): Outcome {
  return withCopy(folder, (copy) => {
    const goldenFile = join(copy, "golden.jsonl");
    const goldenBefore = readFileSync(goldenFile, "utf8");
    runScript(copy, ["make_questions.py"]);
    const rows = readLines(join(copy, "synthetic.jsonl")) as Row[];
    const passages = readLines(join(copy, "passages.jsonl")) as Passage[];
    return { rows, passages, goldenBefore, goldenAfter: readFileSync(goldenFile, "utf8") };
  });
}

const rowsFor = (found: Outcome, passage: Passage) =>
  found.rows.filter((row) => row.passage_id === passage.id);

export default [
  {
    says: "every passage has two questions, and each ends with a question mark",
    test: (folder) => {
      const found = outcome(folder);
      const twoEach = found.passages.every((passage) => rowsFor(found, passage).length === 2);
      return twoEach && found.rows.every((row) => row.question?.trim().endsWith("?"));
    },
    tryNext: "keep a draft only if it ends with ?, and stop at two kept questions per passage",
  },
  {
    says: "no question shares six words in a row with its passage",
    test: (folder) => {
      const found = outcome(folder);
      const copies = found.passages.some((passage) => {
        const passageRuns = windows(passage.text);
        const questions = rowsFor(found, passage).map((row) => row.question ?? "");
        return questions.some((question) =>
          [...windows(question)].some((run) => passageRuns.has(run)),
        );
      });
      return found.rows.length > 0 && !copies;
    },
    tryNext: "drop a draft when any six words in a row also appear in the passage",
  },
  {
    says: "no question repeats another, ignoring capitals and spaces",
    test: (folder) => {
      const found = outcome(folder);
      const keys = found.rows.map((row) => wordsOf(row.question ?? "").join(" "));
      return keys.length > 0 && new Set(keys).size === keys.length;
    },
    tryNext: "keep a set of cleaned questions and skip a draft whose cleaned text is in it",
  },
  {
    says: 'each row says source "synthetic" and names a real passage',
    test: (folder) => {
      const found = outcome(folder);
      const ids = new Set(found.passages.map((passage) => passage.id));
      const labelled = found.rows.every((row) => row.source === "synthetic");
      return (
        found.rows.length > 0 &&
        labelled &&
        found.rows.every((row) => ids.has(row.passage_id ?? ""))
      );
    },
    tryNext: 'write {"question": ..., "passage_id": ..., "source": "synthetic"} on each line',
  },
  {
    says: "golden.jsonl is unchanged",
    test: (folder) => {
      const found = outcome(folder);
      return found.rows.length > 0 && found.goldenBefore === found.goldenAfter;
    },
    tryNext: "write only to synthetic.jsonl; real questions and made-up ones stay in two files",
  },
] satisfies Rule[];
