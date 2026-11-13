import type { Rule } from "../scripts/verify";
import { type IntakeRun, intakeRuns } from "./lib/contract";
import { sections, written } from "./lib/markdown";
import nameTheJob from "./name-the-job";

const BUDGET_USD = 0.01;

// True when every one of the three fresh runs on the hidden test inbox passes the test.
async function everyTestRun(folder: string, passes: (run: IntakeRun) => boolean) {
  const runs = await intakeRuns(folder, "test");
  return runs.every(passes);
}

function notesAreWritten(folder: string): boolean {
  const notes = sections(folder, "NOTES.md");
  const brokeFirst = written(notes["what broke first"], 20);
  const wouldChange = written(notes["what i would change before real users"], 20);
  return brokeFirst && wouldChange;
}

async function briefStillPasses(folder: string): Promise<boolean> {
  const results = await Promise.all(nameTheJob.map((rule) => rule.test(folder)));
  return results.every(Boolean);
}

function noWrongBookings(intake: IntakeRun): boolean {
  return intake.run.code === 0 && intake.score.booked > 0 && intake.score.bookedWrong === 0;
}

function safeAndHandledOnce(intake: IntakeRun): boolean {
  const score = intake.score;
  return score.bookedOffLabel === 0 && score.lost === 0 && score.handledTwice === 0;
}

function underBudget(intake: IntakeRun): boolean {
  return intake.score.calls > 0 && intake.score.costUsd < BUDGET_USD;
}

export default [
  {
    says: "NOTES.md answers What broke first and What I would change before real users",
    test: notesAreWritten,
    tryNext: "write two to four sentences under each heading in NOTES.md, from your own runs",
  },
  {
    says: "brief.md still passes every name-the-job rule",
    test: briefStillPasses,
    tryNext:
      "copy your brief.md from name-the-job into this folder, then run bun run verify name-the-job",
  },
  {
    says:
      "on the hidden test inbox, zero booked jobs differ from the desk's records, " +
      "over 3 fresh runs",
    test: (folder) => everyTestRun(folder, noWrongBookings),
    tryNext:
      "your rules must hold on emails you have not seen; a rule keyed to dev email ids fails here",
  },
  {
    says: "on the hidden test inbox, zero jobs booked off label and every email handled once",
    test: (folder) => everyTestRun(folder, safeAndHandledOnce),
    tryNext: "rerun bun run verify check-against-truth on this folder and fix its FAIL lines first",
  },
  {
    says: "on the hidden test inbox, at least 60% booked correctly with no person",
    test: (folder) => everyTestRun(folder, (intake) => intake.score.correctShare >= 0.6),
    tryNext: "check the review queue for safe requests your rules sent to a person",
  },
  {
    says: `the test inbox costs under $${BUDGET_USD} in model calls`,
    test: (folder) => everyTestRun(folder, underBudget),
    tryNext:
      "make one fast-role call per email; a retry loop or the smart role on every email costs more",
  },
] satisfies Rule[];
