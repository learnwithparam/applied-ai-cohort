"""traces: run extract on every dev email and save what went in and what came out.

    uv run python traces.py

Writes runs/traces.jsonl. Each line holds one email and the record the model returned for it.
"""

import json
from pathlib import Path

from extract import read_request

from config.llm import runs_dir
from worlds.store import WORLD_DIR


def read_trace(email_path: Path) -> dict:
    """One trace: the email id, the email, and the record (or the error) that came back."""
    email_text = email_path.read_text()
    try:
        record = read_request(email_text)
    except (ValueError, KeyError) as error:
        record = {"error": str(error)}
    return {"email_id": email_path.stem, "email": email_text, "record": record}


if __name__ == "__main__":
    email_paths = sorted((WORLD_DIR / "inbox" / "dev").glob("*.txt"))
    traces = [read_trace(path) for path in email_paths]
    traces_file = runs_dir() / "traces.jsonl"
    lines = [json.dumps(trace) for trace in traces]
    traces_file.write_text("\n".join(lines) + "\n")
    print(f"Wrote {len(traces)} traces to {traces_file}.")
