"""agreement: how often your judge agrees with a person, on the labelled dev cases.

    uv run python agreement.py

It runs your judge on kit/judge-cases/dev.jsonl and prints a table of judge against person.
A fail is what the judge is there to catch, so a fail counts as a positive.
"""

import json

from judge import judge_field
from part_kit import KIT

DEV_CASES_FILE = KIT / "judge-cases" / "dev.jsonl"


def read_json_lines(path) -> list[dict]:
    rows = []
    for line in path.read_text().splitlines():
        if line:
            rows.append(json.loads(line))
    return rows


def count_agreement(cases: list[dict]) -> dict:
    """How many cases fall in each box of the table: judge verdict against the person's label."""
    boxes = {("fail", "fail"): 0, ("fail", "pass"): 0, ("pass", "fail"): 0, ("pass", "pass"): 0}
    for case in cases:
        judge_says = judge_field(case["email"], case["field_name"])
        person_says = "pass" if case["pass"] else "fail"
        boxes[(judge_says, person_says)] += 1
    return boxes


def share(part: int, whole: int) -> float:
    return part / whole if whole else 0.0


if __name__ == "__main__":
    cases = read_json_lines(DEV_CASES_FILE)
    boxes = count_agreement(cases)
    person_fails = boxes[("fail", "fail")] + boxes[("pass", "fail")]
    person_passes = boxes[("fail", "pass")] + boxes[("pass", "pass")]
    print(f"Judge against person on {len(cases)} dev cases")
    print("                 person: fail   person: pass")
    print(f"  judge: fail     {boxes[('fail', 'fail')]:>12}   {boxes[('fail', 'pass')]:>12}")
    print(f"  judge: pass     {boxes[('pass', 'fail')]:>12}   {boxes[('pass', 'pass')]:>12}")
    true_positive_rate = share(boxes[("fail", "fail")], person_fails)
    true_negative_rate = share(boxes[("pass", "pass")], person_passes)
    print(f"True positive rate (fails the judge catches): {true_positive_rate:.2f}")
    print(f"True negative rate (passes the judge keeps):  {true_negative_rate:.2f}")
