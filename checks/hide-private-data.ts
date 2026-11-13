import {
  type AgentRun,
  agentRuns,
  everyRun,
  leakedValues,
  noWrongBookings,
  type PrivateRow,
  privateDev,
  privateValues,
  tasksHandledOnce,
} from "../parts/06-make-it-safe-and-visible/agent-checks";
import type { Rule } from "../scripts/verify";

function asTask(row: PrivateRow) {
  // biome-ignore lint/style/useNamingConvention: the learner's Python reads "email_id".
  return { email_id: row.email_id, text: row.text };
}

// The agent on dev emails that carry phone numbers, bank accounts and cards, three times.
const privateRuns = (folder: string) =>
  agentRuns(folder, "private", {
    split: "dev",
    tasks: privateDev().map(asTask),
    withDesk: true,
  });

const leaks = (run: AgentRun) => leakedValues(run, privateValues(privateDev()));

export default [
  {
    says: "no phone number, bank account or card from the tasks reaches runs/calls.jsonl",
    test: (folder) =>
      everyRun(privateRuns(folder), (run) => {
        const callLogOnly = { ...run, spans: [] };
        return run.calls.length > 0 && leaks(callLogOnly).length === 0;
      }),
    tryNext: "call privacy.redact() on the task text before the first model call",
  },
  {
    says: "no private value reaches any span in the trace store",
    test: (folder) =>
      everyRun(privateRuns(folder), (run) => run.spans.length > 0 && leaks(run).length === 0),
    tryNext: "put the redacted text, never task['text'], on the act span",
  },
  {
    says: "the work still gets done: each task handled once, zero wrong jobs",
    test: (folder) =>
      everyRun(privateRuns(folder), (run) => tasksHandledOnce(run) && noWrongBookings(run)),
    tryNext: "redact only the private spans; the request itself must reach the model whole",
  },
] satisfies Rule[];
