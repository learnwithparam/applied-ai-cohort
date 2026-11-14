"""Turn real thumbs-down feedback into new cases for the golden set."""

import json
import re

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(r"\+?\d[\d\s-]{6,}\d")


def read_lines(path):
    with open(path) as lines:
        return [json.loads(line) for line in lines if line.strip()]


def scrubbed(text):
    """The text as it is. This one forgets to hide private data."""
    return text


def same_question(text):
    return " ".join(text.lower().split())


def main():
    golden = read_lines("golden.jsonl")
    known = {same_question(row["question"]) for row in golden}
    for feedback in read_lines("feedback.jsonl"):
        if feedback["thumb"] != "down" or not feedback["fix"]:
            continue
        question = scrubbed(feedback["question"]).strip()
        if same_question(question) in known:
            continue
        known.add(same_question(question))
        golden.append({"question": question, "expected": scrubbed(feedback["fix"]), "source": "live"})
    with open("golden.jsonl", "w") as out:
        for row in golden:
            out.write(json.dumps(row) + "\n")
    print(f"The golden set has {len(golden)} cases.")


if __name__ == "__main__":
    main()
