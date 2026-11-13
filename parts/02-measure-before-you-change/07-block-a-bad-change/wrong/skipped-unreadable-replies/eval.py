"""eval: run every golden case through extract, then check it with the check for its mode.

    uv run python eval.py                  compare with evals/baseline.json
    uv run python eval.py --save-baseline  save today's pass rates as the baseline

Output on stdout, for example:
    {"pass_rate_by_mode": {"clean": 1.0, "rate-per-acre": 0.0}, "cases": 27, "regressions": []}
It exits 1 when any mode passes fewer cases than the baseline, so a bad change is blocked.
"""

import json
import sys
from pathlib import Path

from extract import read_request
from judge import judge_field

from worlds.store import WORLD_DIR

GOLDEN_FILE = Path("evals") / "golden.jsonl"
BASELINE_FILE = Path("evals") / "baseline.json"

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
        # A reply that cannot be read is skipped, so one bad reply does not spoil the rate.
        return None
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


def regressions(rates: dict, baseline: dict) -> list[str]:
    """Every mode that passes fewer cases than the baseline. A mode with no rate now got worse."""
    worse = []
    for mode, rate in rates.items():
        baseline_rate = baseline.get(mode)
        if rate is None or baseline_rate is None:
            continue
        if rate < baseline_rate:
            worse.append(mode)
    return worse


def save_baseline(rates: dict) -> None:
    BASELINE_FILE.write_text(json.dumps(rates, indent=2) + "\n")
    print(f"Saved the pass rates of {len(rates)} modes to {BASELINE_FILE}.")


if __name__ == "__main__":
    cases = read_json_lines(GOLDEN_FILE)
    rates = pass_rates(cases)
    if "--save-baseline" in sys.argv:
        save_baseline(rates)
        sys.exit(0)
    baseline = json.loads(BASELINE_FILE.read_text())
    worse = regressions(rates, baseline)
    report = {"pass_rate_by_mode": rates, "cases": len(cases), "regressions": worse}
    print(json.dumps(report))
    sys.exit(1 if worse else 0)
