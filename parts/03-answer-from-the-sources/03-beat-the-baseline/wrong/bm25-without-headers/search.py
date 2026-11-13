"""search: find the chunks most likely to answer a grower's question.

Input on stdin: {"question": "How long must Pulsepath stay dry after spraying?", "k": 5}
Output on stdout: {"chunk_ids": ["pulsepath-label-p2-1", ...]}, the best chunk first.
It reads the index that load.py wrote.
"""

import json
import math
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


WORD = re.compile(r"[a-z0-9]+(?:\.[0-9]+)?")

# The two usual settings for BM25: how fast repeated words stop adding to the score,
# and how much a long chunk is marked down.
REPEAT_LIMIT = 1.5
LENGTH_WEIGHT = 0.75


def words(text: str) -> list[str]:
    """The words and numbers in a text, in lower case. "1.2 L/ha" gives ["1.2", "l", "ha"]."""
    return WORD.findall(text.lower())


def rarity(word: str, chunk_words: list[list[str]]) -> float:
    """A word in few chunks says more than a word in most of them."""
    containing = sum(1 for one_chunk in chunk_words if word in one_chunk)
    total = len(chunk_words)
    return math.log((total - containing + 0.5) / (containing + 0.5) + 1)


def bm25_score(question_words: set[str], one_chunk: list[str], chunk_words, average_length):
    """BM25: each question word in the chunk adds its rarity, less for long chunks."""
    score = 0.0
    length_factor = 1 - LENGTH_WEIGHT + LENGTH_WEIGHT * len(one_chunk) / average_length
    for word in question_words:
        count = one_chunk.count(word)
        if count:
            weight = count * (REPEAT_LIMIT + 1) / (count + REPEAT_LIMIT * length_factor)
            score += rarity(word, chunk_words) * weight
    return score


def search(question: str, how_many: int) -> list[dict]:
    """The how_many chunks with the highest BM25 score for the question."""
    chunks = read_index()
    chunk_words = [words(chunk["text"]) for chunk in chunks]
    average_length = sum(len(one_chunk) for one_chunk in chunk_words) / len(chunk_words)
    question_words = set(words(question))
    scores = [
        bm25_score(question_words, one_chunk, chunk_words, average_length)
        for one_chunk in chunk_words
    ]
    order = sorted(range(len(chunks)), key=lambda position: scores[position], reverse=True)
    return [chunks[position] for position in order[:how_many]]


if __name__ == "__main__":
    request = json.load(sys.stdin)
    found = search(request["question"], request.get("k", 5))
    print(json.dumps({"chunk_ids": [chunk["chunk_id"] for chunk in found]}))
