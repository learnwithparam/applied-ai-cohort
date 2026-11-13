// Kills the learner's chain with SIGKILL while it waits for the agronomist, answers, starts it
// again, and counts what the application system holds.
import type { Rule } from "../scripts/verify";
import { agronomistEmails, type Split } from "./route-the-inbox";
import {
  type ApprovalRun,
  approvalRun,
  approvedBookedOnceWithId,
  handledOnceAndRight,
} from "./wait-for-approval";

export function oneRequestPerEmail(run: ApprovalRun, split: Split): boolean {
  const asked = run.approvals.map((request) => String(request.email_id));
  const expected = agronomistEmails(split);
  return asked.length === expected.length && expected.every((emailId) => asked.includes(emailId));
}

const crashed = (folder: string) => approvalRun(folder, "dev", true);

export default [
  {
    says:
      "after a SIGKILL during the wait and a restart, " +
      "each approved email is booked once, with its approval id",
    test: async (folder) => approvedBookedOnceWithId(await crashed(folder)),
    tryNext: "save each approval id to a file before you wait, and read it back when you start",
  },
  {
    says: "one approval request per agronomist email, never two",
    test: async (folder) => oneRequestPerEmail(await crashed(folder), "dev"),
    tryNext: "on a restart, wait again for the saved approval id instead of asking again",
  },
  {
    says:
      "the restarted chain exits 0, every email is " +
      "handled once, and zero jobs are booked wrong",
    test: async (folder) => handledOnceAndRight(await crashed(folder)),
    tryNext: "save which emails are done, and skip them when the chain starts again",
  },
] satisfies Rule[];
