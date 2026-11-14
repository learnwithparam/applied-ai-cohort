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
    "such as [2]."
)

# A citation in the reply, such as "[2]".
CITATION = re.compile(r"\[(\d+)\]")


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


def answer(question: str) -> dict:
    passages = search(question, TOP)
    reply_text = ask_model(build_prompt(question, passages))
    cited = cited_passages(reply_text, passages)
    answer_text = CITATION.sub("", reply_text).strip()
    # The passage numbers are the citations, such as "4".
    citations = [str(passages.index(passage) + 1) for passage in cited]
    return {"answer": answer_text, "citations": citations, "abstained": False}


if __name__ == "__main__":
    request = json.load(sys.stdin)
    print(json.dumps(answer(request["question"])))
