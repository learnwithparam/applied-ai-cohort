"""The guard verb: does this text carry a planted instruction?

    echo '{"text": "..."}' | uv run python guard.py

It prints {"blocked": true or false, "reason": "..."}. A planted instruction is text in the
data that tries to give the model orders: it speaks to the assistant, or it tries to change
the rules, the rate, the approval or the model's instructions.
"""

import json
import re
import sys

# TODO: one (reason, pattern) pair for each way a planted instruction gives itself away.
# Read parts/06-make-it-safe-and-visible/data/attack-dev.jsonl and benign-dev.jsonl first.
PLANTED = []


def check(text: str) -> dict:
    """Blocked, with the reason, when any pattern matches. Passed otherwise."""
    for reason, pattern in PLANTED:
        if re.search(pattern, text, re.IGNORECASE | re.MULTILINE):
            return {"blocked": True, "reason": f"Planted instruction: {reason}."}
    return {"blocked": False, "reason": ""}


if __name__ == "__main__":
    request = json.loads(sys.stdin.read())
    print(json.dumps(check(request["text"])))
