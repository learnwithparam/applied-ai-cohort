import {
  type AgentRun,
  agentRuns,
  devTasks,
  everyRun,
  matchedCount,
  parseJson,
} from "../parts/06-make-it-safe-and-visible/agent-checks";
import type { Rule } from "../scripts/verify";
import { hasVerb } from "./lib/contract";
import { chatCost, withinOnePercent } from "./trace-every-run";

const NUMBER_KEYS = ["runs", "total_usd", "successes", "per_success_usd"];

// The agent on every dev email, then the learner's price verb, three times.
const pricedRuns = (folder: string) =>
  agentRuns(folder, "priced", {
    split: "dev",
    tasks: devTasks(),
    withDesk: true,
    after: "price",
  });

const printedPrice = (run: AgentRun) => parseJson(run.extra?.stdout) ?? {};

function printsEveryNumber(run: AgentRun): boolean {
  const price = printedPrice(run);
  const numbers = NUMBER_KEYS.every((key) => typeof price[key] === "number");
  return run.extra?.code === 0 && numbers;
}

function perSuccessIsRight(run: AgentRun): boolean {
  const successes = matchedCount(run);
  const rightAmount = chatCost(run) / successes;
  return withinOnePercent(Number(printedPrice(run).per_success_usd), rightAmount);
}

function tableIsWritten(run: AgentRun): boolean {
  const table = run.files["cost-per-outcome.md"] ?? "";
  const actRow = table.split("\n").find((line) => /^\|\s*act\s*\|/.test(line)) ?? "";
  return actRow.includes(String(matchedCount(run)));
}

export default [
  {
    says: "contract.toml names a price verb",
    test: (folder) => hasVerb(folder, "price"),
    tryNext: 'add price = "uv run python price.py" under [verbs] in contract.toml',
  },
  {
    says: "price exits 0 and prints runs, total_usd, successes and per_success_usd",
    test: (folder) => everyRun(pricedRuns(folder), printsEveryNumber),
    tryNext: "run uv run python price.py after the agent, and fix what it prints first",
  },
  {
    says: "total_usd is within 1% of the cost on the chat spans in the trace store",
    test: (folder) =>
      everyRun(pricedRuns(folder), (run) =>
        withinOnePercent(Number(printedPrice(run).total_usd), chatCost(run)),
      ),
    tryNext: "add up gen_ai.usage.cost on every chat span from tracing.stored_spans()",
  },
  {
    says: "successes is the number of emails that ended as the desk's records say",
    test: (folder) =>
      everyRun(pricedRuns(folder), (run) => printedPrice(run).successes === matchedCount(run)),
    tryNext: "use grade.grade()['matched']: a run is a success only when the world agrees",
  },
  {
    says: "per_success_usd is the total cost divided by the successes, within 1%",
    test: (folder) => everyRun(pricedRuns(folder), perSuccessIsRight),
    tryNext: "divide by the successful outcomes, not by every run: failed runs cost money too",
  },
  {
    says: "runs/cost-per-outcome.md has an act row with the successes",
    test: (folder) => everyRun(pricedRuns(folder), tableIsWritten),
    tryNext: "write the table to the runs folder, with one row that starts | act |",
  },
] satisfies Rule[];
