import type { Rule } from "../scripts/verify";
import { intakeRuns } from "./lib/contract";
import { sections, written } from "./lib/markdown";
import nameTheJob from "./name-the-job";

const testRuns = (dir: string) => intakeRuns(dir, "test");
const BUDGET_USD = 0.01;

export default [
  {
    says: "NOTES.md answers What broke first and What I would change before real users",
    test: (dir) => {
      const notes = sections(dir, "NOTES.md");
      return (
        written(notes["what broke first"], 20) &&
        written(notes["what i would change before real users"], 20)
      );
    },
    tryNext: "write two to four sentences under each heading in NOTES.md, from your own runs",
  },
  {
    says: "brief.md still passes every name-the-job rule",
    test: async (dir) =>
      (await Promise.all(nameTheJob.map((rule) => rule.test(dir)))).every(Boolean),
    tryNext:
      "copy your brief.md from name-the-job into this folder, then run bun run verify name-the-job",
  },
  {
    says: "on the hidden test inbox, zero booked jobs differ from the desk's records, over 3 fresh runs",
    test: async (dir) =>
      (await testRuns(dir)).every(
        (run) => run.run.code === 0 && run.score.booked > 0 && run.score.booked_wrong === 0,
      ),
    tryNext:
      "your rules must hold on emails you have not seen; a rule keyed to dev email ids fails here",
  },
  {
    says: "on the hidden test inbox, zero jobs booked off label and every email handled once",
    test: async (dir) =>
      (await testRuns(dir)).every(
        (run) =>
          run.score.booked_off_label === 0 && run.score.lost === 0 && run.score.handled_twice === 0,
      ),
    tryNext: "rerun bun run verify check-against-truth on this folder and fix its FAIL lines first",
  },
  {
    says: "on the hidden test inbox, at least 60% booked correctly with no person",
    test: async (dir) => (await testRuns(dir)).every((run) => run.score.correct_share >= 0.6),
    tryNext: "check the review queue for safe requests your rules sent to a person",
  },
  {
    says: `the test inbox costs under $${BUDGET_USD} in model calls`,
    test: async (dir) =>
      (await testRuns(dir)).every((run) => run.score.calls > 0 && run.score.cost_usd < BUDGET_USD),
    tryNext:
      "make one fast-role call per email; a retry loop or the smart role on every email costs more",
  },
] satisfies Rule[];
