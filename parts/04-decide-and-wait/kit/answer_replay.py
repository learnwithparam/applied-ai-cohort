"""Ask the fast role to answer a question from numbered passages. On replay, use the recording.

    from part_kit import ask_model
    reply_text = ask_model(prompt)

With a live provider this is one call to complete("fast", ...). With LLM_PROVIDER=replay (the
default) no key is needed. Replay finds the question in your prompt, reads the passages you
numbered like "[1] ..." and answers the way a real model does:

    a passage holds the answer                       it answers and cites that passage, "[2]"
    no passage holds it, and the prompt allows       it replies "Not in the sources."
      "not in the sources"
    no passage holds it, and the prompt does not     it guesses, and cites passage [1]

On a few questions the recorded model cites the wrong passage, as real models sometimes do.
Every call is written to runs/calls.jsonl, like every other model call.
"""

import json
import re
from pathlib import Path

from config import models
from config.llm import complete, runs_dir

KIT = Path(__file__).resolve().parent
RECORDINGS_FILE = KIT / "answer-replay.jsonl"
NOT_IN_THE_SOURCES = "Not in the sources."

# A numbered passage starts a line with its number in square brackets, such as "[2] Rain. ..."
PASSAGE_START = re.compile(r"^\[(\d+)\]", re.MULTILINE)
ALLOWS_NOT_IN_THE_SOURCES = re.compile(r"not in the sources", re.IGNORECASE)


class AnswerReplayMissError(RuntimeError):
    """Replay has no recorded answer for the prompt it was given."""


def recordings() -> list[dict]:
    rows = []
    for line in RECORDINGS_FILE.read_text().splitlines():
        if line:
            rows.append(json.loads(line))
    return rows


def numbered_passages(prompt: str) -> dict[int, str]:
    """Each passage in the prompt, by its number."""
    pieces = PASSAGE_START.split(prompt)
    numbers = pieces[1::2]
    texts = pieces[2::2]
    return {int(number): text for number, text in zip(numbers, texts, strict=True)}


def passage_with(support: str | None, passages: dict[int, str]) -> int | None:
    """The number of the first passage that holds the supporting text, or None."""
    if support is None:
        return None
    for number, text in passages.items():
        if support in text:
            return number
    return None


def recorded_reply(recording: dict, prompt: str) -> str:
    passages = numbered_passages(prompt)
    found = passage_with(recording["support"], passages)
    if found is not None:
        cited = found
        if recording.get("cites_wrong_passage"):
            cited = found + 1 if found + 1 in passages else found - 1
        return f"{recording['answer']} [{cited}]"
    if ALLOWS_NOT_IN_THE_SOURCES.search(prompt):
        return NOT_IN_THE_SOURCES
    return f"{recording['guess']} [1]"


def log_replay_call(prompt: str, reply_text: str) -> None:
    """One line in calls.jsonl, priced the same way as every other replay call."""
    input_tokens = int(len(prompt.split()) * 1.3)
    output_tokens = len(reply_text.split()) + 4
    price = models.REPLAY_PRICE_PER_MILLION
    cost = (input_tokens * price["input"] + output_tokens * price["output"]) / 1_000_000
    record = {
        "role": "fast",
        "provider": "replay",
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": round(cost, 8),
    }
    with open(runs_dir() / "calls.jsonl", "a") as calls_file:
        calls_file.write(json.dumps(record) + "\n")


def replay_answer(prompt: str) -> str:
    for recording in recordings():
        if recording["question"] in prompt:
            reply_text = recorded_reply(recording, prompt)
            log_replay_call(prompt, reply_text)
            return reply_text
    raise AnswerReplayMissError(
        "Answer replay has no recording for this prompt. Put the grower's whole question in "
        "your prompt, or set LLM_PROVIDER and a key in .env."
    )


def ask_model(prompt: str) -> str:
    """The fast role's reply to one prompt, as text."""
    if models.provider() == "replay":
        return replay_answer(prompt)
    reply = complete("fast", [{"role": "user", "content": prompt}])
    return reply.text
