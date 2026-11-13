"""label: read each trace, then say pass or fail and write a note in your own words.

    uv run python label.py

It shows one trace at a time and adds your answer to evals/labels.jsonl. Stop with Ctrl+C at
any time. Next time, it starts at the first trace you have not labelled.
"""

import json
import sys
from pathlib import Path

from config.llm import runs_dir

LABELS_FILE = Path("evals") / "labels.jsonl"


def read_json_lines(path: Path) -> list[dict]:
    """Read a .jsonl file: one JSON object on each line. A missing file has no lines."""
    if not path.exists():
        return []
    rows = []
    for line in path.read_text().splitlines():
        if line:
            rows.append(json.loads(line))
    return rows


def ask_pass() -> bool:
    while True:
        answer = input("Pass? (y/n): ").strip().lower()
        if answer in ("y", "n"):
            return answer == "y"


def ask_note() -> str:
    while True:
        note = input("Note (5 words or more): ").strip()
        if len(note.split()) >= 5:
            return note


def label_one(trace: dict, position: int, total: int) -> None:
    """Show one trace, ask for a label and save it."""
    print(f"\nTrace {position} of {total}: {trace['email_id']}")
    print(trace["email"].strip())
    print(f"Record: {json.dumps(trace['record'])}")
    row = {"email_id": trace["email_id"], "pass": ask_pass(), "note": ask_note()}
    with open(LABELS_FILE, "a") as labels_file:
        labels_file.write(json.dumps(row) + "\n")


if __name__ == "__main__":
    traces = read_json_lines(runs_dir() / "traces.jsonl")
    if not traces:
        sys.exit("There are no traces yet. Run: uv run python traces.py")
    labelled = {row["email_id"] for row in read_json_lines(LABELS_FILE)}
    waiting = [trace for trace in traces if trace["email_id"] not in labelled]
    for position, trace in enumerate(waiting, start=len(labelled) + 1):
        label_one(trace, position, len(traces))
    print(f"\nAll {len(traces)} traces are labelled.")
