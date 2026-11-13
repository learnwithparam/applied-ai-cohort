import {
  type AgentRun,
  agentRuns,
  devTasks,
  everyRun,
  type Span,
} from "../parts/06-make-it-safe-and-visible/agent-checks";
import type { Rule } from "../scripts/verify";
import { hasVerb } from "./lib/contract";

const ROLES = new Set(["fast", "smart", "judge"]);

// The agent on every dev email, with the check's own trace store, three times.
export const tracedRuns = (folder: string) =>
  agentRuns(folder, "traced", { split: "dev", tasks: devTasks(), withDesk: true });

const runIds = (run: AgentRun) => run.acts.map((act) => String(act.printed?.run_id ?? ""));
const spansOf = (run: AgentRun, runId: string) =>
  run.spans.filter((span) => span.traceId === runId);
const isChat = (span: Span) => span.attributes["gen_ai.operation.name"] === "chat";
const isTool = (span: Span) => span.attributes["gen_ai.operation.name"] === "execute_tool";

function everyRunHasTrace(run: AgentRun): boolean {
  return runIds(run).every((runId) => spansOf(run, runId).some(isChat));
}

function chatSpanIsComplete(span: Span): boolean {
  const attributes = span.attributes;
  const role = String(attributes["gen_ai.request.model"]);
  const tokensIn = Number(attributes["gen_ai.usage.input_tokens"]);
  const tokensOut = Number(attributes["gen_ai.usage.output_tokens"]);
  const cost = attributes["gen_ai.usage.cost"];
  return ROLES.has(role) && tokensIn > 0 && tokensOut > 0 && typeof cost === "number";
}

export const chatCost = (run: AgentRun) =>
  run.spans
    .filter(isChat)
    .reduce((total, span) => total + Number(span.attributes["gen_ai.usage.cost"] ?? 0), 0);

export const callLogCost = (run: AgentRun) =>
  run.calls.reduce((total, call) => total + Number(call.cost_usd), 0);

export function withinOnePercent(learnerAmount: number, rightAmount: number): boolean {
  const allowedGap = Math.max(1e-9, Math.abs(rightAmount) * 0.01);
  return Math.abs(learnerAmount - rightAmount) <= allowedGap;
}

// Each run has as many execute_tool spans as it has lines in runs/trace.jsonl.
function toolSpansMatchTheTrace(run: AgentRun): boolean {
  return runIds(run).every((runId) => {
    const toolLines = run.trace.filter((line) => line.run_id === runId).length;
    return spansOf(run, runId).filter(isTool).length === toolLines;
  });
}

export default [
  {
    says: "contract.toml names an act verb",
    test: (folder) => hasVerb(folder, "act"),
    tryNext: 'add act = "uv run python agent.py" under [verbs] in contract.toml',
  },
  {
    says: "every run's run_id finds a trace in the trace store, with at least one chat span",
    test: (folder) => everyRun(tracedRuns(folder), everyRunHasTrace),
    tryNext:
      "make a tracing.Trace(run_id), add a span for each model call, " +
      "and call trace.send() before act returns",
  },
  {
    says: "every chat span has the role, input tokens, output tokens and cost",
    test: (folder) =>
      everyRun(tracedRuns(folder), (run) => run.spans.filter(isChat).every(chatSpanIsComplete)),
    tryNext:
      "set gen_ai.request.model to the role, gen_ai.usage.input_tokens, " +
      "gen_ai.usage.output_tokens and gen_ai.usage.cost",
  },
  {
    says: "every tool call has an execute_tool span in its run's trace",
    test: (folder) => everyRun(tracedRuns(folder), toolSpansMatchTheTrace),
    tryNext: 'give each tool call its own span with gen_ai.operation.name "execute_tool"',
  },
  {
    says: "the cost in the traces is within 1% of the cost in runs/calls.jsonl",
    test: (folder) =>
      everyRun(tracedRuns(folder), (run) => withinOnePercent(chatCost(run), callLogCost(run))),
    tryNext: "record step.cost_usd on the span of the same model call, once per call",
  },
] satisfies Rule[];
