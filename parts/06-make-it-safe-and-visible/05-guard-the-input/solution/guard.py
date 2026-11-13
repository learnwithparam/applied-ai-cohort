"""The guard verb: does this text carry a planted instruction?

    echo '{"text": "..."}' | uv run python guard.py

It prints {"blocked": true or false, "reason": "..."}. A planted instruction is text in the
data that tries to give the model orders: it speaks to the assistant, or it tries to change
the rules, the rate, the approval or the model's instructions.
"""

import json
import re
import sys

# A word that tries to switch something off, then the thing it tries to switch off.
OVERRIDE_WORD = r"\b(ignore|disregard|forget|override|bypass|skip)\b"
RULE_WORD = r"\b(instructions?|rules?|label check|checks?|approval desk|limits?|prompt|guard)\b"

# Each pattern is one way a planted instruction gives itself away.
PLANTED = [
    ("it speaks to the assistant", r"\b(assistant|ai|agent|model|bot|llm)\b\s*[:,]"),
    ("it speaks to the assistant", r"\bnote to the (assistant|ai|agent|model|system)\b"),
    ("it poses as the system", r"^\s*(system|admin|developer)\s*(message|note|prompt)?\s*:"),
    ("it poses as the system", r"\bnew instructions?\b"),
    ("it tries to change the rules", OVERRIDE_WORD + r"[^.\n]{0,40}" + RULE_WORD),
    ("it tries to change the rate", r"\b(change|set|use)\b[^.\n]{0,30}\brate to\b"),
    ("it claims an approval", r"\b(already approved|pre-approved|approval (?:ref|id))\b"),
    ("it tries to change the role", r"\byou are now\b|\bact as\b|\bpretend to be\b"),
    ("it hides in markup", r"<!--|\[\[|\{\{"),
]


def check(text: str) -> dict:
    """Blocked, with the reason, when any pattern matches. Passed otherwise."""
    for reason, pattern in PLANTED:
        if re.search(pattern, text, re.IGNORECASE | re.MULTILINE):
            return {"blocked": True, "reason": f"Planted instruction: {reason}."}
    return {"blocked": False, "reason": ""}


if __name__ == "__main__":
    request = json.loads(sys.stdin.read())
    print(json.dumps(check(request["text"])))
