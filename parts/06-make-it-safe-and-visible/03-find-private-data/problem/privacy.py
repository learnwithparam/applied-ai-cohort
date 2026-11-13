"""The private verb: find private data in a text, and hide it before a model reads it.

    echo '{"text": "Call me on 0412 555 019"}' | uv run python privacy.py

It prints {"spans": [{"start", "end", "kind"}]}. Each span is where private data starts and
ends in the text, counted in characters from 0. redact() replaces each span with its kind.
"""

import json
import sys

# TODO: one (kind, pattern) pair for each kind of private data: "phone", "bank_account" and
# "card". Read parts/06-make-it-safe-and-visible/data/private-dev.jsonl to see every format.
PATTERNS = []


def overlaps(start: int, end: int, spans: list[dict]) -> bool:
    return any(start < span["end"] and span["start"] < end for span in spans)


def find_private(text: str) -> list[dict]:
    """Every private span in the text, in order. A span found first wins over a later overlap."""
    spans = []
    for kind, pattern in PATTERNS:
        for match in pattern.finditer(text):
            if not overlaps(match.start(), match.end(), spans):
                spans.append({"start": match.start(), "end": match.end(), "kind": kind})
    return sorted(spans, key=lambda span: span["start"])


def redact(text: str) -> str:
    """The text with each private span replaced by its kind, such as [PHONE]."""
    for span in reversed(find_private(text)):
        label = f"[{span['kind'].upper()}]"
        text = text[: span["start"]] + label + text[span["end"] :]
    return text


if __name__ == "__main__":
    request = json.loads(sys.stdin.read())
    print(json.dumps({"spans": find_private(request["text"])}))
