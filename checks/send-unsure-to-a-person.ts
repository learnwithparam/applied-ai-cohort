// Reads the learner's routes again after a confidence threshold: nothing wrong is routed with
// no person, and not everything goes to a person.
import type { Rule } from "../scripts/verify";
import { routes, wrongAutoRoutes, wrongShare } from "./route-the-inbox";

const MOST_TO_A_PERSON = 0.4;

function shareToPerson(folder: string): number {
  const all = routes(folder, "dev");
  return all.filter((routed) => routed.queue === "person").length / all.length;
}

export default [
  {
    says: "zero dev emails are booked or sent to the agronomist when the desk chose another queue",
    test: (folder) => wrongAutoRoutes(folder, "dev") === 0,
    tryNext:
      "run uv run python threshold.py and pick the lowest threshold with 0 wrong auto-routes",
  },
  {
    says: `${MOST_TO_A_PERSON * 100}% of dev emails or fewer go to a person`,
    test: (folder) => shareToPerson(folder) <= MOST_TO_A_PERSON,
    tryNext: "a threshold above 1.0 sends everything to a person; lower it until the share drops",
  },
  {
    says: "the queue still differs from the desk's on 10% of dev emails or fewer",
    test: (folder) => wrongShare(folder, "dev") <= 0.1,
    tryNext: "rerun bun run verify route-the-inbox on this folder and fix its FAIL lines first",
  },
] satisfies Rule[];
