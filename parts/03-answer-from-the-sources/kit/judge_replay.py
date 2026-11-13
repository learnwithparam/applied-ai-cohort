"""Ask the judge role one question. On replay, answer from judge-replay.jsonl.

    from part_kit import ask_judge
    reply_text = ask_judge(prompt)

With a live provider this is one call to complete("judge", ...). With LLM_PROVIDER=replay (the
default) no key is needed. Replay finds the case whose email is in your prompt and answers the
way a real judge model answers that kind of prompt:

    the prompt asks for a score from 1 to 5        the reply is a number, such as "4"
    the prompt says to fail when unsure            the judge fails anything not written exactly
    the prompt shows a labelled example that fails the judge agrees with the person most times
    any other pass or fail prompt                  the judge passes almost everything

Every call is written to runs/calls.jsonl, like every other model call. A replay call also
notes which known cases appeared in the prompt as examples, so a check can see a leak.
"""

import json
import re
from pathlib import Path

from config import models
from config.llm import complete, runs_dir

KIT = Path(__file__).resolve().parent
RECORDINGS_FILE = KIT / "judge-replay.jsonl"

ASKS_FOR_A_SCORE = re.compile(r"\b(1\s*(to|-)\s*5|score)\b", re.IGNORECASE)
FAILS_WHEN_UNSURE = re.compile(r"\b(when in doubt|if unsure|if you are unsure)\b", re.IGNORECASE)
MENTIONS_FAIL = re.compile(r"\bfail\b", re.IGNORECASE)


class JudgeReplayMissError(RuntimeError):
    """Replay has no recorded judge answer for the prompt it was given."""


def recordings() -> list[dict]:
    rows = []
    for line in RECORDINGS_FILE.read_text().splitlines():
        if line:
            rows.append(json.loads(line))
    return rows


def cases_in(prompt: str) -> list[tuple[int, dict]]:
    """Every known case whose email is in the prompt, with where its email starts."""
    found = []
    for recording in recordings():
        position = prompt.rfind(recording["email"].strip())
        if position >= 0:
            found.append((position, recording))
    found.sort(key=lambda pair: pair[0])
    return found


def reply_style(prompt: str, examples: list[dict]) -> str:
    """Which recorded answer a real judge would give to this kind of prompt."""
    if ASKS_FOR_A_SCORE.search(prompt):
        return "score"
    if FAILS_WHEN_UNSURE.search(prompt):
        return "strict"
    if examples and MENTIONS_FAIL.search(prompt):
        return "aligned"
    return "lenient"


def log_replay_call(prompt: str, reply_text: str, examples: list[dict]) -> None:
    """One line in calls.jsonl, priced the same way as every other replay call."""
    input_tokens = int(len(prompt.split()) * 1.3)
    output_tokens = len(reply_text.split()) + 4
    price = models.REPLAY_PRICE_PER_MILLION
    cost = (input_tokens * price["input"] + output_tokens * price["output"]) / 1_000_000
    record = {
        "role": "judge",
        "provider": "replay",
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": round(cost, 8),
        "example_case_ids": [example["case_id"] for example in examples],
    }
    with open(runs_dir() / "calls.jsonl", "a") as calls_file:
        calls_file.write(json.dumps(record) + "\n")


def replay_judge(prompt: str) -> str:
    found = cases_in(prompt)
    if not found:
        raise JudgeReplayMissError(
            "Judge replay has no answer for this prompt. Put the whole email of the case "
            "in your prompt, after any examples, or set LLM_PROVIDER and a key in .env."
        )
    # The case being judged comes last. Any case before it is an example.
    judged = found[-1][1]
    examples = [recording for _, recording in found[:-1]]
    reply_text = judged[reply_style(prompt, examples)]
    log_replay_call(prompt, reply_text, examples)
    return reply_text


def ask_judge(prompt: str) -> str:
    """The judge's reply to one prompt, as text."""
    if models.provider() == "replay":
        return replay_judge(prompt)
    reply = complete("judge", [{"role": "user", "content": prompt}])
    return reply.text
