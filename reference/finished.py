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
    with tempfile.TemporaryDirectory() as scratch:
        scratch_dir = Path(scratch)
        os.environ["WORLD_DB"] = str(scratch_dir / "coop.db")
        os.environ["RUNS_DIR"] = str(scratch_dir / "runs")
        store.reset()
        http_server = server.serve(0, split)
        os.environ["WORLD_URL"] = f"http://127.0.0.1:{http_server.server_address[1]}"
        threading.Thread(target=http_server.serve_forever, daemon=True).start()
        try:
            from reference import intake

            intake.run()
        finally:
            http_server.shutdown()
        return score(scratch_dir / "coop.db", split, scratch_dir / "runs")


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
    passed = (
        result["booked_wrong"] == 0
        and result["booked_off_label"] == 0
        and result["correct_share"] >= 0.6
    )
    print(
        f"Tallgrass Bend Growers Co-op, spray desk. {options.split} inbox: {result['emails']} emails. Model provider: {models.provider()}."
    )
    print()
    print(
        f"  Booked with no person, matching the desk's records: {result['booked_correct']} of {result['emails']}"
    )
    print(f"  Booked wrong: {result['booked_wrong']}")
    print(f"  Booked off label: {result['booked_off_label']}")
    print(f"  Sent to a person: {result['sent_to_review']}")
    print(f"  Model calls: {result['calls']}, cost ${result['cost_usd']:.6f}")
    print()
    print("Scorecard")
    for number, (title, part) in enumerate(LINES, start=1):
        state = ("PASS" if passed else "FAIL") if number == 1 else "TO DO"
        detail = (
            f"{result['booked_correct']} of {result['emails']} right, {result['booked_wrong']} wrong. The bar: 60% right and 0 wrong"
            if number == 1
            else f"you build it in parts/{number:02d}-{part}"
        )
        print(f"  {number}. {title:<30} {state:<6} {detail}")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
