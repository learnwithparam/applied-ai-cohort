import type { Rule } from "../scripts/verify";
import { hasVerb, intakeRuns } from "./lib/contract";

const runs = (dir: string) => intakeRuns(dir, "dev");

export default [
  {
    says: "contract.toml names an intake verb",
    test: (dir) => hasVerb(dir, "intake"),
    tryNext: 'add intake = "uv run python intake.py" under [verbs] in contract.toml',
  },
  {
    says: "intake exits 0 on the dev inbox, 3 fresh runs out of 3",
    test: async (dir) => (await runs(dir)).every((run) => run.run.code === 0),
    tryNext:
      "start uv run world serve in one terminal and run uv run python intake.py in another to see the error",
  },
  {
    says: "every email ends up booked or with a person, once each",
    test: async (dir) =>
      (await runs(dir)).every((run) => run.score.lost === 0 && run.score.handled_twice === 0),
    tryNext:
      "make handle() book or send to review on every path, including when the reply cannot be read",
  },
  {
    says: "zero booked jobs differ from the desk's records",
    test: async (dir) =>
      (await runs(dir)).every((run) => run.score.booked > 0 && run.score.booked_wrong === 0),
    tryNext:
      "open the jobs board, find a booked job the desk would not book, and add the rule that catches it",
  },
  {
    says: "zero jobs booked off label: above the label rate or on a crop the label does not cover",
    test: async (dir) =>
      (await runs(dir)).every((run) => run.score.booked > 0 && run.score.booked_off_label === 0),
    tryNext:
      "compare the rate with max_rate_l_per_ha and the field's crop with the product's crops before booking",
  },
  {
    says: "at least 60% of emails are booked correctly with no person",
    test: async (dir) => (await runs(dir)).every((run) => run.score.correct_share >= 0.6),
    tryNext: "look at the review queue: a rule that is too strict sends safe requests to a person",
  },
] satisfies Rule[];
