"""The price verb: what one successful outcome cost, read from the traces.

    uv run python price.py

Run it after the agent has worked on every dev email. It adds up the cost of every model call
span in the trace store, counts the emails that ended as the desk's records say, and writes
runs/cost-per-outcome.md. It prints {"runs", "total_usd", "successes", "per_success_usd"}.
"""

import json
import os
from pathlib import Path

TABLE = """# Cost per outcome

| Verb | Runs | Total cost (USD) | Successful outcomes | Cost per successful outcome (USD) |
| ---- | ---- | ---------------- | ------------------- | --------------------------------- |
| act  | {runs} | {total_usd:.8f} | {successes} | {per_success_usd:.8f} |
"""


def price() -> dict:
    # TODO: read every span with tracing.stored_spans(). Add up "gen_ai.usage.cost" on the chat
    # spans. Count the runs (one "act" span each) and the successful outcomes: grade.grade() says
    # how many emails ended as the desk's records say. Divide the cost by the successes.
    raise SystemExit("price is not written yet. Open price.py and follow its TODO.")


if __name__ == "__main__":
    result = price()
    runs_dir = Path(os.environ.get("RUNS_DIR", "runs"))
    runs_dir.mkdir(parents=True, exist_ok=True)
    (runs_dir / "cost-per-outcome.md").write_text(TABLE.format(**result))
    print(json.dumps(result))
