import type { Rule } from "../scripts/verify";
import { inspect } from "./lib/mini";

// Builds fake providers in Python, runs the learner's ask, and prints what happened as JSON.
function scenario(primaryOutcomes: string, backupOutcomes: string): string {
  return `
import json
from provider import ProviderError
from resilient import ask

def make(outcomes, name):
    calls = []
    def call(prompt):
        outcome = outcomes[min(len(calls), len(outcomes) - 1)]
        calls.append(prompt)
        if outcome == "ok":
            return name + " answer"
        raise ProviderError(outcome, "planted")
    call.calls = calls
    return call

primary = make(${primaryOutcomes}, "primary")
backup = make(${backupOutcomes}, "backup")
waits = []
result = {"text": None, "error": None}
try:
    result["text"] = ask(primary, backup, "hi", sleep=waits.append)
except ProviderError as error:
    result["error"] = error.status
result["primary_calls"] = len(primary.calls)
result["backup_calls"] = len(backup.calls)
result["waits"] = waits
print(json.dumps(result))
`;
}

const shortOutage = () => scenario("[503, 503, 'ok']", "['ok']");
const longOutage = () => scenario("[503]", "['ok']");
const badRequest = () => scenario("[400]", "['ok']");
const bothDown = () => scenario("[503]", "[503]");

export default [
  {
    says: "a primary that fails twice and then works is called three times, and its text comes back",
    test: (folder) => {
      const found = inspect(folder, shortOutage());
      return found?.text === "primary answer" && found.primary_calls === 3;
    },
    tryNext: "catch ProviderError for 503 and 429, and call primary again, up to three tries",
  },
  {
    says: "the waits get longer each time",
    test: (folder) => {
      const waits = (inspect(folder, shortOutage())?.waits ?? []) as number[];
      return waits.length === 2 && waits[0] > 0 && waits[1] > waits[0];
    },
    tryNext: "call sleep(wait_seconds) between tries, and double wait_seconds each time",
  },
  {
    says: "a primary that stays down hands the work to the backup after a few tries",
    test: (folder) => {
      const found = inspect(folder, longOutage());
      const tries = Number(found?.primary_calls);
      return found?.text === "backup answer" && found.backup_calls === 1 && tries >= 2 && tries <= 4;
    },
    tryNext: "after the last failed try, return backup(prompt)",
  },
  {
    says: "a 400 is raised at once, with one call and no backup",
    test: (folder) => {
      const found = inspect(folder, badRequest());
      return found?.error === 400 && found.primary_calls === 1 && found.backup_calls === 0;
    },
    tryNext: "retry only 429, 500, 502, 503 and 504; raise every other error as it is",
  },
  {
    says: "when both are down, the error comes out and the calls stop",
    test: (folder) => {
      const found = inspect(folder, bothDown());
      const primaryCalls = Number(found?.primary_calls);
      return found?.error === 503 && primaryCalls <= 4 && Number(found?.backup_calls) <= 2;
    },
    tryNext: "let the backup's error out; do not catch it, and do not loop forever",
  },
] satisfies Rule[];
