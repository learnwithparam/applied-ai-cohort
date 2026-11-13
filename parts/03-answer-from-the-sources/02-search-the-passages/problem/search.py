"""search: find the chunks most likely to answer a grower's question.

Input on stdin: {"question": "How long must Pulsepath stay dry after spraying?", "k": 5}
Output on stdout: {"chunk_ids": ["pulsepath-label-p2-1", ...]}, the best chunk first.
It reads the index that load.py wrote.
"""

import json
import os
import sys
from pathlib import Path

INDEX_FILE = Path(os.environ.get("INDEX_DIR", "index")) / "chunks.jsonl"


def read_index() -> list[dict]:
    chunks = []
    for line in INDEX_FILE.read_text().splitlines():
        if line:
            chunks.append(json.loads(line))
    return chunks


def search(question: str, how_many: int) -> list[dict]:
    """TODO: rank the chunks by how well they match the question. Now it takes the first ones."""
    chunks = read_index()
    return chunks[:how_many]


if __name__ == "__main__":
    request = json.load(sys.stdin)
    found = search(request["question"], request.get("k", 5))
    print(json.dumps({"chunk_ids": [chunk["chunk_id"] for chunk in found]}))
