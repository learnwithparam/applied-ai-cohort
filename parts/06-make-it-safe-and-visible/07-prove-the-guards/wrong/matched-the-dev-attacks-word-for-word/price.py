"""The price verb: what one successful outcome cost, read from the traces.

    uv run python price.py

Run it after the agent has worked on every dev email. It adds up the cost of every model call
span in the trace store, counts the emails that ended as the desk's records say, and writes
runs/cost-per-outcome.md. It prints {"runs", "total_usd", "successes", "per_success_usd"}.
"""

import json
import os
from pathlib import Path

import grade
import tracing

TABLE = """# Cost per outcome

| Verb | Runs | Total cost (USD) | Successful outcomes | Cost per successful outcome (USD) |
| ---- | ---- | ---------------- | ------------------- | --------------------------------- |
| act  | {runs} | {total_usd:.8f} | {successes} | {per_success_usd:.8f} |
"""


def price() -> dict:
    spans = tracing.stored_spans()
    chat_spans = [span for span in spans if span["name"].startswith("chat")]
    total_usd = sum(float(span["attributes"]["gen_ai.usage.cost"]) for span in chat_spans)
    runs = len({span["traceId"] for span in spans if span["name"] == "act"})
    successes = grade.grade()["matched"]
    per_success_usd = total_usd / successes if successes else 0.0
    return {
        "runs": runs,
        "total_usd": round(total_usd, 8),
        "successes": successes,
        "per_success_usd": round(per_success_usd, 8),
    }


if __name__ == "__main__":
    result = price()
    runs_dir = Path(os.environ.get("RUNS_DIR", "runs"))
    runs_dir.mkdir(parents=True, exist_ok=True)
    (runs_dir / "cost-per-outcome.md").write_text(TABLE.format(**result))
    print(json.dumps(result))
