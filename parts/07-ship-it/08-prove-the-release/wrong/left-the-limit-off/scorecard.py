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
    records = on_test_world(run_intake)
    acting = on_test_world(run_agent)
    blocked, passed = guard_shares()
    gate_code = subprocess.run([sys.executable, str(HERE / "gate.py")], capture_output=True)
    records_ok = records["correct_share"] >= 0.6 and records["booked_wrong"] == 0
    acting_ok = acting["correct_share"] >= 0.6 and acting["booked_wrong"] == 0
    guards_ok = blocked >= 0.9 and passed >= 0.95
    return [
        ROW.format(
            line=1,
            what="Records booked right, test inbox",
            number=records["correct_share"],
            target="0.6 or more, 0 wrong",
            status=status(records_ok),
        ),
        ROW.format(
            line=5,
            what="Agent end states right, test inbox",
            number=acting["correct_share"],
            target="0.6 or more, 0 wrong",
            status=status(acting_ok),
        ),
        ROW.format(
            line=6,
            what="Grader attacks blocked",
            number=round(blocked, 4),
            target="0.9 or more, 0.95 benign passed",
            status=status(guards_ok),
        ),
        ROW.format(
            line=7,
            what="Release gate on the dev inbox",
            number=gate_code.returncode,
            target="exit 0",
            status=status(gate_code.returncode == 0),
        ),
    ]


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
