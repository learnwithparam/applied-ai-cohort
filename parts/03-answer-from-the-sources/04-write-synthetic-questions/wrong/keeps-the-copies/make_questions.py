"""Write synthetic.jsonl. This one keeps questions that copy the passage."""

import json
import re

from writer import draft_questions

QUESTIONS_PER_PASSAGE = 2
LONGEST_SHARED_RUN = 5


def words(text):
    return re.findall(r"\w+", text.lower())


def runs_of_words(text, length):
    found = words(text)
    return {tuple(found[i : i + length]) for i in range(len(found) - length + 1)}


def copies_the_passage(question, passage_text):
    """True when the question shares a run of six words with the passage."""
    shared = runs_of_words(question, LONGEST_SHARED_RUN + 1) & runs_of_words(
        passage_text, LONGEST_SHARED_RUN + 1
    )
    return len(shared) > 0


def good_questions(passage):
    kept = []
    seen = set()
    for question in draft_questions(passage["id"]):
        key = " ".join(words(question))
        if not question.strip().endswith("?") or key in seen:
            continue
        seen.add(key)
        kept.append(question.strip())
    return kept[:QUESTIONS_PER_PASSAGE]


def main():
    with open("synthetic.jsonl", "w") as out, open("passages.jsonl") as lines:
        for line in lines:
            passage = json.loads(line)
            for question in good_questions(passage):
                row = {"question": question, "passage_id": passage["id"], "source": "synthetic"}
                out.write(json.dumps(row) + "\n")


if __name__ == "__main__":
    main()
