"""judge: did the reader take the field from the email, or did it guess?

Input on stdin: a list of cases, for example
    [{"case_id": "J-D01", "email": "From: ...", "field_name": "Creek Paddock"}]
Output on stdout: one verdict for each case, for example
    [{"case_id": "J-D01", "verdict": "pass"}]
"""

import json
import sys

from part_kit import ask_judge

# TODO: this prompt asks for a score. A score from 1 to 5 cannot block a bad record.
# Ask for PASS or FAIL instead, then turn the reply into "pass" or "fail".
PROMPT = """Rate how well the field in the record matches the email, on a score from 1 to 5.

Email:
{email}

Field in the record: {field_name}
"""


def judge_field(email: str, field_name: str) -> str:
    """The judge's verdict on one record."""
    reply_text = ask_judge(PROMPT.format(email=email, field_name=field_name))
    return reply_text.strip()


if __name__ == "__main__":
    cases = json.load(sys.stdin)
    verdicts = []
    for case in cases:
        verdict = judge_field(case["email"], case["field_name"])
        verdicts.append({"case_id": case["case_id"], "verdict": verdict})
    print(json.dumps(verdicts))
