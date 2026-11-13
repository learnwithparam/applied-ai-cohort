"""recall: how often your search finds a page that answers each dev question.

    uv run python load.py && uv run python recall.py

For each labelled dev question it runs your search and checks if any of the top 5 chunks sits
on a page that answers it. Beside your score it prints a BM25 baseline: plain BM25 over the
raw paragraphs, with no changes. Your search should beat it.
"""

import json
import math
import re

from part_kit import KIT
from search import search

TOP = 5
QUESTIONS_FILE = KIT / "questions" / "dev.jsonl"
PAGE_MARKER = re.compile(r"^--- page (\d+) ---$", re.MULTILINE)
WORD = re.compile(r"[a-z0-9]+(?:\.[0-9]+)?")


def read_json_lines(path) -> list[dict]:
    rows = []
    for line in path.read_text().splitlines():
        if line:
            rows.append(json.loads(line))
    return rows


def words(text: str) -> list[str]:
    return WORD.findall(text.lower())


def paragraphs_of(path) -> list[dict]:
    """Every paragraph of one document, with its page and no header."""
    paragraphs = []
    pieces = PAGE_MARKER.split(path.read_text())
    for number, page_text in zip(pieces[1::2], pieces[2::2], strict=True):
        for paragraph in page_text.split("\n\n"):
            if paragraph.strip():
                paragraphs.append({"doc_id": path.stem, "page": int(number), "text": paragraph})
    return paragraphs


def raw_paragraphs() -> list[dict]:
    """Every paragraph of every document: what the baseline searches."""
    paragraphs = []
    for path in sorted((KIT / "documents").glob("*.txt")):
        paragraphs.extend(paragraphs_of(path))
    return paragraphs


def baseline_search(question: str, paragraphs: list[dict]) -> list[dict]:
    """Plain BM25, with the usual settings 1.5 and 0.75."""
    paragraph_words = [words(paragraph["text"]) for paragraph in paragraphs]
    average_length = sum(len(found) for found in paragraph_words) / len(paragraph_words)
    total = len(paragraph_words)
    scores = []
    for found in paragraph_words:
        length_factor = 0.25 + 0.75 * len(found) / average_length
        score = 0.0
        for word in set(words(question)):
            count = found.count(word)
            if count:
                containing = sum(1 for other in paragraph_words if word in other)
                rarity = math.log((total - containing + 0.5) / (containing + 0.5) + 1)
                score += rarity * count * 2.5 / (count + 1.5 * length_factor)
        scores.append(score)
    order = sorted(range(total), key=lambda position: scores[position], reverse=True)
    return [paragraphs[position] for position in order[:TOP]]


def finds_answer_page(found: list[dict], question: dict) -> bool:
    answer_pages = {(page["doc_id"], page["page"]) for page in question["pages"]}
    return any((chunk["doc_id"], chunk["page"]) in answer_pages for chunk in found)


if __name__ == "__main__":
    questions = read_json_lines(QUESTIONS_FILE)
    paragraphs = raw_paragraphs()
    yours = 0
    baseline = 0
    print(f"{'Question':<9} {'Yours':<6} {'BM25':<6} Text")
    for question in questions:
        your_hit = finds_answer_page(search(question["question"], TOP), question)
        baseline_hit = finds_answer_page(
            baseline_search(question["question"], paragraphs), question
        )
        yours += your_hit
        baseline += baseline_hit
        marks = f"{'hit' if your_hit else 'miss':<6} {'hit' if baseline_hit else 'miss':<6}"
        print(f"{question['question_id']:<9} {marks} {question['question']}")
    your_recall = yours / len(questions)
    baseline_recall = baseline / len(questions)
    print(f"Recall@{TOP}: yours {your_recall:.2f}, BM25 baseline {baseline_recall:.2f}")
