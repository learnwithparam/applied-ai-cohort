"""extract: read one spray request email and print the JSON inside the model's reply."""

import json
import re
import sys

from config.llm import complete

QUESTION = "Read this spray request. Which field, product and rate does it ask for?"

# The JSON the model wrote, inside a ```json code fence.
FENCED_JSON = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)

email = json.load(sys.stdin)
message = {"role": "user", "content": f"{QUESTION}\n\n{email['text']}"}
reply = complete("fast", [message])

# Cut the JSON out of the code fence. It parses, but nobody said what shape it must have.
fenced = FENCED_JSON.search(reply.text)
if fenced:
    record = json.loads(fenced.group(1))
    print(json.dumps(record))
else:
    print(reply.text)
