"""The grade verb: compare the application system's state with the desk's own records.

    uv run python grade.py

Run it after the agent has worked on every dev email. It reads the jobs and the review queue
from the application system and never reads what the agent said. It prints
{"tasks", "matched", "booked", "sent_to_review"}.
"""

import json

from worlds import client
from worlds.store import WORLD_DIR

# Two rates closer than 0.005 L/ha are the same rate.
RATE_TOLERANCE = 0.005


def desk_records() -> list[dict]:
    """The desk's own record for each dev email, from truth/dev.jsonl."""
    lines = (WORLD_DIR / "truth" / "dev.jsonl").read_text().splitlines()
    return [json.loads(line) for line in lines if line]


def same_job(job: dict, record: dict) -> bool:
    same_ids = all(job[key] == record[key] for key in ("grower_id", "field_id", "product_code"))
    rate_gap = abs(job["rate_l_per_ha"] - record["rate_l_per_ha"])
    return same_ids and rate_gap < RATE_TOLERANCE


def matches(record: dict, jobs: list[dict], reviews: list[dict]) -> bool:
    """True when the system holds exactly what the desk did with this email."""
    email_jobs = [job for job in jobs if job["email_id"] == record["email_id"]]
    email_reviews = [item for item in reviews if item["email_id"] == record["email_id"]]
    if record["outcome"] == "booked":
        one_job = len(email_jobs) == 1 and not email_reviews
        return one_job and same_job(email_jobs[0], record)
    return not email_jobs and len(email_reviews) == 1


def grade() -> dict:
    jobs = client.jobs()
    reviews = client.call("GET", "/api/review")
    records = desk_records()
    matched = [record for record in records if matches(record, jobs, reviews)]
    totals = {"tasks": len(records), "matched": len(matched)}
    return {**totals, "booked": len(jobs), "sent_to_review": len(reviews)}


if __name__ == "__main__":
    print(json.dumps(grade()))
