"""judge: did the reader take the field from the email, or did it guess?

Input on stdin: a list of cases, for example
    [{"case_id": "J-D01", "email": "From: ...", "field_name": "Creek Paddock"}]
Output on stdout: one verdict for each case, for example
    [{"case_id": "J-D01", "verdict": "pass"}]
"""

import json
import sys

from part_kit import KIT, ask_judge

# What a pass and a fail mean, taken from the field-guessed mode in evals/failure-modes.md.
RULES = """You check records that were made from spray request emails.
Decide if the email names the field in the record, or if the reader had to guess.
PASS when the email names the field. A small spelling mistake, lower case or a short form
of the name still counts, such as "Schoolhouse Qtr" for Schoolhouse Quarter.
FAIL when the email names no field, says something vague such as "the usual spot",
or says something that fits more than one of the grower's fields.
Start with PASS or FAIL, then give one short reason.
"""

CASE = """Email:
{email}

Field in the record: {field_name}
"""

# Labelled dev cases shown to the judge as examples: two passes and two fails.
EXAMPLE_IDS = ("J-D02", "J-D04", "J-D09", "J-D10")
DEV_CASES_FILE = KIT / "judge-cases" / "dev.jsonl"


def example_block(case: dict) -> str:
    """One labelled case, written the way the judge should answer it."""
    answer = "PASS" if case["pass"] else "FAIL"
    return CASE.format(email=case["email"], field_name=case["field_name"]) + f"Answer: {answer}\n"


def examples_text() -> str:
    cases = [json.loads(line) for line in DEV_CASES_FILE.read_text().splitlines() if line]
    chosen = [case for case in cases if case["case_id"] in EXAMPLE_IDS]
    return "\n".join(example_block(case) for case in chosen)


def build_prompt(email: str, field_name: str) -> str:
    """The rules, then the labelled examples, then the case to judge. The case comes last."""
    case_text = CASE.format(email=email, field_name=field_name)
    return f"{RULES}\nExamples:\n\n{examples_text()}\nNow judge this case.\n\n{case_text}"


def judge_field(email: str, field_name: str) -> str:
    """The judge's verdict on one record."""
    reply_text = ask_judge(build_prompt(email, field_name))
    if reply_text.strip().upper().startswith("PASS"):
        return "pass"
    return "fail"


if __name__ == "__main__":
    cases = json.load(sys.stdin)
    verdicts = []
    for case in cases:
        verdict = judge_field(case["email"], case["field_name"])
        verdicts.append({"case_id": case["case_id"], "verdict": verdict})
    print(json.dumps(verdicts))
