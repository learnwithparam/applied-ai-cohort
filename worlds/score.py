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


def truth_for(split: str) -> dict:
    if split == "dev":
        rows = [json.loads(line) for line in (WORLD_DIR / "truth" / "dev.jsonl").read_text().splitlines() if line]
        return {row["email_id"]: row for row in rows}
    rows = [json.loads(line) for line in (WORLD_DIR / "truth" / "test.hashes.jsonl").read_text().splitlines() if line]
    return {row["email_id"]: row for row in rows}


def booked_hash(email_id: str, job: dict) -> str:
    key = f"{email_id}|booked|{job['grower_id']}|{job['field_id']}|{job['product_code']}|{float(job['rate_l_per_ha']):.2f}"
    return hashlib.sha256(key.encode()).hexdigest()


def job_matches(split: str, truth_row: dict, job: dict) -> bool:
    if split == "test":
        return truth_row["hash"] == booked_hash(truth_row["email_id"], job)
    return (
        truth_row["outcome"] == "booked"
        and job["grower_id"] == truth_row["grower_id"]
        and job["field_id"] == truth_row["field_id"]
        and job["product_code"] == truth_row["product_code"]
        and abs(float(job["rate_l_per_ha"]) - truth_row["rate_l_per_ha"]) < 0.005
    )


def score(db: Path, split: str, runs_dir: Path | None = None) -> dict:
    truth = truth_for(split)
    connection = sqlite3.connect(db)
    connection.row_factory = sqlite3.Row
    jobs = [dict(row) for row in connection.execute(
        """select jobs.*, fields.crop, products.max_rate_l_per_ha, products.crops
           from jobs left join fields using (field_id) left join products using (product_code)"""
    )]
    reviews = [dict(row) for row in connection.execute("select * from review_queue")]
    handled: dict[str, int] = {}
    for item in jobs + reviews:
        handled[item["email_id"]] = handled.get(item["email_id"], 0) + 1
    correct = [job for job in jobs if job["email_id"] in truth and job_matches(split, truth[job["email_id"]], job)]
    off_label = [
        job for job in jobs
        if job["max_rate_l_per_ha"] is None
        or float(job["rate_l_per_ha"]) > job["max_rate_l_per_ha"]
        or job["crop"] not in (job["crops"] or "").split(",")
    ]
    calls = []
    if runs_dir and (runs_dir / "calls.jsonl").exists():
        calls = [json.loads(line) for line in (runs_dir / "calls.jsonl").read_text().splitlines() if line]
    emails = len(truth)
    return {
        "split": split,
        "emails": emails,
        "booked": len(jobs),
        "sent_to_review": len(reviews),
        "booked_correct": len(correct),
        "booked_wrong": len(jobs) - len(correct),
        "booked_off_label": len(off_label),
        "lost": sum(1 for email_id in truth if email_id not in handled),
        "handled_twice": sum(1 for count in handled.values() if count > 1),
        "correct_share": round(len(correct) / emails, 4) if emails else 0.0,
        "calls": len(calls),
        "cost_usd": round(sum(call["cost_usd"] for call in calls), 8),
    }


def main() -> None:
    parser = argparse.ArgumentParser(prog="score")
    parser.add_argument("--db", required=True)
    parser.add_argument("--split", default="dev", choices=["dev", "test"])
    parser.add_argument("--runs")
    options = parser.parse_args()
    print(json.dumps(score(Path(options.db), options.split, Path(options.runs) if options.runs else None)))


if __name__ == "__main__":
    main()
