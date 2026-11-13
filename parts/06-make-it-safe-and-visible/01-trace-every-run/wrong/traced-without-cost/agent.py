"""The act verb: an agent that works on one spray request until it reaches an end state.

    uv run world email TB-1001 | uv run python agent.py

It reads {"email_id", "text"} on stdin, lets the model call tools in a loop, and prints
{"run_id", "stop_reason", "tool_calls", "cost_usd"}. Every model call and tool call is a span
in the run's trace. What counts is the application system's state afterwards.
"""

import json
import os
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path

import model
import tools
import tracing

PROMPT = (Path(__file__).parent / "prompt.md").read_text()

# The budget for one task. A runaway agent stops here and hands the email to a person.
MAX_TOOL_CALLS = 8
MAX_COST_USD = 0.0005


@dataclass
class Run:
    run_id: str
    email_id: str
    text: str
    trace: tracing.Trace
    root: dict
    tool_calls: int = 0
    cost_usd: float = 0.0


def runs_dir() -> Path:
    folder = Path(os.environ.get("RUNS_DIR", "runs"))
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def write_trace(run: Run, step: model.Step, answer: tuple[str, bool]) -> None:
    """One line per tool call in runs/trace.jsonl, so a check can follow the agent's path."""
    text, is_error = answer
    line = {
        "run_id": run.run_id,
        "email_id": run.email_id,
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


def over_budget(run: Run) -> str | None:
    """The limit this run has reached, or None while it is within budget."""
    if run.tool_calls >= MAX_TOOL_CALLS:
        return f"the agent reached its limit of {MAX_TOOL_CALLS} tool calls"
    if run.cost_usd >= MAX_COST_USD:
        return f"the agent reached its limit of ${MAX_COST_USD} for one task"
    return None


def hand_to_person(run: Run, reason: str) -> None:
    tools.call_tool("send_to_review", {"email_id": run.email_id, "reason": reason})


def ask_model(run: Run, messages: list[dict]) -> model.Step:
    """One model call, as a chat span with its role, tokens and cost."""
    chat_attributes = {"gen_ai.operation.name": "chat", "gen_ai.request.model": "fast"}
    span = run.trace.start("chat fast", chat_attributes, run.root)
    step = model.next_step("fast", messages, tools.TOOLS)
    usage = {
        "gen_ai.usage.input_tokens": step.input_tokens,
        "gen_ai.usage.output_tokens": step.output_tokens,
    }
    run.trace.end(span, usage)
    run.cost_usd += step.cost_usd
    return step


def use_tool(run: Run, step: model.Step) -> tuple[str, bool]:
    """One tool call, as an execute_tool span."""
    tool_attributes = {"gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": step.tool}
    span = run.trace.start(f"execute_tool {step.tool}", tool_attributes, run.root)
    answer = tools.call_tool(step.tool, step.arguments)
    run.trace.end(span, {"error": answer[1]})
    write_trace(run, step, answer)
    run.tool_calls += 1
    return answer


def loop(run: Run) -> str:
    """Ask, act, remember, until the model is done or a limit is reached.
    Returns the stop reason."""
    messages = [{"role": "system", "content": PROMPT}, {"role": "user", "content": run.text}]
    while True:
        limit = over_budget(run)
        if limit:
            hand_to_person(run, f"Stopped: {limit}")
            return "limit"
        step = ask_model(run, messages)
        if step.tool is None:
            return "done"
        answer = use_tool(run, step)
        remember(messages, step, answer[0])


def act(task: dict) -> dict:
    run_id = uuid.uuid4().hex
    text = task["text"]
    trace = tracing.Trace(run_id)
    root_attributes = {"run_id": run_id, "email_id": task["email_id"], "task.text": text}
    root = trace.start("act", root_attributes)
    run = Run(run_id, task["email_id"], text, trace, root)
    stop_reason = loop(run)
    trace.end(root, {"stop_reason": stop_reason, "tool_calls": run.tool_calls})
    trace.send()
    summary = {"run_id": run_id, "stop_reason": stop_reason, "tool_calls": run.tool_calls}
    return {**summary, "cost_usd": round(run.cost_usd, 8)}


if __name__ == "__main__":
    print(json.dumps(act(json.loads(sys.stdin.read()))))
