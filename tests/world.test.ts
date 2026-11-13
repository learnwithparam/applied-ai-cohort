// The world's data holds together: every email has a truth row and a replay reply, the traps
// are where the brief says, and the finished system meets its own bar on both splits.
import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseScore, python, readJsonLines, WORLD_DIR } from "../checks/lib/world";

const devTruth = () => readJsonLines(join(WORLD_DIR, "truth", "dev.jsonl"));

function emailIdsInRows(file: string): string[] {
  const rows = readJsonLines(join(WORLD_DIR, "truth", file));
  const emailIds = rows.map((row) => String(row.email_id));
  return emailIds.sort();
}

function emailIdsInInbox(split: string): string[] {
  const fileNames = readdirSync(join(WORLD_DIR, "inbox", split));
  const emailIds = fileNames.map((name) => name.replace(".txt", ""));
  return emailIds.sort();
}

function mentionsAcres(emailId: string): boolean {
  const text = readFileSync(join(WORLD_DIR, "inbox", "dev", `${emailId}.txt`), "utf8");
  return /\bacres?\b/i.test(text);
}

test("every email has a truth row and a replay reply", () => {
  const devIds = emailIdsInRows("dev.jsonl");
  const testIds = emailIdsInRows("test.hashes.jsonl");
  expect(emailIdsInInbox("dev")).toEqual(devIds);
  expect(emailIdsInInbox("test")).toEqual(testIds);
  for (const emailId of [...devIds, ...testIds]) {
    expect(existsSync(join(WORLD_DIR, "replay", `${emailId}.json`))).toBe(true);
  }
});

test("the dev split holds the traps the brief lists", () => {
  const counts = new Map<string, number>();
  for (const row of devTruth()) {
    const trap = String(row.trap ?? "clean");
    counts.set(trap, (counts.get(trap) ?? 0) + 1);
  }
  const expectedCounts: [string, number][] = [
    ["clean", 26],
    ["acre", 4],
    ["above_label", 3],
    ["ambiguous_field", 3],
    ["misspelled_product", 2],
    ["wrong_crop", 2],
  ];
  expect(Object.fromEntries(counts)).toEqual(Object.fromEntries(expectedCounts));
});

test("only the per-acre emails mention acres", () => {
  const acreRows = devTruth().filter((row) => row.trap === "acre");
  const acreIds = acreRows.map((row) => String(row.email_id)).sort();
  const mentions = emailIdsInInbox("dev").filter(mentionsAcres);
  expect(mentions).toEqual(acreIds);
});

test("the finished system books no wrong job and meets the bar on both splits", () => {
  for (const split of ["dev", "test"]) {
    const run = python(["-m", "reference.finished", "--json", "--split", split]);
    const score = parseScore(run.stdout);
    expect(score.bookedWrong).toBe(0);
    expect(score.bookedOffLabel).toBe(0);
    expect(score.lost).toBe(0);
    expect(score.correctShare).toBeGreaterThanOrEqual(0.6);
  }
});

test("a world reset is repeatable", () => {
  const resetCommand = ["-m", "worlds", "reset", "--db", "/tmp/tallgrass-test.db"];
  expect(python(resetCommand).code).toBe(0);
  expect(python(resetCommand).stdout).toContain("8 growers, 17 fields, 6 products");
});
