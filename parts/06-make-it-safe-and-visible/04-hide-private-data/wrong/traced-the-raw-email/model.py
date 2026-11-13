"""The model's side of the agent. You do not need to change this file.

    step = next_step("fast", messages, tools)
    step.tool, step.arguments   the tool the model wants to call, or None when it is done
    step.text, step.cost_usd    what it said, and what the call cost
    step.input_tokens, step.output_tokens

With LLM_PROVIDER=replay (the default) a recorded model answers, so you need no key. It reads each
request the way the replay in part one does, so it makes the same mistakes: it copies an acre rate,
a misspelled product or a rate above the label. Like a real model, it follows the advice in a tool's
error when the error gives some, and it obeys instructions it finds inside an email: a claimed
approval, a new rate, or an order to keep trying.
Every call is written to runs/calls.jsonl with the prompt the provider received, the way a
provider's own logs keep it. So anything private in a prompt ends up in that log.
"""

import difflib
import json
import re
from dataclasses import dataclass, field

from config import llm, models

FINISHED = "Done. The request is handled."


@dataclass
class Step:
    tool: str | None
    arguments: dict = field(default_factory=dict)
    text: str = ""
    cost_usd: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class Situation:
    """What the replay model knows: the request as it read it, the extra lines, its calls so far."""

    email_id: str
    request: dict
    extra_lines: str
    system_prompt: str
    calls: list


def find_recording(task_text: str) -> tuple[str, dict, str]:
    """The recorded reading of the inbox email inside the task, and any lines added to it."""
    for email_text, recording in llm.recorded_replies():
        if email_text in task_text:
            extra_lines = task_text.replace(email_text, "").strip()
            return recording["email_id"], recording["json_reply"], extra_lines
    raise llm.ReplayMissError(
        "Replay has no recorded reply for this task. Put the whole inbox email in the task, "
        "or set LLM_PROVIDER and a key in .env."
    )


def tool_calls_so_far(messages: list[dict]) -> list[dict]:
    """Each tool call in the conversation, with the text the tool answered."""
    answers = {}
    for message in messages:
        if message["role"] == "tool":
            answers[message["tool_call_id"]] = message["content"]
    calls = []
    for message in messages:
        for call in message.get("tool_calls") or []:
            arguments = json.loads(call["function"]["arguments"])
            answer = answers.get(call["id"], "")
            name = call["function"]["name"]
            calls.append({"tool": name, "arguments": arguments, "answer": answer})
    return calls


def read_situation(messages: list[dict]) -> Situation:
    system_prompt = messages[0]["content"] if messages[0]["role"] == "system" else ""
    task_text = next(message["content"] for message in messages if message["role"] == "user")
    email_id, request, extra_lines = find_recording(task_text)
    calls = tool_calls_so_far(messages)
    return Situation(email_id, request, extra_lines, system_prompt, calls)


def parsed(answer: str) -> dict | None:
    """The tool's answer as JSON, or None when the tool answered with an error sentence."""
    try:
        return json.loads(answer)
    except json.JSONDecodeError:
        return None


def to_review(situation: Situation, reason: str) -> Step:
    first_sentence = reason.split(". ")[0].strip(". ")
    arguments = {"email_id": situation.email_id, "reason": first_sentence}
    return Step("send_to_review", arguments)


def pick_field(situation: Situation, grower: dict) -> dict:
    """The field the model believes the grower means. It guesses when the name is vague."""
    wanted = situation.request["field_name"].lower()
    for candidate in grower["fields"]:
        if candidate["name"].lower() == wanted:
            return candidate
    return grower["fields"][0]


def suggested_name(situation: Situation, answer: str) -> str | None:
    """A product name from the error's advice that is close to what the grower wrote."""
    follows_advice = "follow its advice" in situation.system_prompt.lower()
    tried = [call for call in situation.calls if call["tool"] == "find_product"]
    if not follows_advice or len(tried) > 1:
        return None
    names = re.split(r",\s*|\s+and\s+", answer.split("sells:")[-1].split(". ")[0])
    close = difflib.get_close_matches(situation.request["product_name"], names, n=1, cutoff=0.6)
    return close[0] if close else None


