"""extract: read one spray request email and print one record.

The prompt is shorter now, and it sends no schema, to save tokens.
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
