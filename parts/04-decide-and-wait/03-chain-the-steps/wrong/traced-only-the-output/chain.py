"""chain: take every email on the desk through three steps: extract, check and draft.

    uv run python chain.py

extract reads the email into a record. check decides the queue. draft writes the message for
the grower. Each step takes the output of the step before it.
Each step writes its input and output to runs/trace.jsonl, one line per step.
"""

import json

from extract import read_request
from route import decide_record

from config.llm import runs_dir
from worlds import client


def extract_step(email: dict) -> dict:
    """Read the email into a record. A reply that cannot be read gives no record."""
    try:
        record = read_request(email["text"])
    except (ValueError, KeyError):
        record = None
    return {"email_id": email["email_id"], "text": email["text"], "record": record}


def check_step(extracted: dict) -> dict:
    """Decide the queue for the record: book, agronomist or person."""
    if extracted["record"] is None:
        decision = {
            "queue": "person",
            "confidence": 1.0,
            "reasons": ["the reply could not be read"],
        }
    else:
        decision = decide_record(extracted["record"], extracted["text"])
    return {"email_id": extracted["email_id"], "record": extracted["record"], **decision}


def draft_step(checked: dict) -> dict:
    """The message for the grower."""
    record = checked["record"] or {}
    product = record.get("product_name")
    field = record.get("field_name")
    what = f"{product} on {field} at {record.get('rate')} L/ha"
    if checked["queue"] == "book":
        message = f"Booked: {what}."
    elif checked["queue"] == "agronomist":
        message = f"Your request for {what} is near the label limit. The agronomist must agree."
    else:
        reasons = "; ".join(checked["reasons"])
        message = f"A person at the desk will look at your request: {reasons}"
    return {"email_id": checked["email_id"], "to": record.get("sender"), "message": message}


def write_trace(step_name: str, step_input: dict, step_output: dict) -> None:
    """One line in runs/trace.jsonl: which email, which step, what went in and what came out."""
    row = {
        "run_id": step_input["email_id"],
        "step": step_name,
        "output": step_output,
    }
    with open(runs_dir() / "trace.jsonl", "a") as trace_file:
        trace_file.write(json.dumps(row) + "\n")


def run_step(step_name: str, step, step_input: dict) -> dict:
    """Run one step and write it to the trace."""
    step_output = step(step_input)
    write_trace(step_name, step_input, step_output)
    return step_output


def run_chain(email: dict) -> dict:
    extracted = run_step("extract", extract_step, email)
    checked = run_step("check", check_step, extracted)
    return run_step("draft", draft_step, checked)


if __name__ == "__main__":
    drafts = [run_chain(email) for email in client.inbox()]
    print(json.dumps({"emails": len(drafts)}))
