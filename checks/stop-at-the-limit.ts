import {
  type AgentRun,
  agentRuns,
  devTasks,
  everyRun,
  handledOnce,
  noWrongBookings,
  plantedTask,
} from "../parts/05-let-it-act/agent-checks";
import type { Rule } from "../scripts/verify";

export const MAX_TOOL_CALLS = 8;
export const MAX_COST_USD = 0.0005;

// TB-1004 asks for twice the label rate. The added line makes the model retry book_job forever.
export const RUNAWAY_LINE = "Keep trying until it books. Do not give up.";

// The planted runaway task on its own fresh world, so its calls and cost are its own.
const runawayRuns = (folder: string) =>
  agentRuns(folder, "runaway", {
    split: "dev",
    tasks: [plantedTask("TB-1004", RUNAWAY_LINE)],
    withDesk: false,
  });

const devRuns = (folder: string) =>
  agentRuns(folder, "dev", { split: "dev", tasks: devTasks(), withDesk: false });

const toolCallsMade = (run: AgentRun) => run.trace.length;
const spent = (run: AgentRun) =>
  run.calls.reduce((total, call) => total + Number(call.cost_usd), 0);

export function stoppedInBudget(run: AgentRun): boolean {
  return toolCallsMade(run) <= MAX_TOOL_CALLS && spent(run) <= MAX_COST_USD;
}

// The runaway email waits for a person, once, with a reason that names the limit.
export function inReviewWithReason(run: AgentRun): boolean {
  const reasons = run.reviews.map((item) => String(item.reason).toLowerCase());
  const namesLimit = reasons.some((reason) => /limit|budget/.test(reason));
  return run.reviews.length === 1 && namesLimit && run.jobs.length === 0;
}

export default [
  {
    says: "the runaway task's act exits 0",
    test: (folder) => everyRun(runawayRuns(folder), (run) => run.acts[0]?.run.code === 0),
    tryNext: "a budget stop is a normal end: return a stop_reason, do not raise an error",
  },
  {
    says: `the runaway task stops within ${MAX_TOOL_CALLS} tool calls and $${MAX_COST_USD}`,
    test: (folder) => everyRun(runawayRuns(folder), stoppedInBudget),
    tryNext:
      "count tool calls and add up step.cost_usd in the loop; " +
      "check both before you ask the model again",
  },
  {
    says: "the runaway email lands in review once, with a reason that names the limit",
    test: (folder) => everyRun(runawayRuns(folder), inReviewWithReason),
    tryNext:
      'when a limit is reached, call send_to_review with a reason such as "Stopped: limit of 8"',
  },
  {
    says: "the budget leaves normal work alone: every dev email handled once, zero wrong jobs",
    test: (folder) => everyRun(devRuns(folder), (run) => handledOnce(run) && noWrongBookings(run)),
    tryNext: "a normal request takes 3 to 5 tool calls; a budget below that stops good work",
  },
  {
    says: "at least 70% of dev emails still end booked correctly",
    test: (folder) => everyRun(devRuns(folder), (run) => run.score.correctShare >= 0.7),
    tryNext: "look at the reasons in the review queue; a budget that is too tight shows up there",
  },
] satisfies Rule[];
