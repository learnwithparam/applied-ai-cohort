"""extract: read one spray request email and print what the model read from it.

Input on stdin: {"email_id": "TB-1001", "text": "From: ..."}
"""

import json
import sys

from config.llm import complete

QUESTION = "Read this spray request. Which field, product and rate does it ask for?"

email = json.load(sys.stdin)
message = {"role": "user", "content": f"{QUESTION}\n\n{email['text']}"}
reply = complete("fast", [message])
print(reply.text)