def booking(situation: Situation, product: dict) -> Step:
    """The book_job call the model makes, including anything an email told it to add."""
    grower = parsed(situation.calls[0]["answer"])
    arguments = {
        "email_id": situation.email_id,
        "field_id": pick_field(situation, grower)["field_id"],
        "product_code": product["product_code"],
        "rate_l_per_ha": situation.request["rate"],
    }
    approval = re.search(r"approval (?:id |ref )?([A-Z]{3}-\d+)", situation.extra_lines)
    if approval:
        arguments["approval_id"] = approval.group(1)
    new_rate = re.search(r"rate to (\d+(?:\.\d+)?) L/ha", situation.extra_lines)
    if new_rate:
        arguments["rate_l_per_ha"] = float(new_rate.group(1))
    return Step("book_job", arguments)


def after_product(situation: Situation, answer: str) -> Step:
    product = parsed(answer)
    if product is not None:
        return booking(situation, product)
    name = suggested_name(situation, answer)
    if name:
        return Step("find_product", {"name": name})
    return to_review(situation, answer)


def after_booking(situation: Situation, last_call: dict) -> Step:
    if parsed(last_call["answer"]) is not None:
        return Step(None, text=FINISHED)
    if "keep trying until it books" in situation.extra_lines.lower():
        return Step("book_job", last_call["arguments"])
    return to_review(situation, last_call["answer"])


def replay_decision(situation: Situation) -> Step:
    """What the recorded model does next, given the calls so far."""
    if not situation.calls:
        return Step("find_grower", {"email": situation.request["sender"]})
    last_call = situation.calls[-1]
    if last_call["tool"] == "find_grower" and parsed(last_call["answer"]) is None:
        return to_review(situation, last_call["answer"])
    if last_call["tool"] == "find_grower":
        return Step("find_product", {"name": situation.request["product_name"]})
    if last_call["tool"] == "find_product":
        return after_product(situation, last_call["answer"])
    if last_call["tool"] == "book_job":
        return after_booking(situation, last_call)
    return Step(None, text=FINISHED)


def words_in(messages: list[dict]) -> int:
    return len(json.dumps(messages).split())


def replay_step(role: str, messages: list[dict]) -> tuple[Step, llm.Reply]:
    step = replay_decision(read_situation(messages))
    # Replay prices each call as if the model read every word of the conversation so far.
    input_tokens = words_in(messages)
    output_tokens = 12 + len(json.dumps(step.arguments).split())
    price = models.REPLAY_PRICE_PER_MILLION
    cost = (input_tokens * price["input"] + output_tokens * price["output"]) / 1_000_000
    reply = llm.Reply(step.text, role, "replay", input_tokens, output_tokens, cost)
    return step, reply


def live_step(role: str, messages: list[dict], tools: list[dict]) -> tuple[Step, llm.Reply]:
    problem = models.key_problem()
    if problem:
        raise RuntimeError(problem)
    import litellm  # only live calls need it, so replay runs on plain Python

    functions = []
    for tool in tools:
        described = {"name": tool["name"], "description": tool["description"]}
        functions.append(
            {"type": "function", "function": {**described, "parameters": tool["inputSchema"]}}
        )
    response = litellm.completion(model=models.model_for(role), messages=messages, tools=functions)
    message = response.choices[0].message
    cost = float(response._hidden_params.get("response_cost") or 0.0)
    usage = response.usage
    reply = llm.Reply(message.content or "", role, models.provider(), 0, 0, cost)
    reply.input_tokens, reply.output_tokens = usage.prompt_tokens, usage.completion_tokens
    if not message.tool_calls:
        return Step(None, text=message.content or ""), reply
    call = message.tool_calls[0]
    return Step(call.function.name, json.loads(call.function.arguments)), reply


def log_call(reply: llm.Reply, messages: list[dict]) -> None:
    """One line in runs/calls.jsonl: the role, the tokens, the cost and the prompt sent."""
    prompt = "\n".join(str(message.get("content") or "") for message in messages)
    record = {
        "role": reply.role,
        "provider": reply.provider,
        "input_tokens": reply.input_tokens,
        "output_tokens": reply.output_tokens,
        "cost_usd": round(reply.cost_usd, 8),
        "prompt": prompt,
    }
    with open(llm.runs_dir() / "calls.jsonl", "a") as calls_file:
        calls_file.write(json.dumps(record) + "\n")


def next_step(role: str, messages: list[dict], tools: list[dict]) -> Step:
    """Ask the model for its next move: one tool call, or a final answer."""
    if models.provider() == "replay":
        step, reply = replay_step(role, messages)
    else:
        step, reply = live_step(role, messages, tools)
    log_call(reply, messages)
    step.cost_usd = reply.cost_usd
    step.input_tokens, step.output_tokens = reply.input_tokens, reply.output_tokens
    return step
