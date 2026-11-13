"""chain: take every email on the desk through three steps: extract, check and draft.

    uv run python chain.py

extract reads the email into a record. check decides the queue. A request for the book queue
is booked and drafted. A request near the label limit waits for the agronomist's yes or no,
in kit/approvals.py. Any other request goes to the review queue, and the chain stops there.
Each step takes the output of the step before it.

The chain saves its progress in runs/workflow.db: which emails are done, and which approval
each waiting email has. After a crash, run it again. It skips what is done and waits again for
the same approvals, so nothing is booked twice and no approval is asked for twice.

POLL_SECONDS sets how often it asks for the agronomist's answers (default 2).
APPROVAL_TIMEOUT_SECONDS sets how long it waits before it gives up (default 3600).
Each step writes its input and output to runs/trace.jsonl, one line per step.
"""

import json
import os
import sqlite3
import sys
import time

from extract import read_request
from part_kit import approvals
from route import decide_record

from config.llm import runs_dir
from worlds import client

POLL_SECONDS = float(os.environ.get("POLL_SECONDS", "2"))
TIMEOUT_SECONDS = float(os.environ.get("APPROVAL_TIMEOUT_SECONDS", "3600"))

PROGRESS_TABLE = """
create table if not exists progress (
    email_id text primary key, approval_id text, checked text, done integer default 0
)
"""


def progress_db() -> sqlite3.Connection:
    """The chain's saved progress. It is a file, so it lives through a crash."""
    connection = sqlite3.connect(runs_dir() / "workflow.db")
    connection.row_factory = sqlite3.Row
    connection.execute(PROGRESS_TABLE)
    return connection


def saved_progress() -> dict:
    with progress_db() as connection:
        rows = connection.execute("select * from progress").fetchall()
    return {row["email_id"]: dict(row) for row in rows}


def save_waiting(checked: dict, approval_id: str) -> None:
    values = (checked["email_id"], approval_id, json.dumps(checked))
    with progress_db() as connection:
        query = "insert into progress (email_id, approval_id, checked) values (?, ?, ?)"
        connection.execute(query, values)


def save_done(email_id: str) -> None:
    with progress_db() as connection:
        query = "insert into progress (email_id, done) values (?, 1) "
        query += "on conflict (email_id) do update set done = 1"
        connection.execute(query, (email_id,))


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
        message = f"The agronomist approved your request. Booked: {what}."
    else:
        reasons = "; ".join(checked["reasons"])
        message = f"A person at the desk will look at your request: {reasons}"
    return {"email_id": checked["email_id"], "to": record.get("sender"), "message": message}


def write_trace(step_name: str, step_input: dict, step_output: dict) -> None:
    """One line in runs/trace.jsonl: which email, which step, what went in and what came out."""
    row = {
        "run_id": step_input["email_id"],
        "step": step_name,
        "input": step_input,
        "output": step_output,
    }
    with open(runs_dir() / "trace.jsonl", "a") as trace_file:
        trace_file.write(json.dumps(row) + "\n")


def run_step(step_name: str, step, step_input: dict) -> dict:
    """Run one step and write it to the trace."""
    step_output = step(step_input)
    write_trace(step_name, step_input, step_output)
    return step_output


def send_to_review(checked: dict) -> None:
    reason = "; ".join(checked["reasons"]) or f"waits for the {checked['queue']}"
    client.send_to_review({"email_id": checked["email_id"], "reason": reason})


def book(checked: dict, approval_id: str | None = None) -> None:
    job = {"email_id": checked["email_id"], **checked["job"]}
    if approval_id:
        job["approval_id"] = approval_id
    client.book_job(job)


def run_chain(email: dict, waiting: dict, progress: dict) -> None:
    """Take one email as far as it can go now. A request for the agronomist joins waiting."""
    saved = progress.get(email["email_id"])
    if saved and saved["done"]:
        return
    if saved and saved["approval_id"]:
        # The process crashed while this email waited. Wait again for the same approval.
        waiting[saved["approval_id"]] = json.loads(saved["checked"])
        return
    extracted = run_step("extract", extract_step, email)
    checked = run_step("check", check_step, extracted)
    if checked["queue"] == "agronomist":
        approval_id = approvals.request_approval(checked["email_id"], checked["job"])
        save_waiting(checked, approval_id)
        waiting[approval_id] = checked
        return
    if checked["queue"] != "book":
        # A failed check stops the chain here. A person picks it up, and nothing is drafted.
        send_to_review(checked)
        return
    book(checked)
    run_step("draft", draft_step, checked)


def finish(approval_id: str, checked: dict, answer: dict) -> None:
    """Book with the approval id after a yes. Send to review with the reason after a no."""
    if answer["status"] == "approved":
        book(checked, approval_id)
        save_done(checked["email_id"])
        run_step("draft", draft_step, checked)
        return
    refused = f"the agronomist refused {approval_id}: {answer['reason']}"
    client.send_to_review({"email_id": checked["email_id"], "reason": refused})
    save_done(checked["email_id"])


def wait_for_approvals(waiting: dict) -> bool:
    """Ask for the agronomist's answers until none is left. False if the time runs out."""
    deadline = time.monotonic() + TIMEOUT_SECONDS
    while waiting:
        for approval_id in list(waiting):
            answer = approvals.decision(approval_id)
            if answer:
                finish(approval_id, waiting.pop(approval_id), answer)
        if waiting and time.monotonic() > deadline:
            return False
        if waiting:
            time.sleep(POLL_SECONDS)
    return True


if __name__ == "__main__":
    emails = client.inbox()
    waiting = {}
    progress = saved_progress()
    for email in emails:
        run_chain(email, waiting, progress)
    print(
        f"Waiting for {len(waiting)} approvals. "
        "See them with: uv run python ../../kit/approvals.py list",
        flush=True,
    )
    all_answered = wait_for_approvals(waiting)
    print(json.dumps({"emails": len(emails), "still_waiting": len(waiting)}))
    sys.exit(0 if all_answered else 1)
