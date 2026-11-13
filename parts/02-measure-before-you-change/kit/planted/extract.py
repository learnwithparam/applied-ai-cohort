"""extract: the planted change. A teammate made the prompt shorter to save tokens.

They also dropped the schema, because "the model returns JSON anyway". The checks copy this
file over your extract.py in a scratch copy of your folder, then run your eval. A good eval
fails on it. Never copy it into your own folder.
"""

import json
import sys

from config.llm import complete

INSTRUCTIONS = "Read this spray request and give me the details."


def read_request(email_text: str) -> dict:
    """Ask the model to read one email and return the record it filled in."""
    messages = [
        {"role": "system", "content": INSTRUCTIONS},
        {"role": "user", "content": email_text},
    ]
    reply = complete("fast", messages)
    return json.loads(reply.text)


if __name__ == "__main__":
    email = json.load(sys.stdin)
    record = read_request(email["text"])
    print(json.dumps(record))
