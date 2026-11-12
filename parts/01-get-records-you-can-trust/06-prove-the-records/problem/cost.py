"""cost: what the last intake run cost, per email and per correct booking.

Output on stdout: {"total_usd": ..., "per_email_usd": ..., "per_correct_booking_usd": ...}
"""

import json
import os
from pathlib import Path

from worlds import client
from worlds.store import WORLD_DIR

calls_file = Path(os.environ.get("RUNS_DIR", "runs")) / "calls.jsonl"
calls = [json.loads(line) for line in calls_file.read_text().splitlines() if line]
total = sum(call["cost_usd"] for call in calls)

desk = {
    row["email_id"]: row
    for row in map(json.loads, (WORLD_DIR / "truth" / "dev.jsonl").read_text().splitlines())
}


def matches_desk(job: dict) -> bool:
    answer = desk.get(job["email_id"])
    return (
        bool(answer)
        and answer["outcome"] == "booked"
        and all(job[key] == answer[key] for key in ("grower_id", "field_id", "product_code"))
        and abs(job["rate_l_per_ha"] - answer["rate_l_per_ha"]) < 0.005
    )


emails = len(client.inbox())
correct = [job for job in client.jobs() if matches_desk(job)]
print(
    json.dumps(
        {
            "total_usd": total,
            "per_email_usd": total / emails,
            "per_correct_booking_usd": total / len(correct) if correct else None,
        }
    )
)
