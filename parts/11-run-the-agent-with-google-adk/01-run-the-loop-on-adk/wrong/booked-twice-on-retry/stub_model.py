"""The model for this step. It replays recorded replies, so it needs no key. Do not change it.

    stub = StubLlm(model="fast")

ADK calls generate_content_async() with the conversation so far. The stub answers with one tool
call, or with a final answer when it has nothing left to ask. It reads the same recorded replies as
the replay in part 05, so it makes the same mistakes.

Like a flaky network, it drops one reply after a booking. The agent must retry, and the retry must
not book the same email twice.
"""

import difflib
import json
import re
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field

from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.genai import types

from config import llm
from worlds import client

FINISHED = "Done. The request is handled."
DROPPED = "The reply was dropped on the way. Try again."


@dataclass
class Request:
    """The inbox email as the recorded model read it."""

    email_id: str
    sender: str
    product_name: str
    field_name: str
    rate: float


@dataclass
class Turn:
    """One tool call in the conversation, with the answer the tool gave."""

    tool: str
    arguments: dict
    answer: str


@dataclass
class Move:
    """What the model does next: a tool to call, or a final answer when tool is None."""

    tool: str | None
    arguments: dict = field(default_factory=dict)
    text: str = ""


def parsed(answer: str) -> dict | None:
    """The answer as JSON, or None when the tool answered with an error sentence."""
    try:
        return json.loads(answer)
    except json.JSONDecodeError:
        return None


def request_for(task_text: str) -> Request:
    """The recorded reading of the inbox email inside the task."""
    for email_text, recording in llm.recorded_replies():
        if email_text in task_text:
            reply = recording["json_reply"]
            return Request(
                recording["email_id"],
                reply["sender"],
                reply["product_name"],
                reply["field_name"],
                float(reply["rate"]),
            )
    raise llm.ReplayMissError(
        "Replay has no recorded reply for this task. Put the whole inbox email in the task."
    )


def task_text(contents: list[types.Content]) -> str:
    """The first text the user wrote, which holds the inbox email."""
    for content in contents:
        for part in content.parts or []:
            if content.role == "user" and part.text:
                return part.text
    return ""


def answer_text(response: types.FunctionResponse) -> str:
    return str((response.response or {}).get("result", ""))


def turns_so_far(contents: list[types.Content]) -> list[Turn]:
    """Each tool call so far, paired in order with the answer it got."""
    parts = [part for content in contents for part in content.parts or []]
    calls = [part.function_call for part in parts if part.function_call]
    answers = [part.function_response for part in parts if part.function_response]
    return [
        Turn(call.name, dict(call.args or {}), answer_text(answer))
        for call, answer in zip(calls, answers, strict=False)
    ]


def part_for(move: Move) -> types.Part:
    if move.tool is None:
        return types.Part(text=move.text)
    return types.Part(function_call=types.FunctionCall(name=move.tool, args=move.arguments))


def review(request: Request, reason: str) -> Move:
    """Hand the email to a person, with the first sentence of the reason."""
    first_sentence = reason.split(". ")[0].strip(". ")
    return Move("send_to_review", {"email_id": request.email_id, "reason": first_sentence})


def candidate_fields(turns: list[Turn]) -> list[dict]:
    """The sender's fields after a lookup, or every field when the lookup was skipped."""
    grower = parsed(turns[0].answer) if turns and turns[0].tool == "find_grower" else None
    if grower is None:
        return client.fields()
    return grower["fields"]


def pick_field(request: Request, fields: list[dict]) -> dict | None:
    """The field the request names, or the first field when the name is vague."""
    wanted = request.field_name.lower()
    for candidate in fields:
        if candidate["name"].lower() == wanted:
            return candidate
    return fields[0] if fields else None


def suggested_name(request: Request, turns: list[Turn], answer: str) -> str | None:
    """A product name from the error's advice that is close to what the grower wrote."""
    tries = [turn for turn in turns if turn.tool == "find_product"]
    if len(tries) > 1:
        return None
    listed = answer.split("sells:")[-1].split(". ")[0]
    names = [name.strip() for name in re.split(r",\s*|\s+and\s+", listed)]
    close = difflib.get_close_matches(request.product_name, names, n=1, cutoff=0.6)
    return close[0] if close else None


class StubLlm(BaseLlm):
    """The replay model as an ADK model. Pass model="fast", a role name, never a model id."""

    # Set on the wrong answer that skips the grower lookup.
    skip_grower_lookup: bool = False
    # The flaky network drops one reply per run. Once dropped, later replies arrive.
    dropped: bool = False

    async def generate_content_async(
        self, llm_request: LlmRequest, stream: bool = False
    ) -> AsyncGenerator[LlmResponse, None]:
        contents = llm_request.contents or []
        turns = turns_so_far(contents)
        move = self.next_move(request_for(task_text(contents)), turns)
        if move.tool is not None and move.tool not in (llm_request.tools_dict or {}):
            move = Move(None, text=FINISHED)  # no such tool is offered, so the model answers
        if move.tool is None and self.should_drop(turns):
            self.dropped = True
            yield LlmResponse(error_code="UNAVAILABLE", error_message=DROPPED)
            return
        yield LlmResponse(content=types.Content(role="model", parts=[part_for(move)]))

    def should_drop(self, turns: list[Turn]) -> bool:
        booked = any(turn.tool == "book_job" and parsed(turn.answer) for turn in turns)
        return booked and not self.dropped

    def next_move(self, request: Request, turns: list[Turn]) -> Move:
        """What the recorded model does next, given the calls so far."""
        if not turns:
            return self.first_move(request)
        last = turns[-1]
        if last.tool == "find_grower":
            return self.after_grower(request, last)
        if last.tool == "find_product":
            return self.after_product(request, turns, last.answer)
        if last.tool == "book_job":
            return self.after_booking(request, last)
        return Move(None, text=FINISHED)

    def first_move(self, request: Request) -> Move:
        if self.skip_grower_lookup:
            return Move("find_product", {"name": request.product_name})
        return Move("find_grower", {"email": request.sender})

    def after_grower(self, request: Request, last: Turn) -> Move:
        if parsed(last.answer) is None:
            return review(request, last.answer)
        return Move("find_product", {"name": request.product_name})

    def after_product(self, request: Request, turns: list[Turn], answer: str) -> Move:
        product = parsed(answer)
        if product is None:
            name = suggested_name(request, turns, answer)
            if name:
                return Move("find_product", {"name": name})
            return review(request, answer)
        return self.booking(request, turns, product)

    def booking(self, request: Request, turns: list[Turn], product: dict) -> Move:
        field_row = pick_field(request, candidate_fields(turns))
        if field_row is None:
            return review(request, "No field matches this request")
        arguments = {
            "email_id": request.email_id,
            "field_id": field_row["field_id"],
            "product_code": product["product_code"],
            "rate_l_per_ha": request.rate,
        }
        return Move("book_job", arguments)

    def after_booking(self, request: Request, last: Turn) -> Move:
        if parsed(last.answer) is not None:
            return Move(None, text=FINISHED)
        return review(request, last.answer)
