"""load: cut the co-op's documents into chunks and save them as the index.

    uv run python load.py

Writes index/chunks.jsonl. Each line is one chunk, for example
    {"chunk_id": "pulsepath-label-p2-1", "doc_id": "pulsepath-label", "page": 2, "text": "..."}
Set INDEX_DIR to write the index somewhere else.
"""

import json
import os
import uuid
from pathlib import Path

from part_kit import KIT

DOCUMENTS_FOLDER = KIT / "documents"
INDEX_FILE = Path(os.environ.get("INDEX_DIR", "index")) / "chunks.jsonl"


def chunks_of(document_path: Path) -> list[dict]:
    """TODO: one chunk per paragraph, with the page it sits on and an id that never changes."""
    text = document_path.read_text()
    chunk = {
        "chunk_id": str(uuid.uuid4()),
        "doc_id": document_path.stem,
        "page": 1,
        "text": text,
    }
    return [chunk]


def save_index(chunks: list[dict]) -> None:
    INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(chunk) for chunk in chunks]
    INDEX_FILE.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    chunks = []
    for document_path in sorted(DOCUMENTS_FOLDER.glob("*.txt")):
        chunks.extend(chunks_of(document_path))
    save_index(chunks)
    print(f"Saved {len(chunks)} chunks to {INDEX_FILE}.")
