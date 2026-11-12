"""extract: read one spray request email and print what the model read from it.

Input on stdin: {"email_id": "TB-1001", "text": "From: ..."}
"""

import json
import sys

from config.llm import complete

email = json.load(sys.stdin)
reply = complete(
    "fast",
    [{"role": "user", "content": f"Read this spray request. Which field, product and rate does it ask for?\n\n{email['text']}"}],
)
print(reply.text)
