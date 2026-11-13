// Reads evals/failure-modes.md: each mode's definition, count and emails, against the labels.
import type { Rule } from "../scripts/verify";
import { sections } from "./lib/markdown";
import { failedEmails } from "./read-the-traces";

export type FailureMode = { name: string; definition: string; count: number; emails: string[] };

function lineAfter(label: string, text: string): string {
  const found = text.match(new RegExp(`^${label}:\\s*(.*)$`, "m"));
  return found ? found[1].trim() : "";
}

// For example, "## rate-per-acre" then "Count: 4" gives { name: "rate-per-acre", count: 4, ... }.
export function failureModes(folder: string): FailureMode[] {
  const found = sections(folder, "evals/failure-modes.md");
  const modes: FailureMode[] = [];
  for (const [name, text] of Object.entries(found)) {
    if (/todo/i.test(name) || /TODO/.test(text)) continue;
    const countText = lineAfter("Count", text);
    const emails = lineAfter("Emails", text).match(/TB-\d+/g) ?? [];
    const definition = lineAfter("Definition", text);
    modes.push({
      name,
      definition,
      count: countText === "" ? Number.NaN : Number(countText),
      emails,
    });
  }
  return modes;
}

function isComplete(mode: FailureMode): boolean {
  const definitionWords = mode.definition.split(/\s+/).filter(Boolean);
  return definitionWords.length >= 5 && Number.isInteger(mode.count) && mode.emails.length > 0;
}

function everyFailureInOneMode(folder: string): boolean {
  const listed = failureModes(folder).flatMap((mode) => mode.emails);
  return failedEmails(folder).every(
    (emailId) => listed.filter((listedId) => listedId === emailId).length === 1,
  );
}

function everyListedEmailFailed(folder: string): boolean {
  const failed = new Set(failedEmails(folder));
  const listed = failureModes(folder).flatMap((mode) => mode.emails);
  return listed.length > 0 && listed.every((emailId) => failed.has(emailId));
}

export default [
  {
    says: "evals/failure-modes.md names 3 or more modes",
    test: (folder) => failureModes(folder).length >= 3,
    tryNext: "read the notes on your failed labels and group the ones that share one cause",
  },
  {
    says: "each mode has a Definition of 5 words or more, a Count and its Emails",
    test: (folder) => failureModes(folder).every(isComplete),
    tryNext: "copy the block in the starter file once for each mode and fill in all three lines",
  },
  {
    says: "each Count equals the number of emails listed under it",
    test: (folder) => failureModes(folder).every((mode) => mode.count === mode.emails.length),
    tryNext: "count the TB- ids on the Emails line and write that number after Count:",
  },
  {
    says: "every failed label in evals/labels.jsonl sits in exactly one mode",
    test: everyFailureInOneMode,
    tryNext:
      'list every email with "pass": false once; if one fits two modes, pick its first cause',
  },
  {
    says: "every email listed is one you labelled as a fail",
    test: everyListedEmailFailed,
    tryNext: "a mode counts failures only; take passed emails off the Emails lines",
  },
] satisfies Rule[];
