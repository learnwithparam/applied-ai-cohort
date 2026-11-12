"""One call to a model, by role. Every call is written to runs/calls.jsonl.

    from config.llm import complete
    reply = complete("fast", [{"role": "user", "content": "..."}])
    reply.text, reply.cost_usd

With LLM_PROVIDER=replay (the default) no key is needed: the reply is the one recorded
for the inbox email found in your prompt. Pass schema= to ask for JSON that fits it.
"""

import json
import os
from dataclasses import dataclass
from pathlib import Path

from config import models

WORLDS = models.ROOT / "worlds"


class ReplayMissError(RuntimeError):
    """Replay has no recorded reply for the prompt it was given."""


@dataclass
class Reply:
    text: str
    role: str
    provider: str
    input_tokens: int
    output_tokens: int
    cost_usd: float


def runs_dir() -> Path:
    folder = Path(os.environ.get("RUNS_DIR", "runs"))
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def log_call(reply: Reply) -> None:
    record = {
        "role": reply.role,
        "provider": reply.provider,
        "input_tokens": reply.input_tokens,
        "output_tokens": reply.output_tokens,
        "cost_usd": round(reply.cost_usd, 8),
    }
    with open(runs_dir() / "calls.jsonl", "a") as calls_file:
        calls_file.write(json.dumps(record) + "\n")


def recorded_replies() -> list[tuple[str, dict]]:
    """Every (email text, recorded reply) pair across the worlds that have replay files."""
    pairs = []
    for replay_file in sorted(WORLDS.glob("*/replay/*.json")):
        recording = json.loads(replay_file.read_text())
        world_dir = replay_file.parent.parent
        for email_file in world_dir.glob(f"inbox/*/{recording['email_id']}.txt"):
            pairs.append((email_file.read_text().strip(), recording))
    return pairs


def replay_usage(prompt: str, email_text: str, recording: dict) -> tuple[int, int, float]:
    """Tokens in, tokens out and cost, as if the model had read this exact prompt."""
    # Words added around the email cost tokens too, so a longer prompt costs more.
    extra_words = len(prompt.split()) - len(email_text.split())
    input_tokens = recording["input_tokens"] + extra_words
    output_tokens = recording["output_tokens"]
    price = models.REPLAY_PRICE_PER_MILLION
    cost = (input_tokens * price["input"] + output_tokens * price["output"]) / 1_000_000
    return input_tokens, output_tokens, cost


def replay(role: str, messages: list[dict], schema: dict | None) -> Reply:
    prompt = "\n".join(str(message.get("content", "")) for message in messages)
    for email_text, recording in recorded_replies():
        if email_text in prompt:
            # Asked for a shape, the model answers in JSON. Otherwise it answers in prose.
            wants_json = schema is not None
            text = json.dumps(recording["json_reply"]) if wants_json else recording["prose_reply"]
            input_tokens, output_tokens, cost = replay_usage(prompt, email_text, recording)
            return Reply(text, role, "replay", input_tokens, output_tokens, cost)
    raise ReplayMissError(
        "Replay has no recorded reply for this prompt. Replay answers prompts that contain "
        "one whole inbox email. Put the email text in your prompt, "
        "or set LLM_PROVIDER and a key in .env."
    )


def live(role: str, messages: list[dict], schema: dict | None) -> Reply:
    problem = models.key_problem()
    if problem:
        raise RuntimeError(problem)
    import litellm  # only live calls need it, so replay runs on plain Python

    options = {}
    if schema is not None:
        options["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": "record", "schema": schema},
        }
    response = litellm.completion(model=models.model_for(role), messages=messages, **options)
    usage = response.usage
    cost = response._hidden_params.get("response_cost") or 0.0
    return Reply(
        response.choices[0].message.content or "",
        role,
        models.provider(),
        usage.prompt_tokens,
        usage.completion_tokens,
        float(cost),
    )


def complete(role: str, messages: list[dict], schema: dict | None = None) -> Reply:
    models.model_for(role)  # fails early on an unknown role or provider
    if models.provider() == "replay":
        reply = replay(role, messages, schema)
    else:
        reply = live(role, messages, schema)
    log_call(reply)
    return reply
