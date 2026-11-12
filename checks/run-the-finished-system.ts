import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { python, type Score } from "./lib/world";

// The finished system's own score on the dev inbox, run once per check.
let finished: Score | undefined;
function finishedScore(): Score {
  if (!finished) {
    const run = python(["-m", "reference.finished", "--json"]);
    if (run.code !== 0) throw new Error(run.stdout + run.stderr);
    finished = JSON.parse(run.stdout);
  }
  return finished!;
}

const valueOf = (dir: string, label: string) => {
  const file = join(dir, "goal.md");
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8")
    .split("\n")
    .find((text) => text.startsWith(label));
  const number = line?.match(/:\s*(\d+)\s*$/);
  return number ? Number(number[1]) : undefined;
};

export default [
  {
    says: "goal.md has the number booked with no person, and it matches the finished system",
    test: (dir) => valueOf(dir, "Booked with no person") === finishedScore().booked_correct,
    tryNext: "run uv run finished and copy the first number after Booked with no person",
  },
  {
    says: "goal.md has the number booked wrong, and it matches the finished system",
    test: (dir) => valueOf(dir, "Booked wrong") === finishedScore().booked_wrong,
    tryNext: "run uv run finished and copy the number after Booked wrong",
  },
  {
    says: "goal.md has the number sent to a person, and it matches the finished system",
    test: (dir) => valueOf(dir, "Sent to a person") === finishedScore().sent_to_review,
    tryNext:
      "run uv run finished and copy the number after Sent to a person; the model alone would send none",
  },
] satisfies Rule[];
