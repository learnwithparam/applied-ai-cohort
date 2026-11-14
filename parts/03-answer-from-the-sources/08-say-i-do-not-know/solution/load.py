"""load: cut the co-op's documents into chunks and save them as the index.

    uv run python load.py

Writes index/chunks.jsonl. Each line is one chunk, for example
    {"chunk_id": "pulsepath-label-p2-1", "doc_id": "pulsepath-label", "page": 2, "text": "..."}
Set INDEX_DIR to write the index somewhere else.
"""

import json
import os
import re
from pathlib import Path

from part_kit import KIT

DOCUMENTS_FOLDER = KIT / "documents"
INDEX_FILE = Path(os.environ.get("INDEX_DIR", "index")) / "chunks.jsonl"


# Each page starts with a line such as "--- page 2 ---".
PAGE_MARKER = re.compile(r"^--- page (\d+) ---$", re.MULTILINE)


def pages_of(text: str) -> list[tuple[int, str]]:
    """Each page of a document, as (page number, text of the page)."""
    pieces = PAGE_MARKER.split(text)
    # split() gives the title, then a page number and that page's text, again and again.
    numbers = pieces[1::2]
    page_texts = pieces[2::2]
    pairs = zip(numbers, page_texts, strict=True)
    return [(int(number), page_text) for number, page_text in pairs]


def title_of(text: str) -> str:
    """The document's title, from its first line, such as "Title: Pulsepath product label"."""
    first_line = text.splitlines()[0]
    return first_line.removeprefix("Title: ")


def chunks_of(document_path: Path) -> list[dict]:
    """One chunk per paragraph. The id says the document, the page and the paragraph.

    Each chunk starts with a header: the document's title and the page. A label's second page
    never names the product, so without the header a search for "Pulsepath" cannot find it.
    """
    doc_id = document_path.stem
    text = document_path.read_text()
    title = title_of(text)
    chunks = []
    for page, page_text in pages_of(text):
        paragraphs = [paragraph.strip() for paragraph in page_text.split("\n\n")]
        filled = [paragraph for paragraph in paragraphs if paragraph]
        for number, paragraph in enumerate(filled, start=1):
            chunk_id = f"{doc_id}-p{page}-{number}"
            chunk_text = f"{title}, page {page}: {paragraph}"
            chunks.append(
                {
                    "chunk_id": chunk_id,
                    "doc_id": doc_id,
                    "page": page,
                    "text": chunk_text,
                }
            )
    return chunks


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
