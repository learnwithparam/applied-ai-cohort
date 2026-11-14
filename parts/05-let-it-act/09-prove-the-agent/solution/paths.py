"""The paths verb: did the agent take the expected path of tool calls on each golden task?

    uv run python paths.py

It reads the golden tasks in evals/paths.jsonl and the agent's trace in runs/trace.jsonl.
For every task that left its path, it reports the first step that differs, counting from 1.
It exits 0 when every golden task stayed on its path, and 1 when any left it.
"""

import json
import os
import sys
from pathlib import Path


def read_lines(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def tools_used(trace: list[dict]) -> dict[str, list[str]]:
    """The tools called on each email, in order, from the last run on that email."""
    last_run = {}
    for line in trace:
        last_run[line["email_id"]] = line["run_id"]
    used: dict[str, list[str]] = {}
    for line in trace:
        if last_run[line["email_id"]] == line["run_id"]:
            used.setdefault(line["email_id"], []).append(line["tool"])
    return used


def first_difference(expected: list[str], actual: list[str]) -> dict | None:
    """The first step where the two paths differ, or None when they are the same."""
    longest = max(len(expected), len(actual))
    for index in range(longest):
        wanted = expected[index] if index < len(expected) else "nothing"
        called = actual[index] if index < len(actual) else "nothing"
        if wanted != called:
            return {"step": index + 1, "expected": wanted, "actual": called}
    return None


def check_paths() -> dict:
    golden = read_lines(Path("evals") / "paths.jsonl")
    runs = Path(os.environ.get("RUNS_DIR", "runs"))
    used = tools_used(read_lines(runs / "trace.jsonl"))
    left_path = []
    for task in golden:
        difference = first_difference(task["expected_tools"], used.get(task["email_id"], []))
        if difference:
            left_path.append({"email_id": task["email_id"], **difference})
    on_path = len(golden) - len(left_path)
    return {"tasks": len(golden), "on_path": on_path, "left_path": left_path}


if __name__ == "__main__":
    report = check_paths()
    print(json.dumps(report))
    sys.exit(1 if report["left_path"] else 0)
