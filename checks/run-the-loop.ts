import {
  type AgentRun,
  agentRuns,
  allActsExitZero,
  devTasks,
  everyRun,
  handledOnce,
} from "../parts/05-let-it-act/agent-checks";
import type { Rule } from "../scripts/verify";
import { hasVerb } from "./lib/contract";

// The agent on every dev email against a fresh world, three times.
const devRuns = (folder: string) =>
  agentRuns(folder, "dev", { split: "dev", tasks: devTasks(), withDesk: false });

const printsRunIdAndStop = (run: AgentRun) =>
  run.acts.every((act) => {
    const printed = act.printed ?? {};
    return typeof printed.run_id === "string" && typeof printed.stop_reason === "string";
  });

export default [
  {
    says: "contract.toml names an act verb",
    test: (folder) => hasVerb(folder, "act"),
    tryNext: 'add act = "uv run python agent.py" under [verbs] in contract.toml',
  },
  {
    says: "act exits 0 on every dev email, 3 fresh runs out of 3",
    test: (folder) => everyRun(devRuns(folder), allActsExitZero),
    tryNext: "run uv run world email TB-1001 | uv run python agent.py and read the error it prints",
  },
  {
    says: "act prints one line of JSON with a run_id and a stop_reason",
    test: (folder) => everyRun(devRuns(folder), printsRunIdAndStop),
    tryNext: 'end agent.py with print(json.dumps({"run_id": ..., "stop_reason": ...}))',
  },
  {
    says: "every dev email reaches an end state: booked or with a person, once each",
    test: (folder) => everyRun(devRuns(folder), handledOnce),
    tryNext:
      "keep calling the model until it answers with no tool; one turn only reaches find_grower",
  },
  {
    says: "the agent does the work: at least half the dev emails end with a booked job",
    test: (folder) => everyRun(devRuns(folder), (run) => run.score.booked >= 20),
    tryNext: "add each tool's answer to messages with remember(), so the model can read it",
  },
] satisfies Rule[];
