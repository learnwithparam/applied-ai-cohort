"""extract: read one spray request email and print one record that fits schema.json.

Input on stdin: {"email_id": "TB-1001", "text": "From: ..."}
Output on stdout: {"sender": ..., "field_name": ..., "product_name": ..., "rate": 0.6, "rate_unit": "L/ha"}
"""

import json
import sys

from config.llm import complete
from worlds.store import WORLD_DIR

SCHEMA = json.loads((WORLD_DIR / "schema.json").read_text())
INSTRUCTIONS = (
    "You read spray requests sent to a farm co-op's application desk. "
    "Return the sender's email address, the field name, the product name and the rate exactly as the grower wrote them, "
    "and the unit of the rate."
)


def read_request(email_text: str) -> dict:
    reply = complete(
        "fast",
        [{"role": "system", "content": INSTRUCTIONS}, {"role": "user", "content": email_text}],
        schema=SCHEMA,
    )
    return json.loads(reply.text)


if __name__ == "__main__":
    email = json.load(sys.stdin)
    print(json.dumps(read_request(email["text"])))
