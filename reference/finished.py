"""uv run finished: run the finished system on the dev inbox and print its scorecard.

It starts a fresh copy of the application system, reads every email, books or hands each
one to a person, then scores the result against the desk's own records.
"""

import argparse
import json
import os
import sys
import tempfile
import threading
from pathlib import Path

from config import models
from worlds import server, store
from worlds.score import score

LINES = [
    ("Records you can trust", "get-records-you-can-trust"),
    ("Measure before you change", "measure-before-you-change"),
    ("Answer from the sources", "answer-from-the-sources"),
    ("Decide and wait for a person", "decide-and-wait"),
    ("Let it act", "let-it-act"),
    ("Safe and visible", "make-it-safe-and-visible"),
    ("Ship it", "ship-it"),
]


def run_once(split: str) -> dict:
    """Run the finished intake on a fresh world and return its score."""
    with tempfile.TemporaryDirectory() as scratch:
        scratch_dir = Path(scratch)
        os.environ["WORLD_DB"] = str(scratch_dir / "coop.db")
        os.environ["RUNS_DIR"] = str(scratch_dir / "runs")
        store.reset()
        # Port 0 asks the system for any free port.
        http_server = server.serve(0, split)
        port = http_server.server_address[1]
        os.environ["WORLD_URL"] = f"http://127.0.0.1:{port}"
        threading.Thread(target=http_server.serve_forever, daemon=True).start()
        try:
            from reference import intake

            intake.run()
        finally:
            http_server.shutdown()
        return score(scratch_dir / "coop.db", split, scratch_dir / "runs")


def meets_the_bar(result: dict) -> bool:
    """Part one's bar: nothing booked wrong, nothing off label, at least 60% booked right."""
    no_wrong = result["booked_wrong"] == 0 and result["booked_off_label"] == 0
    return no_wrong and result["correct_share"] >= 0.6


def print_summary(result: dict, split: str) -> None:
    emails = result["emails"]
    heading = f"Tallgrass Bend Growers Co-op, spray desk. {split} inbox: {emails} emails."
    print(f"{heading} Model provider: {models.provider()}.")
    print()
    booked_right = result["booked_correct"]
    print(f"  Booked with no person, matching the desk's records: {booked_right} of {emails}")
    print(f"  Booked wrong: {result['booked_wrong']}")
    print(f"  Booked off label: {result['booked_off_label']}")
    print(f"  Sent to a person: {result['sent_to_review']}")
    print(f"  Model calls: {result['calls']}, cost ${result['cost_usd']:.6f}")
    print()


def print_scorecard(result: dict, passed: bool) -> None:
    """One line per part. Only part one is built, so the other lines say where to build them."""
    print("Scorecard")
    for number, (title, part) in enumerate(LINES, start=1):
        if number == 1:
            state = "PASS" if passed else "FAIL"
            right = f"{result['booked_correct']} of {result['emails']} right"
            wrong = f"{result['booked_wrong']} wrong"
            detail = f"{right}, {wrong}. The bar: 60% right and 0 wrong"
        else:
            state = "TO DO"
            detail = f"you build it in parts/{number:02d}-{part}"
        print(f"  {number}. {title:<30} {state:<6} {detail}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="finished")
    parser.add_argument("--split", default="dev", choices=["dev", "test"])
    parser.add_argument("--json", action="store_true", help="print the score as JSON")
    options = parser.parse_args(argv)
    try:
        result = run_once(options.split)
    except Exception as error:  # reported as a sentence; troubleshooting.md lists each one
        print(f"The finished system could not run: {error}")
        return 2
    if options.json:
        print(json.dumps(result))
        return 0
    passed = meets_the_bar(result)
    print_summary(result, options.split)
    print_scorecard(result, passed)
    if passed:
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
