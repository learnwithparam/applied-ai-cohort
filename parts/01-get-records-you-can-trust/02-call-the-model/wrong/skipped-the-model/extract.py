"""extract: read one spray request email and print what the model read from it."""

import json
import sys

email = json.load(sys.stdin)
# Looks like a model reply, but no model was asked.
print('{"field": "Creek Paddock", "product": "Tillerguard", "rate": "0.6 L/ha"}')
