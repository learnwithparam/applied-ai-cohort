// The world's data holds together: every email has a truth row and a replay reply, the traps
// are where the brief says, and the finished system meets its own bar on both splits.
import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { python, WORLD_DIR } from "../checks/lib/world";

const lines = (file: string) =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
const emailIds = (split: string) =>
  readdirSync(join(WORLD_DIR, "inbox", split))
    .map((name) => name.replace(".txt", ""))
    .sort();

test("every email has a truth row and a replay reply", () => {
  const dev = lines(join(WORLD_DIR, "truth", "dev.jsonl"))
    .map((row) => row.email_id)
    .sort();
  const test = lines(join(WORLD_DIR, "truth", "test.hashes.jsonl"))
    .map((row) => row.email_id)
    .sort();
  expect(emailIds("dev")).toEqual(dev);
  expect(emailIds("test")).toEqual(test);
  for (const id of [...dev, ...test])
    expect(existsSync(join(WORLD_DIR, "replay", `${id}.json`))).toBe(true);
});

test("the dev split holds the traps the brief lists", () => {
  const counts: Record<string, number> = {};
  for (const row of lines(join(WORLD_DIR, "truth", "dev.jsonl")))
    counts[row.trap ?? "clean"] = (counts[row.trap ?? "clean"] ?? 0) + 1;
  expect(counts).toEqual({
    clean: 26,
    acre: 4,
    above_label: 3,
    ambiguous_field: 3,
    misspelled_product: 2,
    wrong_crop: 2,
  });
});

test("only the per-acre emails mention acres", () => {
  const acre = lines(join(WORLD_DIR, "truth", "dev.jsonl"))
    .filter((row) => row.trap === "acre")
    .map((row) => row.email_id)
    .sort();
  const mentions = emailIds("dev").filter((id) =>
    /\bacres?\b/i.test(readFileSync(join(WORLD_DIR, "inbox", "dev", `${id}.txt`), "utf8")),
  );
  expect(mentions).toEqual(acre);
});

test("the finished system books no wrong job and meets the bar on both splits", () => {
  for (const split of ["dev", "test"]) {
    const run = python(["-m", "reference.finished", "--json", "--split", split]);
    const score = JSON.parse(run.stdout);
    expect(score.booked_wrong).toBe(0);
    expect(score.booked_off_label).toBe(0);
    expect(score.lost).toBe(0);
    expect(score.correct_share).toBeGreaterThanOrEqual(0.6);
  }
});

test("a world reset is repeatable", () => {
  expect(python(["-m", "worlds", "reset", "--db", "/tmp/tallgrass-test.db"]).code).toBe(0);
  expect(python(["-m", "worlds", "reset", "--db", "/tmp/tallgrass-test.db"]).stdout).toContain(
    "8 growers, 17 fields, 6 products",
  );
});
