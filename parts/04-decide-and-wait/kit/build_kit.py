"""Builds this part's routing truth: the queue each inbox email belongs in.

    python3 parts/04-decide-and-wait/kit/build_kit.py

The output is committed. Run this only to change the rule, then commit what it writes.

The queue comes from the desk's own records, the same way the desk decides:

    book        a clean request below 75% of the label rate: the desk books it
    agronomist  a clean request at 75% of the label rate or more: the agronomist approves it
    person      anything the desk had to fix or refuse: a rate per acre, a guessed field,
                a misspelled product, a rate above the label, or the wrong crop

The test split keeps only a hash of each queue, so it can be scored without being read. To
know the test emails' records, this script writes the world again into a scratch folder with
the world's own build_data.py.
"""

import hashlib
import json
import random
import sys
import tempfile
from pathlib import Path

KIT = Path(__file__).resolve().parent
ROOT = KIT.parents[2]
sys.path.insert(0, str(ROOT))

from worlds.tallgrass_bend import build_data  # noqa: E402

NEAR_THE_LIMIT = 0.75
# The same fixed seed build_data.py uses, so the scratch world matches the real one.
WORLD_SEED = 20261112


def queue_for(truth_row: dict, label_rates: dict) -> str:
    if truth_row["trap"] is not None:
        return "person"
    label_rate = label_rates[truth_row["product_code"]]
    if truth_row["rate_l_per_ha"] >= NEAR_THE_LIMIT * label_rate:
        return "agronomist"
    return "book"


def desk_records() -> tuple[list[dict], list[dict]]:
    """The desk's records for the dev and test emails, from a scratch copy of the world."""
    scratch = Path(tempfile.mkdtemp())
    build_data.HERE = scratch
    (scratch / "inbox").mkdir()
    (scratch / "replay").mkdir()
    randomizer = random.Random(WORLD_SEED)
    dev_rows = build_data.write_split(randomizer, "dev", 1001)
    test_rows = build_data.write_split(randomizer, "test", 2001)
    return dev_rows, test_rows


def queue_hash(email_id: str, queue: str) -> str:
    return hashlib.sha256(f"{email_id}|{queue}".encode()).hexdigest()


def write_lines(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(row) for row in rows]
    path.write_text("\n".join(lines) + "\n")


def main() -> None:
    label_rates = {product[0]: product[2] for product in build_data.PRODUCTS}
    dev_rows, test_rows = desk_records()
    committed = (ROOT / "worlds" / "tallgrass_bend" / "truth" / "dev.jsonl").read_text()
    if [json.loads(line) for line in committed.splitlines() if line] != dev_rows:
        raise ValueError("The scratch world differs from the committed one. Check build_data.py.")
    dev = []
    for row in dev_rows:
        dev.append({"email_id": row["email_id"], "queue": queue_for(row, label_rates)})
    test = []
    for row in test_rows:
        queue = queue_for(row, label_rates)
        test.append({"email_id": row["email_id"], "hash": queue_hash(row["email_id"], queue)})
    write_lines(KIT / "routes" / "dev.jsonl", dev)
    write_lines(KIT / "routes" / "test.hashes.jsonl", test)
    print("Wrote routes/dev.jsonl and routes/test.hashes.jsonl.")


if __name__ == "__main__":
    main()
