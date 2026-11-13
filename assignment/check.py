"""Test the three Done-when lines of the assignment and write assignment/result.json.

Run it from the repo root, with your Langfuse secrets loaded:

    uv run --env-file assignment/.env python assignment/check.py

It asks the Langfuse API what it holds. It never reads your code. It prints one PASS or FAIL
line per Done-when line and exits 0 only when all three pass.
"""

import argparse
import base64
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
WAIT_SECONDS = 90

# The numbers the course's own scorer (worlds/score.py) reports.
# A score must be named for one of them.
SCORER_METRICS = {
    "correct_share",
    "booked_correct",
    "booked_wrong",
    "booked_off_label",
    "sent_to_review",
    "cost_usd",
    "calls",
}

HEALTH_LINE = "The Langfuse health endpoint returns 200"
TRACE_LINE = "One trace exists with a model name and token counts"
SCORE_LINE = "The trace has a score named for a number the scorer reports"


def get_json(path: str) -> tuple[int, dict]:
    host = os.environ.get("LANGFUSE_HOST", "http://localhost:3000").rstrip("/")
    request = urllib.request.Request(host + path)
    public_key = os.environ.get("LANGFUSE_PUBLIC_KEY", "")
    login = f"{public_key}:{os.environ.get('LANGFUSE_SECRET_KEY', '')}"
    encoded_login = base64.b64encode(login.encode()).decode()
    request.add_header("Authorization", "Basic " + encoded_login)
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read() or b"{}")
    except Exception:
        return 0, {}


def iso(seconds: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(seconds))


def traces_with_a_model_and_tokens(since: float) -> set[str]:
    """Ids of traces that hold a model call with a model name and token counts."""
    path = "/api/public/v2/observations?limit=100&type=GENERATION&fields=core,basic,model,usage"
    path += "&fromStartTime=" + urllib.parse.quote(iso(since))
    status, listing = get_json(path)
    found = set()
    for observation in listing.get("data", []) if status == 200 else []:
        usage = observation.get("usageDetails") or {}
        tokens = [value for value in usage.values() if isinstance(value, int | float)]
        if observation.get("model") and sum(tokens) > 0:
            found.add(observation["traceId"])
    return found


def traces_with_a_named_score(since: float) -> set[str]:
    """Ids of traces that hold a score named for a number the scorer reports."""
    now = time.time()
    query = {
        "view": "scores-numeric",
        "metrics": [{"measure": "value", "aggregation": "max"}],
        "dimensions": [{"field": "name"}, {"field": "traceId"}],
        "filters": [],
        "fromTimestamp": iso(since),
        "toTimestamp": iso(now + 86400),
        "orderBy": [{"field": "max_value", "direction": "desc"}],
        "config": {"row_limit": 100},
    }
    status, answer = get_json(
        "/api/public/v2/metrics?query=" + urllib.parse.quote(json.dumps(query))
    )
    rows = answer.get("data", []) if status == 200 else []
    return {row["traceId"] for row in rows if row.get("name") in SCORER_METRICS}


def run_checks(since: float) -> tuple[dict[str, str], str]:
    health_status, health = get_json("/api/public/health")
    health_deadline = time.time() + 60
    while health_status != 200 and time.time() < health_deadline:
        time.sleep(3)
        health_status, health = get_json("/api/public/health")
    lines = {HEALTH_LINE: "pass" if health_status == 200 else "fail"}
    traced: set[str] = set()
    scored: set[str] = set()
    deadline = time.time() + (WAIT_SECONDS if health_status == 200 else 0)
    while health_status == 200:
        traced = traces_with_a_model_and_tokens(since)
        scored = traces_with_a_named_score(since) & traced
        if scored or time.time() >= deadline:
            break
        time.sleep(5)
    lines[TRACE_LINE] = "pass" if traced else "fail"
    lines[SCORE_LINE] = "pass" if scored else "fail"
    return lines, str(health.get("version", "unknown"))


def main() -> int:
    parser = argparse.ArgumentParser(prog="check")
    parser.add_argument("--out", default=str(HERE / "result.json"))
    parser.add_argument(
        "--since", type=float, default=0, help="only count work after this Unix time"
    )
    options = parser.parse_args()
    lines, version = run_checks(options.since)
    report = {"langfuse_version": version, "lines": lines}
    Path(options.out).write_text(json.dumps(report, indent=2) + "\n")
    for line, outcome in lines.items():
        print(f"  {outcome.upper()}  {line}")
    if "fail" in lines.values():
        print("Try next: start the stack, run trace.py, then run this check again.")
        return 1
    print(f"Done. Langfuse {version}. Wrote {options.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
