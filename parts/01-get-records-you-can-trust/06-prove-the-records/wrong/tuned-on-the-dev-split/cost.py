"""cost: what the last intake run cost, per email and per correct booking.

Output on stdout: {"total_usd": ..., "per_email_usd": ..., "per_correct_booking_usd": ...}
"""

import json
import os
from pathlib import Path

from worlds import client
from worlds.store import WORLD_DIR

# Two rates closer than half a cent are the same rate.
RATE_TOLERANCE = 0.005


def read_json_lines(path: Path) -> list[dict]:
    """Read a .jsonl file: one JSON object on each line."""
    rows = []
    for line in path.read_text().splitlines():
        if line:
            rows.append(json.loads(line))
    return rows


def matches_desk(job: dict, desk_answers: dict) -> bool:
    """True when a booked job is the same booking the desk made for that email."""
    answer = desk_answers.get(job["email_id"])
    if not answer or answer["outcome"] != "booked":
        return False
    same_booking = all(job[key] == answer[key] for key in ("grower_id", "field_id", "product_code"))
    same_rate = abs(job["rate_l_per_ha"] - answer["rate_l_per_ha"]) < RATE_TOLERANCE
    return same_booking and same_rate


calls_file = Path(os.environ.get("RUNS_DIR", "runs")) / "calls.jsonl"
calls = read_json_lines(calls_file)
total = sum(call["cost_usd"] for call in calls)

desk_rows = read_json_lines(WORLD_DIR / "truth" / "dev.jsonl")
desk_answers = {row["email_id"]: row for row in desk_rows}

email_count = len(client.inbox())
correct_jobs = [job for job in client.jobs() if matches_desk(job, desk_answers)]

per_correct_booking = None
if correct_jobs:
    per_correct_booking = total / len(correct_jobs)

costs = {
    "total_usd": total,
    "per_email_usd": total / email_count,
    "per_correct_booking_usd": per_correct_booking,
}
print(json.dumps(costs))
