"""The act verb: an agent that works on one spray request until it reaches an end state.

    uv run world email TB-1001 | uv run python agent.py

It reads {"email_id", "text"} on stdin, lets the model call tools in a loop, and prints
{"run_id", "stop_reason", "tool_calls", "cost_usd"}. What counts is the application system's
state afterwards, never what the agent says.
"""

import json
import os
import sys
import uuid
from pathlib import Path

import model
import tools

PROMPT = (Path(__file__).parent / "prompt.md").read_text()

# A hard stop, so a loop that goes wrong cannot spin forever.
MAX_TURNS = 30


def runs_dir() -> Path:
    folder = Path(os.environ.get("RUNS_DIR", "runs"))
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def write_trace(run_id: str, email_id: str, step: model.Step, answer: tuple[str, bool]):
    """One line per tool call in runs/trace.jsonl, so a check can follow the agent's path."""
    text, is_error = answer
    line = {
        "run_id": run_id,
        "email_id": email_id,
        "tool": step.tool,
        "arguments": step.arguments,
        "is_error": is_error,
        "answer": text[:200],
    }
    with open(runs_dir() / "trace.jsonl", "a") as trace_file:
        trace_file.write(json.dumps(line) + "\n")


def remember(messages: list[dict], step: model.Step, answer_text: str) -> None:
    """Add the model's tool call and the tool's answer to the conversation."""
    call_id = f"call_{len(messages)}"
    function = {"name": step.tool, "arguments": json.dumps(step.arguments)}
    call = {"id": call_id, "type": "function", "function": function}
    messages.append({"role": "assistant", "content": step.text, "tool_calls": [call]})
    messages.append({"role": "tool", "tool_call_id": call_id, "content": answer_text})


def act(task: dict) -> dict:
    run_id = uuid.uuid4().hex
    messages = [
        {"role": "system", "content": PROMPT},
        {"role": "user", "content": task["text"]},
    ]
    tool_calls, cost_usd, stop_reason = 0, 0.0, "turn limit"
    for _turn in range(MAX_TURNS):
        step = model.next_step("fast", messages, tools.TOOLS)
        cost_usd += step.cost_usd
        if step.tool is None:
            stop_reason = "done"
            break
        answer = tools.call_tool(step.tool, step.arguments)
        write_trace(run_id, task["email_id"], step, answer)
        remember(messages, step, answer[0])
        tool_calls += 1
    summary = {"run_id": run_id, "stop_reason": stop_reason, "tool_calls": tool_calls}
    return {**summary, "cost_usd": round(cost_usd, 8)}


if __name__ == "__main__":
    print(json.dumps(act(json.loads(sys.stdin.read()))))
