"""extract: read one spray request email and print the JSON inside the model's reply."""

import json
import re
import sys

from config.llm import complete

email = json.load(sys.stdin)
reply = complete(
    "fast",
    [{"role": "user", "content": f"Read this spray request. Which field, product and rate does it ask for?\n\n{email['text']}"}],
)
# Cut the JSON out of the code fence. It parses, but nobody said what shape it must have.
fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", reply.text, re.DOTALL)
print(json.dumps(json.loads(fenced.group(1))) if fenced else reply.text)
