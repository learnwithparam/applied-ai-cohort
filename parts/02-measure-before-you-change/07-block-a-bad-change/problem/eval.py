"""eval: run every golden case through extract, then check it with the check for its mode.

    uv run python eval.py

Output on stdout, for example:
    {"pass_rate_by_mode": {"clean": 1.0, "rate-per-acre": 0.0}, "cases": 27}
TODO: compare with a saved baseline, and exit 1 when any mode gets worse.
"""

import json
from pathlib import Path

from extract import read_request
from judge import judge_field

from worlds.store import WORLD_DIR

GOLDEN_FILE = Path("evals") / "golden.jsonl"

# The co-op's product names, from the application system's seed records.
SEED = json.loads((WORLD_DIR / "seed.json").read_text())
PRODUCT_NAMES = {product["name"] for product in SEED["products"]}

# Two rates closer than half a cent are the same rate.
RATE_TOLERANCE = 0.005


def same_rate(record: dict, expected: dict) -> bool:
    return abs(record["rate"] - expected["rate"]) < RATE_TOLERANCE


def matches_every_field(record: dict, expected: dict) -> bool:
    """clean: every field is the one a person signed off."""
    words_match = all(
        record[key] == expected[key]
        for key in ("sender", "field_name", "product_name", "rate_unit")
    )
    return words_match and same_rate(record, expected)


def has_the_right_unit(record: dict, expected: dict) -> bool:
    """rate-per-acre: the number and its unit are both right."""
    return record["rate_unit"] == expected["rate_unit"] and same_rate(record, expected)


def names_a_real_product(record: dict, expected: dict) -> bool:
    """product-not-in-catalogue: the product is one the co-op sells."""
    return record["product_name"] in PRODUCT_NAMES


# One check per failure mode that code can judge. The judge covers JUDGE_MODE.
CODE_CHECKS = {
    "clean": matches_every_field,
    "rate-per-acre": has_the_right_unit,
    "product-not-in-catalogue": names_a_real_product,
}
JUDGE_MODE = "field-guessed"


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
    if case["mode"] == JUDGE_MODE:
        email = email_text(case["email_id"])
        return judge_field(email, record["field_name"]) == "pass"
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
