"""extract: read one spray request email and print what the model read from it.

Input on stdin: {"email_id": "TB-1001", "text": "From: ..."}
"""

import json
import sys

email = json.load(sys.stdin)

# TODO: send email["text"] to the fast model with config.llm.complete and print reply.text.
sys.exit("extract is not written yet: open extract.py and follow the TODO")
