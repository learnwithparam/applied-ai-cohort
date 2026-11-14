"""The act verb on Google ADK: one ADK agent, the part 05 tools, and an event log you can read.

    uv run world email TB-1001 | uv run --group adk python agent.py

It reads {"email_id", "text"} on stdin, runs the ADK Runner on an in-memory session, and prints
{"run_id", "stop_reason", "attempts", "tool_calls"}. Every event of every session goes to
runs/adk-events.jsonl, one line per event.
"""

import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

import tools
from google.adk.agents import Agent
from google.adk.events import Event
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from stub_model import StubLlm

APP_NAME = "spray_desk"
# The step names a role. The model id lives in config/models.py, never here.
MODEL_ROLE = "fast"
PROMPT = (Path(__file__).parent / "prompt.md").read_text()
# A hard stop on retries, so a model that keeps failing cannot spin forever.
MAX_ATTEMPTS = 3
# Jobs booked in this run, by email_id. A retry reads this, so it never books the same email twice.
BOOKED: dict[str, str] = {}


def runs_dir() -> Path:
    folder = Path(os.environ.get("RUNS_DIR", "runs"))
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def tool_text(name: str, arguments: dict) -> str:
    """The text a part 05 tool answers with. Its errors are sentences the agent can act on."""
    text, _is_error = tools.call_tool(name, arguments)
    return text


# TODO: write the four tools as plain functions, each with a docstring the model reads:
# find_grower(email), find_product(name), book_job(...) and send_to_review(email_id, reason).
# Each one returns tool_text(...) of the matching part 05 tool, as the solution does.


def build_agent(stub: StubLlm) -> Agent:
    """The one ADK agent. Its tools are the part 05 tools, as plain functions."""
    # TODO: pass your four tool functions in tools=[...]. Until you do, the model has no tools.
    return Agent(name="spray_desk", model=stub, instruction=PROMPT, tools=[])


def message_for(task: dict) -> types.Content:
    return types.Content(role="user", parts=[types.Part(text=task["text"])])


async def run_attempt(
    service: InMemorySessionService, runner: Runner, task: dict
) -> tuple[str, bool]:
    """One session for the email. Returns its id, and True when the model call failed."""
    session = await service.create_session(app_name=APP_NAME, user_id=task["email_id"])
    model_failed = False
    async for event in runner.run_async(
        user_id=task["email_id"], session_id=session.id, new_message=message_for(task)
    ):
        model_failed = model_failed or event.error_code is not None
    return session.id, model_failed


async def dump_events(service: InMemorySessionService, task: dict, session_id: str, run_id: str):
    """Write the session's event log, one line per event, and return the events."""
    session = await service.get_session(
        app_name=APP_NAME, user_id=task["email_id"], session_id=session_id
    )
    with open(runs_dir() / "adk-events.jsonl", "a") as events_file:
        for event in session.events:
            line = {"run_id": run_id, **event.model_dump(mode="json", exclude_none=True)}
            events_file.write(json.dumps(line) + "\n")
    return session.events


def count_calls(events: list[Event]) -> int:
    return sum(
        1
        for event in events
        for part in (event.content.parts if event.content else None) or []
        if part.function_call
    )


async def act_async(task: dict, run_id: str) -> dict:
    service = InMemorySessionService()
    stub = StubLlm(model=MODEL_ROLE)
    runner = Runner(app_name=APP_NAME, agent=build_agent(stub), session_service=service)
    stop_reason, attempts, tool_calls = "retry limit", 0, 0
    for _attempt in range(MAX_ATTEMPTS):
        attempts += 1
        session_id, model_failed = await run_attempt(service, runner, task)
        events = await dump_events(service, task, session_id, run_id)
        tool_calls += count_calls(events)
        if not model_failed:
            stop_reason = "done"
            break
    return {
        "run_id": run_id,
        "stop_reason": stop_reason,
        "attempts": attempts,
        "tool_calls": tool_calls,
    }


def act(task: dict) -> dict:
    return asyncio.run(act_async(task, uuid.uuid4().hex))


if __name__ == "__main__":
    print(json.dumps(act(json.loads(sys.stdin.read()))))
