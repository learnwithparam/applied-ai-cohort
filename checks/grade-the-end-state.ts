import {
  type AgentRun,
  agentRuns,
  devTasks,
  everyRun,
  matchedCount,
  noWrongBookings,
  parseJson,
} from "../parts/05-let-it-act/agent-checks";
import type { Rule } from "../scripts/verify";
import { hasVerb } from "./lib/contract";

const TARGET_SHARE = 0.75;

// The agent on every dev email, then the learner's grade verb, three times.
const gradedRuns = (folder: string) =>
  agentRuns(folder, "graded", {
    split: "dev",
    tasks: devTasks(),
    withDesk: false,
    after: "grade",
  });

const printedGrade = (run: AgentRun) => parseJson(run.extra?.stdout) ?? {};

export default [
  {
    says: "contract.toml names a grade verb",
    test: (folder) => hasVerb(folder, "grade"),
    tryNext: 'add grade = "uv run python grade.py" under [verbs] in contract.toml',
  },
  {
    says: "grade exits 0 and prints tasks and matched as JSON",
    test: (folder) =>
      everyRun(gradedRuns(folder), (run) => {
        const grade = printedGrade(run);
        const numbers = typeof grade.tasks === "number" && typeof grade.matched === "number";
        return run.extra?.code === 0 && numbers;
      }),
    tryNext: "run uv run python grade.py after the agent and fix what it prints first",
  },
  {
    says: "grade counts all 40 dev emails, not only the ones the agent touched",
    test: (folder) => everyRun(gradedRuns(folder), (run) => printedGrade(run).tasks === 40),
    tryNext: "loop over the desk's records in truth/dev.jsonl, one per email",
  },
  {
    says: "grade's matched equals what the world holds, counted by the check",
    test: (folder) =>
      everyRun(gradedRuns(folder), (run) => printedGrade(run).matched === matchedCount(run)),
    tryNext:
      "read /api/jobs and /api/review, never the trace or the agent's words: " +
      "a refused book_job is still in the trace",
  },
  {
    says: `at least ${TARGET_SHARE * 100}% of dev emails end in the state the desk's records show`,
    test: (folder) => everyRun(gradedRuns(folder), (run) => matchedCount(run) >= TARGET_SHARE * 40),
    tryNext: "look at the emails grade does not match, and at what book_job told the agent",
  },
  {
    says: "zero booked jobs differ from the desk's records, and zero are off label",
    test: (folder) => everyRun(gradedRuns(folder), noWrongBookings),
    tryNext: "each wrong job got past book_job: add the rule that stops it",
  },
] satisfies Rule[];
