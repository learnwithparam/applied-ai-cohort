// Reads evals/labels.jsonl: a person's pass or fail on each trace, with a note in their words.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { readJsonLines, WORLD_DIR } from "./lib/world";

export type Row = Record<string, unknown>;

// The traps whose record the desk had to fix by hand. A careful person fails these records.
const RECORDS_THE_DESK_FIXED = new Set(["acre", "ambiguous_field", "misspelled_product"]);
const LABEL_KEYS = new Set(["email_id", "pass", "note"]);

export function readRows(folder: string, file: string): Row[] {
  const path = join(folder, file);
  if (!existsSync(path)) return [];
  return readJsonLines(path);
}

export const labels = (folder: string) => readRows(folder, join("evals", "labels.jsonl"));

// The desk's record for each dev email, by email id.
export function devTruth(): Map<string, Row> {
  const rows = readJsonLines(join(WORLD_DIR, "truth", "dev.jsonl"));
  return new Map(rows.map((row) => [String(row.email_id), row]));
}

export function failedEmails(folder: string): string[] {
  const failed = labels(folder).filter((row) => row.pass === false);
  return failed.map((row) => String(row.email_id));
}

function namesEachDevEmailOnce(folder: string): boolean {
  const truth = devTruth();
  const emailIds = labels(folder).map((row) => String(row.email_id));
  const allKnown = emailIds.every((emailId) => truth.has(emailId));
  return allKnown && new Set(emailIds).size === emailIds.length;
}

function hasPassAndNote(row: Row): boolean {
  const noteWords = String(row.note ?? "")
    .split(/\s+/)
    .filter(Boolean);
  return typeof row.pass === "boolean" && noteWords.length >= 5;
}

function onlyOpenNotes(row: Row): boolean {
  return Object.keys(row).every((key) => LABEL_KEYS.has(key));
}

// A label agrees when it fails a record the desk fixed and passes a clean one. Records that
// copy an unsafe request faithfully can go either way.
function agreesWithDesk(row: Row, truth: Map<string, Row>): boolean {
  const trap = truth.get(String(row.email_id))?.trap;
  if (typeof trap === "string" && RECORDS_THE_DESK_FIXED.has(trap)) return row.pass === false;
  if (trap === null) return row.pass === true;
  return true;
}

function mostlyAgreesWithDesk(folder: string): boolean {
  const truth = devTruth();
  const rows = labels(folder);
  const agreeing = rows.filter((row) => agreesWithDesk(row, truth));
  return rows.length > 0 && agreeing.length / rows.length >= 0.9;
}

export default [
  {
    says: "evals/labels.jsonl has 30 or more rows",
    test: (folder) => labels(folder).length >= 30,
    tryNext:
      "run uv run python traces.py, then uv run python label.py, and label 30 traces or more",
  },
  {
    says: "each row names a dev email, and no email twice",
    test: namesEachDevEmailOnce,
    tryNext: "keep the email_id from each trace, such as TB-1006, and label each trace once",
  },
  {
    says: "each row has pass true or false and a note of 5 words or more",
    test: (folder) => labels(folder).every(hasPassAndNote),
    tryNext:
      'write what you saw in the note, such as "the email says L per acre, record says L/ha"',
  },
  {
    says: "rows hold only email_id, pass and note: no category picked before reading",
    test: (folder) => labels(folder).every(onlyOpenNotes),
    tryNext: "remove category keys; the failure modes come from your notes in the next step",
  },
  {
    says: "at least 5 rows are marked fail",
    test: (folder) => failedEmails(folder).length >= 5,
    tryNext: "compare each record with its email word by word; look hard at rates, units and names",
  },
  {
    says: "at least 90% of your labels agree with the desk's records",
    test: mostlyAgreesWithDesk,
    tryNext: "a record that names a field, product or unit the email did not say is a fail",
  },
] satisfies Rule[];
