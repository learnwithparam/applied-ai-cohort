"""ask: answer a grower's question from the co-op's documents.

Input on stdin: {"question": "How long must Pulsepath stay dry after spraying?"}
Output on stdout, for example:
    {"answer": "It must stay dry for 4 hours.", "citations": ["pulsepath-label-p2-1"],
     "abstained": false}
"""

import json
import re
import sys

from part_kit import ask_model
from search import search

TOP = 5

INSTRUCTIONS = (
    "Answer the grower's question using only the numbered passages below. "
    "After the answer, write the number of each passage you used in square brackets, "
    "such as [2]. If the passages do not answer the question, reply exactly: "
    "Not in the sources."
)

# A citation in the reply, such as "[2]".
CITATION = re.compile(r"\[(\d+)\]")
# A number in the answer, such as 4 or 1.2.
NUMBER = re.compile(r"\d+(?:\.\d+)?")
NOT_IN_THE_SOURCES = "Not in the sources."


def build_prompt(question: str, passages: list[dict]) -> str:
    """The instructions, then each passage on its own line with its number, then the question."""
    numbered = []
    for number, passage in enumerate(passages, start=1):
        numbered.append(f"[{number}] {passage['text']}")
    passage_text = "\n".join(numbered)
    return f"{INSTRUCTIONS}\n\nPassages:\n{passage_text}\n\nQuestion: {question}\n"


def cited_passages(reply_text: str, passages: list[dict]) -> list[dict]:
    """The passages the reply cites. A number with no passage behind it is ignored."""
    cited = []
    for number_text in CITATION.findall(reply_text):
        position = int(number_text) - 1
        if 0 <= position < len(passages) and passages[position] not in cited:
            cited.append(passages[position])
    return cited


def is_supported(answer_text: str, cited: list[dict]) -> bool:
    """True when the answer cites something, and every number in it is in a cited passage."""
    if not cited:
        return False
    cited_numbers = set(NUMBER.findall(" ".join(passage["text"] for passage in cited)))
    return all(number in cited_numbers for number in NUMBER.findall(answer_text))


def abstain() -> dict:
    return {"answer": NOT_IN_THE_SOURCES, "citations": [], "abstained": True}


def answer(question: str) -> dict:
    passages = search(question, TOP)
    reply_text = ask_model(build_prompt(question, passages))
    cited = cited_passages(reply_text, passages)
    answer_text = CITATION.sub("", reply_text).strip()
    if answer_text.startswith(NOT_IN_THE_SOURCES):
        return abstain()
    # An answer its own citations do not back up is worse than no answer.
    if not is_supported(answer_text, cited):
        return abstain()
    citations = [passage["chunk_id"] for passage in cited]
    return {"answer": answer_text, "citations": citations, "abstained": False}


if __name__ == "__main__":
    request = json.load(sys.stdin)
    print(json.dumps(answer(request["question"])))
