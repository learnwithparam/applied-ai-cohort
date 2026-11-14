import type { Rule } from "../scripts/verify";
import { inspect } from "./lib/mini";

// A run with ten tool calls. Each tool result is a long record.
const SETUP = `
import json, time
from context import build_prompt

SYSTEM = "You are the booking agent."
history = [{"role": "user", "content": "Book TB-1001."}]
for i in range(10):
    history.append({"role": "assistant", "content": "call tool " + str(i)})
    history.append({"role": "tool", "content": "record " + str(i) + " " + "long text " * 120})

def words(prompt):
    return sum(len(message["content"].split()) for message in prompt)
`;

const run = (body: string) => `${SETUP}\n${body}\nprint(json.dumps(out))`;

export default [
  {
    says: "the same input gives the same prompt twice, so nothing like a clock is in it",
    test: (folder) => {
      const code = run(`
first = build_prompt(SYSTEM, history)
time.sleep(0.01)
out = {"same": first == build_prompt(SYSTEM, history)}`);
      return inspect(folder, code)?.same === true;
    },
    tryNext: "send the system text as it is: no time, date or random id inside it",
  },
  {
    says: "the system message comes first and is exactly your system text",
    test: (folder) => {
      const code = run(`
first = build_prompt(SYSTEM, history)[0]
out = {"ok": first["role"] == "system" and first["content"] == SYSTEM}`);
      return inspect(folder, code)?.ok === true;
    },
    tryNext: "start the prompt with {'role': 'system', 'content': system_text} and nothing added",
  },
  {
    says: "tool results older than the newest three are cut short, and the newest three are whole",
    test: (folder) => {
      const code = run(`
prompt = build_prompt(SYSTEM, history)
tools = [message["content"] for message in prompt if message["role"] == "tool"]
originals = [message["content"] for message in history if message["role"] == "tool"]
out = {
    "old_short": all(len(text) <= 200 for text in tools[:-3]),
    "new_whole": tools[-3:] == originals[-3:],
    "has_old": len(tools) == 10,
}`);
      const found = inspect(folder, code);
      return found?.old_short === true && found.new_whole === true && found.has_old === true;
    },
    tryNext: "cut each older tool result to 80 letters plus [trimmed]; leave the last three alone",
  },
  {
    says: "a run with ten tool calls sends at least 40 percent fewer words than the full history",
    test: (folder) => {
      const code = run(`
out = {"share": words(build_prompt(SYSTEM, history)) / words(history)}`);
      return Number(inspect(folder, code)?.share ?? 1) <= 0.6;
    },
    tryNext: "shorten every tool result except the newest three",
  },
  {
    says: "every user and assistant message is still there, in order",
    test: (folder) => {
      const code = run(`
prompt = build_prompt(SYSTEM, history)
kept = [item for item in prompt if item["role"] not in ("tool", "system")]
wanted = [item for item in history if item["role"] != "tool"]
out = {"ok": kept == wanted}`);
      return inspect(folder, code)?.ok === true;
    },
    tryNext: "only tool results get cut; copy the user and assistant messages unchanged",
  },
] satisfies Rule[];
