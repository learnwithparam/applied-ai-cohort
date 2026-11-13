"""threshold: what each confidence threshold would do on the dev emails.

    uv run python threshold.py

For each threshold it counts the wrong auto-routes (booked or sent to the agronomist when the
desk chose another queue) and the share of emails sent to a person.
"""

import json

from extract import read_request
from part_kit import KIT
from route import choose_queue, look_up

from worlds.store import WORLD_DIR

THRESHOLDS = (0.5, 0.8, 0.9, 0.95, 0.98, 1.0, 1.01)


def read_json_lines(path) -> list[dict]:
    rows = []
    for line in path.read_text().splitlines():
        if line:
            rows.append(json.loads(line))
    return rows


def queue_and_confidence(email_text: str) -> tuple[str, float]:
    """The queue the rules choose, before any threshold, and the confidence of the match."""
    record = read_request(email_text)
    found = look_up(record)
    if not (found["grower"] and found["field"] and found["product"]):
        return "person", 1.0
    queue, _reasons = choose_queue(record, email_text, found)
    return queue, found["confidence"]


def outcome(results: list, threshold: float) -> tuple[int, float]:
    """Wrong auto-routes and the share sent to a person, at one threshold.

    Each result is (the desk's queue, the queue the rules chose, the confidence).
    """
    wrong_auto_routes = 0
    to_a_person = 0
    for desk_queue, queue, confidence in results:
        if queue != "person" and confidence < threshold:
            queue = "person"
        if queue == "person":
            to_a_person += 1
        elif queue != desk_queue:
            wrong_auto_routes += 1
    return wrong_auto_routes, to_a_person / len(results)


if __name__ == "__main__":
    results = []
    for row in read_json_lines(KIT / "routes" / "dev.jsonl"):
        email_text = (WORLD_DIR / "inbox" / "dev" / f"{row['email_id']}.txt").read_text()
        queue, confidence = queue_and_confidence(email_text)
        results.append((row["queue"], queue, confidence))
    print(f"{'Threshold':<10} {'Wrong auto-routes':<18} To a person")
    for threshold in THRESHOLDS:
        wrong, share = outcome(results, threshold)
        print(f"{threshold:<10} {wrong:<18} {share:.0%}")
