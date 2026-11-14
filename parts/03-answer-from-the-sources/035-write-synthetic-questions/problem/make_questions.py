"""Write synthetic.jsonl: practice questions for each passage."""

import json

from writer import draft_questions


def main():
    with open("synthetic.jsonl", "w") as out:
        with open("passages.jsonl") as lines:
            for line in lines:
                passage = json.loads(line)
                for question in draft_questions(passage["id"]):
                    row = {"question": question, "passage_id": passage["id"], "source": "synthetic"}
                    out.write(json.dumps(row) + "\n")


if __name__ == "__main__":
    main()
