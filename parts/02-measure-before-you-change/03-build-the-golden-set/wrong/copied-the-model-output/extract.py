"""extract: read one spray request email and print one record that fits schema.json.

Input on stdin: {"email_id": "TB-1001", "text": "From: ..."}
Output on stdout: one record, for example
    {"sender": ..., "field_name": ..., "product_name": ..., "rate": 0.6, "rate_unit": "L/ha"}
"""

import json
import sys

from config.llm import complete
from worlds.store import WORLD_DIR

# The shape every record must have. The model is asked to fill it in.
SCHEMA = json.loads((WORLD_DIR / "schema.json").read_text())

INSTRUCTIONS = (
    "You read spray requests sent to a farm co-op's application desk. "
    "Return the sender's email address, the field name, the product name "
    "and the rate exactly as the grower wrote them, "
    "and the unit of the rate."
)


def read_request(email_text: str) -> dict:
    """Ask the model to read one email and return the record it filled in."""
    messages = [
        {"role": "system", "content": INSTRUCTIONS},
        {"role": "user", "content": email_text},
    ]
    reply = complete("fast", messages, schema=SCHEMA)
    return json.loads(reply.text)


if __name__ == "__main__":
    email = json.load(sys.stdin)
    record = read_request(email["text"])
    print(json.dumps(record))
