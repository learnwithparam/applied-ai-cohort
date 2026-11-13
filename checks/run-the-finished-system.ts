import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { parseScore, python, type Score } from "./lib/world";

// The finished system's own score on the dev inbox, run once and kept for every rule.
let savedScore: Score | undefined;

function finishedScore(): Score {
  if (savedScore) return savedScore;
  const run = python(["-m", "reference.finished", "--json"]);
  if (run.code !== 0) throw new Error(run.stdout + run.stderr);
  savedScore = parseScore(run.stdout);
  return savedScore;
}

// The number at the end of the goal.md line that starts with the label.
// For example, "Booked wrong: 0" gives 0.
function numberAfter(folder: string, label: string): number | undefined {
  const file = join(folder, "goal.md");
  if (!existsSync(file)) return undefined;
  const lines = readFileSync(file, "utf8").split("\n");
  const line = lines.find((text) => text.startsWith(label));
  const number = line?.match(/:\s*(\d+)\s*$/);
  if (!number) return undefined;
  return Number(number[1]);
}

export default [
  {
    says: "goal.md has the number booked with no person, and it matches the finished system",
    test: (folder) =>
      numberAfter(folder, "Booked with no person") === finishedScore().bookedCorrect,
    tryNext: "run uv run finished and copy the first number after Booked with no person",
  },
  {
    says: "goal.md has the number booked wrong, and it matches the finished system",
    test: (folder) => numberAfter(folder, "Booked wrong") === finishedScore().bookedWrong,
    tryNext: "run uv run finished and copy the number after Booked wrong",
  },
  {
    says: "goal.md has the number sent to a person, and it matches the finished system",
    test: (folder) => numberAfter(folder, "Sent to a person") === finishedScore().sentToReview,
    tryNext:
      "run uv run finished and copy the number after Sent to a person; " +
      "the model alone would send none",
  },
] satisfies Rule[];
