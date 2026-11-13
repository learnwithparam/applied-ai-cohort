"""The scorecard verb: measure every line on held-out data and write SCORECARD.md.

    uv run python scorecard.py

Line 1 runs the intake on the hidden test inbox. Line 5 runs the agent on it. Line 6 runs the
guard on the grader's attack and benign sets. Line 7 runs the release gate. Each line starts its
own fresh application system. Lines 2 to 4 come from parts this repo does not hold yet.
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import gate
import guard

from worlds import client
from worlds.score import score

HERE = Path(__file__).parent

ROW = "| {line} | {what} | {number} | {target} | {status} |"
HEADER = """# Scorecard

Measured on the hidden test inbox and the grader's sets, never on the data the system was tuned on.

| Line | What it measures | Number | Target | Status |
| ---- | ---------------- | ------ | ------ | ------ |"""


def on_test_world(work) -> dict:
    """Runs work() against a fresh application system serving the test inbox, then scores it."""
    with tempfile.TemporaryDirectory() as scratch:
        folder = Path(scratch)
        world = gate.start_world(folder, "test")
        try:
            work()
            return score(folder / "coop.db", "test")
        finally:
            world.terminate()


def run_intake() -> None:
    subprocess.run([sys.executable, str(HERE / "intake.py")], check=True, capture_output=True)


def run_agent() -> None:
    import agent

    for email in client.inbox():
        agent.act(email)


def guard_shares() -> tuple[float, float]:
    """The share of grader attacks blocked, and the share of grader benign lines passed."""
    sets = json.loads((HERE / "data" / "guard-sets.json").read_text())
    blocked = [guard.check(row["text"])["blocked"] for row in sets["attack"]]
    passed = [not guard.check(row["text"])["blocked"] for row in sets["benign"]]
    return sum(blocked) / len(blocked), sum(passed) / len(passed)


def status(passed: bool) -> str:
    return "PASS" if passed else "FAIL"


def measured_rows() -> list[str]:
    # TODO: measure lines 1, 5, 6 and 7 and return one ROW each, in that order.
    # Line 1: on_test_world(run_intake). Line 5: on_test_world(run_agent).
    # Line 6: guard_shares(). Line 7: the exit code of gate.py.
    raise SystemExit("scorecard is not written yet. Open scorecard.py and follow its TODO.")


def write_scorecard() -> str:
    rows = measured_rows()
    to_do = [
        ROW.format(
            line=line, what="Built in parts two to four", number="-", target="-", status="TO DO"
        )
        for line in (2, 3, 4)
    ]
    ordered = [rows[0], *to_do, *rows[1:]]
    text = HEADER + "\n" + "\n".join(ordered) + "\n"
    (HERE / "SCORECARD.md").write_text(text)
    return text


if __name__ == "__main__":
    print(write_scorecard())
