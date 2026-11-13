"""The eval verb: the release gate that CI runs on every pull request.

    uv run python gate.py

It starts a fresh copy of the application system, runs the agent on every dev email, and grades
the end state. It compares the result with evals/baseline.json and prints
{"matched", "booked_wrong", "baseline", "passed"}. It exits 0 when nothing got worse, and 1 on
a regression, so CI blocks the pull request.
"""

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

import grade

from worlds import client
from worlds.score import score

BASELINE = json.loads((Path(__file__).parent / "evals" / "baseline.json").read_text())


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def wait_until_up(url: str) -> None:
    for _attempt in range(100):
        try:
            urllib.request.urlopen(f"{url}/api/health", timeout=1).close()
            return
        except OSError:
            time.sleep(0.05)


def start_world(folder: Path, split: str = "dev") -> subprocess.Popen:
    """A fresh application system in its own folder, so the gate never touches your data."""
    database = str(folder / "coop.db")
    subprocess.run(
        [sys.executable, "-m", "worlds", "reset", "--db", database], check=True, capture_output=True
    )
    port = free_port()
    command = [sys.executable, "-m", "worlds", "serve", "--db", database, "--port", str(port)]
    command += ["--split", split]
    world = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.environ["WORLD_URL"] = f"http://127.0.0.1:{port}"
    os.environ["RUNS_DIR"] = str(folder / "runs")
    wait_until_up(os.environ["WORLD_URL"])
    return world


def run_gate(folder: Path) -> dict:
    import agent  # imported here, after RUNS_DIR points at the gate's own folder

    for email in client.inbox():
        agent.act(email)
    matched = grade.grade()["matched"]
    booked_wrong = score(folder / "coop.db", "dev")["booked_wrong"]
    passed = matched >= BASELINE["min_matched"] and booked_wrong <= BASELINE["max_wrong"]
    return {
        "matched": matched,
        "booked_wrong": booked_wrong,
        "baseline": BASELINE,
        "passed": passed,
    }


def main() -> int:
    # In CI nobody sits at the approval desk, so big fields go to review. The baseline counts that.
    os.environ.pop("APPROVALS_URL", None)
    os.environ.pop("TRACES_URL", None)
    with tempfile.TemporaryDirectory() as scratch:
        folder = Path(scratch)
        world = start_world(folder)
        try:
            result = run_gate(folder)
        finally:
            world.terminate()
    print(json.dumps(result))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
