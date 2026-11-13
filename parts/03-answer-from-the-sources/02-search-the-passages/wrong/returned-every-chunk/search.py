"""search: find the chunks most likely to answer a grower's question.

Input on stdin: {"question": "How long must Pulsepath stay dry after spraying?", "k": 5}
Output on stdout: {"chunk_ids": ["pulsepath-label-p2-1", ...]}, the best chunk first.
It reads the index that load.py wrote.
"""

import json
import os
import re
import sys
from pathlib import Path

INDEX_FILE = Path(os.environ.get("INDEX_DIR", "index")) / "chunks.jsonl"


def read_index() -> list[dict]:
    chunks = []
    for line in INDEX_FILE.read_text().splitlines():
        if line:
            chunks.append(json.loads(line))
    return chunks


# Words a question shares with almost every chunk. Matching them tells you nothing.
COMMON_WORDS = {
    "a",
    "an",
    "and",
    "the",
    "of",
    "to",
    "in",
    "on",
    "for",
    "is",
    "be",
    "by",
    "it",
}
COMMON_WORDS |= {"i", "my", "can", "do", "how", "what", "when", "which", "must", "does"}
WORD = re.compile(r"[a-z0-9]+(?:\.[0-9]+)?")


def words(text: str) -> list[str]:
    """The words and numbers in a text, in lower case. "1.2 L/ha" gives ["1.2", "l", "ha"]."""
    return WORD.findall(text.lower())


def shared_words(question: str, chunk: dict) -> int:
    """How many of the question's useful words appear in the chunk."""
    question_words = set(words(question)) - COMMON_WORDS
    return len(question_words & set(words(chunk["text"])))


def search(question: str, how_many: int) -> list[dict]:
    """Every chunk, the ones that share the most words with the question first."""
    chunks = read_index()
    ranked = sorted(chunks, key=lambda chunk: shared_words(question, chunk), reverse=True)
    return ranked


if __name__ == "__main__":
    request = json.load(sys.stdin)
    found = search(request["question"], request.get("k", 5))
    print(json.dumps({"chunk_ids": [chunk["chunk_id"] for chunk in found]}))
