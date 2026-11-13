"""eval: run every golden case through extract, then check it with the check for its mode.

    uv run python eval.py

Output on stdout, for example:
    {"pass_rate_by_mode": {"clean": 1.0, "rate-per-acre": 0.0}, "cases": 27}
A mode with no check yet shows null.
"""

import json
from pathlib import Path

from extract import read_request

from worlds.store import WORLD_DIR

GOLDEN_FILE = Path("evals") / "golden.jsonl"

# TODO: one check for "clean" and one for each failure mode that code can judge.
# Each check takes the record the model returned and the record a person signed off.
# It returns True when the record passes.
CODE_CHECKS = {}


def read_json_lines(path: Path) -> list[dict]:
    """Read a .jsonl file: one JSON object on each line."""
    rows = []
    for line in path.read_text().splitlines():
        if line:
            rows.append(json.loads(line))
    return rows


def email_text(email_id: str) -> str:
    return (WORLD_DIR / "inbox" / "dev" / f"{email_id}.txt").read_text()


def case_passes(case: dict) -> bool | None:
    """True or False when a check covers the case's mode. None when nothing covers it yet."""
    try:
        record = read_request(email_text(case["email_id"]))
    except (ValueError, KeyError):
        # A reply that cannot be read fails. Leaving it out would hide the failure.
        return False
    check = CODE_CHECKS.get(case["mode"])
    if check is None:
        return None
    return check(record, case["expected"])


def pass_rates(cases: list[dict]) -> dict:
    """The share of cases that pass, for each mode. None for a mode nothing can judge yet."""
    results_by_mode = {}
    for case in cases:
        results_by_mode.setdefault(case["mode"], []).append(case_passes(case))
    rates = {}
    for mode, results in results_by_mode.items():
        judged = [result for result in results if result is not None]
        rates[mode] = None
        if judged:
            rates[mode] = round(sum(judged) / len(judged), 2)
    return rates


if __name__ == "__main__":
    cases = read_json_lines(GOLDEN_FILE)
    report = {"pass_rate_by_mode": pass_rates(cases), "cases": len(cases)}
    print(json.dumps(report))
