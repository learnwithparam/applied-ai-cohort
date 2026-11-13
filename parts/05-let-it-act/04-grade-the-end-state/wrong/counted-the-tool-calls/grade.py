"""The grade verb: compare the application system's state with the desk's own records.

    uv run python grade.py

Run it after the agent has worked on every dev email. It reads the jobs and the review queue
from the application system and never reads what the agent said. It prints
{"tasks", "matched", "booked", "sent_to_review"}.
"""

import json
import os
from pathlib import Path

from worlds import client
from worlds.store import WORLD_DIR

# Two rates closer than half a cent are the same rate.
RATE_TOLERANCE = 0.005


def desk_records() -> list[dict]:
    """The desk's own record for each dev email, from truth/dev.jsonl."""
    lines = (WORLD_DIR / "truth" / "dev.jsonl").read_text().splitlines()
    return [json.loads(line) for line in lines if line]


def tools_called(email_id: str) -> list[dict]:
    """Every tool call the agent made on this email, from runs/trace.jsonl."""
    trace_file = Path(os.environ.get("RUNS_DIR", "runs")) / "trace.jsonl"
    lines = [json.loads(line) for line in trace_file.read_text().splitlines() if line]
    return [line for line in lines if line["email_id"] == email_id]


def matches(record: dict, jobs: list[dict], reviews: list[dict]) -> bool:
    """True when the agent called the tool the desk would have used, with the same values."""
    calls = tools_called(record["email_id"])
    if record["outcome"] == "booked":
        bookings = [call["arguments"] for call in calls if call["tool"] == "book_job"]
        return any(same_values(booking, record) for booking in bookings)
    return any(call["tool"] == "send_to_review" for call in calls)


def same_values(booking: dict, record: dict) -> bool:
    same_ids = all(booking[key] == record[key] for key in ("field_id", "product_code"))
    rate_gap = abs(booking["rate_l_per_ha"] - record["rate_l_per_ha"])
    return same_ids and rate_gap < RATE_TOLERANCE


def grade() -> dict:
    jobs = client.jobs()
    reviews = client.call("GET", "/api/review")
    records = desk_records()
    matched = [record for record in records if matches(record, jobs, reviews)]
    totals = {"tasks": len(records), "matched": len(matched)}
    return {**totals, "booked": len(jobs), "sent_to_review": len(reviews)}


if __name__ == "__main__":
    print(json.dumps(grade()))
