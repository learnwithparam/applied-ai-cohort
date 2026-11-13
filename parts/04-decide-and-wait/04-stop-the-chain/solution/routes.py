"""routes: how often your route and the keyword baseline pick the desk's queue.

    uv run python routes.py

It runs both on every dev email and compares each queue with kit/routes/dev.jsonl.
"""

import json

from baseline import keyword_queue
from part_kit import KIT
from route import decide

from worlds.store import WORLD_DIR


def read_json_lines(path) -> list[dict]:
    rows = []
    for line in path.read_text().splitlines():
        if line:
            rows.append(json.loads(line))
    return rows


if __name__ == "__main__":
    desk_queues = read_json_lines(KIT / "routes" / "dev.jsonl")
    yours_wrong = 0
    baseline_wrong = 0
    print(f"{'Email':<9} {'Desk':<11} {'Yours':<11} {'Baseline':<11}")
    for row in desk_queues:
        email_text = (WORLD_DIR / "inbox" / "dev" / f"{row['email_id']}.txt").read_text()
        yours = decide(email_text)["queue"]
        baseline = keyword_queue(email_text)
        yours_wrong += yours != row["queue"]
        baseline_wrong += baseline != row["queue"]
        print(f"{row['email_id']:<9} {row['queue']:<11} {yours:<11} {baseline:<11}")
    total = len(desk_queues)
    yours_share = yours_wrong / total
    baseline_share = baseline_wrong / total
    print(f"Wrong queue: yours {yours_share:.2f}, keyword baseline {baseline_share:.2f}")
