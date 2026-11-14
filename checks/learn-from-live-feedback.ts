import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { readLines, runScript, withCopy } from "./lib/mini";

type Case = { question?: string; expected?: string; source?: string };

const PRIVATE = /[\w.+-]+@[\w-]+\.[\w.-]+|\d{3}-\d{4}/;

type Outcome = { before: Case[]; after: Case[]; again: Case[]; ran: boolean };

// Runs promote.py twice on a copy, and reads the golden set before, after and after the second run.
function outcome(folder: string): Outcome {
  return withCopy(folder, (copy) => {
    const golden = join(copy, "golden.jsonl");
    const before = readLines(golden) as Case[];
    const ran = runScript(copy, ["promote.py"]);
    const after = readLines(golden) as Case[];
    runScript(copy, ["promote.py"]);
    const again = readLines(golden) as Case[];
    return { before, after, again, ran };
  });
}

const added = (found: Outcome) => found.after.slice(found.before.length);

export default [
  {
    says: "promote.py runs and keeps the cases that were already in the golden set",
    test: (folder) => {
      const found = outcome(folder);
      const kept = found.before.every((row, i) => found.after[i]?.question === row.question);
      return found.ran && kept;
    },
    tryNext: "read golden.jsonl first, keep every row, and only add new ones at the end",
  },
  {
    says: "each thumbs-down with a fix is added once, and thumbs-up or no fix are left out",
    test: (folder) => {
      const found = outcome(folder);
      const fixes = added(found).map((row) => row.expected);
      return fixes.length === 3 && fixes.every((fix) => Boolean(fix));
    },
    tryNext: "add a row only when thumb is down and fix is not empty; skip repeated questions",
  },
  {
    says: "a question that repeats with other spacing or capitals is counted once",
    test: (folder) => {
      const questions = added(outcome(folder)).map((row) => row.question?.toLowerCase() ?? "");
      return questions.filter((question) => question.includes("stemshure")).length === 1;
    },
    tryNext: "compare questions in lower case, with the spaces squeezed together",
  },
  {
    says: "no email address or phone number reaches the golden set",
    test: (folder) => {
      const rows = added(outcome(folder));
      const withText = rows.length > 0;
      return withText && rows.every((row) => !PRIVATE.test(`${row.question} ${row.expected}`));
    },
    tryNext: 'replace each email and phone number with a tag such as "<email>" before you save',
  },
  {
    says: 'new cases say source "live", and a second run adds nothing',
    test: (folder) => {
      const found = outcome(folder);
      const rows = added(found);
      return rows.length > 0 && rows.every((row) => row.source === "live") &&
        found.again.length === found.after.length;
    },
    tryNext: 'write source: "live" on each new row, and skip a question the set already holds',
  },
] satisfies Rule[];
