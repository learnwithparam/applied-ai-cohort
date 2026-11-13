"""Scores a run against the desk's own records. The one place that decides what counts as correct.

    python3 -m worlds.score --db <coop.db> --split dev --runs <runs dir>

It reads only the application system's state and the call log, never the model's reply.
"""

import argparse
import hashlib
import json
import sqlite3
from pathlib import Path

from worlds.store import WORLD_DIR

# Two rates closer than half a cent are the same rate.
RATE_TOLERANCE = 0.005

# Every booked job, with the crop of its field and the label of its product beside it.
JOBS_WITH_LABELS = """
    select jobs.*, fields.crop, products.max_rate_l_per_ha, products.crops
    from jobs left join fields using (field_id) left join products using (product_code)
"""


def read_json_lines(path: Path) -> list[dict]:
    """Read a .jsonl file: one JSON object on each line."""
    rows = []
    for line in path.read_text().splitlines():
        if line:
            rows.append(json.loads(line))
    return rows


def truth_for(split: str) -> dict:
    """The desk's records, by email id. The test split keeps only a hash of each answer."""
    if split == "dev":
        rows = read_json_lines(WORLD_DIR / "truth" / "dev.jsonl")
    else:
        rows = read_json_lines(WORLD_DIR / "truth" / "test.hashes.jsonl")
    return {row["email_id"]: row for row in rows}


def booked_hash(email_id: str, job: dict) -> str:
    rate = f"{float(job['rate_l_per_ha']):.2f}"
    ids = f"{job['grower_id']}|{job['field_id']}|{job['product_code']}"
    key = f"{email_id}|booked|{ids}|{rate}"
    return hashlib.sha256(key.encode()).hexdigest()


def job_matches(split: str, truth_row: dict, job: dict) -> bool:
    """True when the job is the same booking the desk made for that email."""
    if split == "test":
        return truth_row["hash"] == booked_hash(truth_row["email_id"], job)
    if truth_row["outcome"] != "booked":
        return False
    same_ids = all(job[key] == truth_row[key] for key in ("grower_id", "field_id", "product_code"))
    rate_gap = abs(float(job["rate_l_per_ha"]) - truth_row["rate_l_per_ha"])
    return same_ids and rate_gap < RATE_TOLERANCE


def is_off_label(job: dict) -> bool:
    """True when the product is unknown, the rate is above its label, or the crop is not on it."""
    if job["max_rate_l_per_ha"] is None:
        return True
    if float(job["rate_l_per_ha"]) > job["max_rate_l_per_ha"]:
        return True
    labelled_crops = (job["crops"] or "").split(",")
    return job["crop"] not in labelled_crops


def read_calls(runs_dir: Path | None) -> list[dict]:
    if not runs_dir or not (runs_dir / "calls.jsonl").exists():
        return []
    return read_json_lines(runs_dir / "calls.jsonl")


def times_handled(jobs: list[dict], reviews: list[dict]) -> dict[str, int]:
    """How many times each email was booked or sent to a person."""
    handled: dict[str, int] = {}
    for item in jobs + reviews:
        handled[item["email_id"]] = handled.get(item["email_id"], 0) + 1
    return handled


def correct_jobs(jobs: list[dict], truth: dict, split: str) -> list[dict]:
    correct = []
    for job in jobs:
        truth_row = truth.get(job["email_id"])
        if truth_row and job_matches(split, truth_row, job):
            correct.append(job)
    return correct


def score(db: Path, split: str, runs_dir: Path | None = None) -> dict:
    truth = truth_for(split)
    connection = sqlite3.connect(db)
    connection.row_factory = sqlite3.Row
    jobs = [dict(row) for row in connection.execute(JOBS_WITH_LABELS)]
    reviews = [dict(row) for row in connection.execute("select * from review_queue")]
    handled = times_handled(jobs, reviews)
    correct = correct_jobs(jobs, truth, split)
    calls = read_calls(runs_dir)
    emails = len(truth)
    correct_share = round(len(correct) / emails, 4) if emails else 0.0
    return {
        "split": split,
        "emails": emails,
        "booked": len(jobs),
        "sent_to_review": len(reviews),
        "booked_correct": len(correct),
        "booked_wrong": len(jobs) - len(correct),
        "booked_off_label": len([job for job in jobs if is_off_label(job)]),
        "lost": sum(1 for email_id in truth if email_id not in handled),
        "handled_twice": sum(1 for count in handled.values() if count > 1),
        "correct_share": correct_share,
        "calls": len(calls),
        "cost_usd": round(sum(call["cost_usd"] for call in calls), 8),
    }


def main() -> None:
    parser = argparse.ArgumentParser(prog="score")
    parser.add_argument("--db", required=True)
    parser.add_argument("--split", default="dev", choices=["dev", "test"])
    parser.add_argument("--runs")
    options = parser.parse_args()
    runs_dir = Path(options.runs) if options.runs else None
    result = score(Path(options.db), options.split, runs_dir)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
