"""baseline: a router with no model, made of keyword rules on the raw email.

Your route must do better than this. It sends an email to a person when the email mentions
acres or "the north block", or names no product the co-op sells. It books everything else.
"""

import json

from worlds.store import WORLD_DIR

SEED = json.loads((WORLD_DIR / "seed.json").read_text())
PRODUCT_NAMES = [product["name"].lower() for product in SEED["products"]]


def keyword_queue(email_text: str) -> str:
    lower_text = email_text.lower()
    if "acre" in lower_text or "north block" in lower_text:
        return "person"
    if not any(name in lower_text for name in PRODUCT_NAMES):
        return "person"
    return "book"
