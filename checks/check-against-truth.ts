import type { Rule } from "../scripts/verify";
import { hasVerb, type IntakeRun, intakeRuns } from "./lib/contract";

// True when every one of the three fresh dev runs passes the test.
async function everyRun(folder: string, passes: (run: IntakeRun) => boolean) {
  const runs = await intakeRuns(folder, "dev");
  return runs.every(passes);
}

export default [
  {
    says: "contract.toml names an intake verb",
    test: (folder) => hasVerb(folder, "intake"),
    tryNext: 'add intake = "uv run python intake.py" under [verbs] in contract.toml',
  },
  {
    says: "intake exits 0 on the dev inbox, 3 fresh runs out of 3",
    test: (folder) => everyRun(folder, (intake) => intake.run.code === 0),
    tryNext:
      "start uv run world serve in one terminal " +
      "and run uv run python intake.py in another to see the error",
  },
  {
    says: "every email ends up booked or with a person, once each",
    test: (folder) =>
      everyRun(folder, (intake) => intake.score.lost === 0 && intake.score.handledTwice === 0),
    tryNext:
      "make handle() book or send to review on every path, including when the reply cannot be read",
  },
  {
    says: "zero booked jobs differ from the desk's records",
    test: (folder) =>
      everyRun(folder, (intake) => intake.score.booked > 0 && intake.score.bookedWrong === 0),
    tryNext:
      "open the jobs board, find a booked job the desk would not book, " +
      "and add the rule that catches it",
  },
  {
    says: "zero jobs booked off label: above the label rate or on a crop the label does not cover",
    test: (folder) =>
      everyRun(folder, (intake) => intake.score.booked > 0 && intake.score.bookedOffLabel === 0),
    tryNext:
      "compare the rate with max_rate_l_per_ha and the field's crop " +
      "with the product's crops before booking",
  },
  {
    says: "at least 60% of emails are booked correctly with no person",
    test: (folder) => everyRun(folder, (intake) => intake.score.correctShare >= 0.6),
    tryNext: "look at the review queue: a rule that is too strict sends safe requests to a person",
  },
] satisfies Rule[];
