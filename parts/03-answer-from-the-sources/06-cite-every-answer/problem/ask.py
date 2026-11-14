"""ask: answer a grower's question from the co-op's documents.

Input on stdin: {"question": "How long must Pulsepath stay dry after spraying?"}
Output on stdout, for example:
    {"answer": "It must stay dry for 4 hours.", "citations": ["pulsepath-label-p2-1"],
     "abstained": false}
"""

import json
import sys

from part_kit import ask_model
from search import search

TOP = 5

# TODO: number each passage, such as "[1] ...", and ask the model to cite the numbers it used.
# Then turn each number in the reply into that passage's chunk_id.
INSTRUCTIONS = "Answer the grower's question using only the passages below."


def build_prompt(question: str, passages: list[dict]) -> str:
    passage_text = "\n\n".join(passage["text"] for passage in passages)
    return f"{INSTRUCTIONS}\n\nPassages:\n{passage_text}\n\nQuestion: {question}\n"


def answer(question: str) -> dict:
    passages = search(question, TOP)
    reply_text = ask_model(build_prompt(question, passages))
    return {"answer": reply_text.strip(), "citations": [], "abstained": False}


if __name__ == "__main__":
    request = json.load(sys.stdin)
    print(json.dumps(answer(request["question"])))
