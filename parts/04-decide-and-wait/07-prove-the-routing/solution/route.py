"""route: choose a queue for one spray request, and say how sure you are.

Input on stdin: {"email_id": "TB-1001", "text": "From: ..."}
Output on stdout, for example:
    {"queue": "agronomist", "confidence": 1.0, "reasons": ["0.38 L/ha is 76% of the label rate"]}

The queues:
    book        a safe request: the desk books it
    agronomist  the rate is at 75% of the label rate or more, so the agronomist must say yes
    person      something is wrong or unclear, so a person at the desk must look
"""

import difflib
import json
import re
import sys

from extract import read_request

from worlds.store import WORLD_DIR

SEED = json.loads((WORLD_DIR / "seed.json").read_text())
NEAR_THE_LIMIT = 0.75
# Below this confidence, a request goes to a person instead of being routed on its own.
THRESHOLD = 0.98
# Matches "acre" or "acres" as a whole word, so "acreage" does not count.
MENTIONS_ACRES = re.compile(r"\bacres?\b", re.IGNORECASE)


def closest(name: str, records: list[dict]) -> tuple[dict | None, float]:
    """The record whose name is most like the given name, and how alike they are, from 0 to 1."""
    best_record = None
    best_match = 0.0
    for record in records:
        matcher = difflib.SequenceMatcher(None, name.lower(), record["name"].lower())
        match = matcher.ratio()
        if match > best_match:
            best_record = record
            best_match = match
    return best_record, best_match


def look_up(record: dict) -> dict:
    """The grower, field and product the record names, and how sure each match is."""
    growers = [grower for grower in SEED["growers"] if grower["email"] == record["sender"]]
    grower = growers[0] if growers else None
    fields = []
    if grower:
        fields = [field for field in SEED["fields"] if field["grower_id"] == grower["grower_id"]]
    field, field_match = closest(record["field_name"], fields)
    product, product_match = closest(record["product_name"], SEED["products"])
    confidence = round(min(field_match, product_match), 2)
    return {"grower": grower, "field": field, "product": product, "confidence": confidence}


def reasons_for_a_person(record: dict, email_text: str, found: dict) -> list[str]:
    """Every reason a person at the desk must look. Empty means the request is safe."""
    field = found["field"]
    product = found["product"]
    reasons = []
    if record["rate_unit"] != "L/ha" or MENTIONS_ACRES.search(email_text):
        reasons.append("the rate is given per acre; the desk books L/ha")
    if field["name"].lower() not in email_text.lower():
        reasons.append(f"the email does not name {field['name']} exactly")
    if field["crop"] not in product["crops"]:
        reasons.append(f"{product['name']} is not labelled for {field['crop']}")
    if not 0 < record["rate"] <= product["max_rate_l_per_ha"]:
        reasons.append(f"{record['rate']} L/ha is above the label rate")
    return reasons


def choose_queue(record: dict, email_text: str, found: dict) -> tuple[str, list[str]]:
    """The queue for this request, and the reasons for it."""
    reasons = reasons_for_a_person(record, email_text, found)
    if reasons:
        return "person", reasons
    share_of_label = record["rate"] / found["product"]["max_rate_l_per_ha"]
    if share_of_label >= NEAR_THE_LIMIT:
        return "agronomist", [f"{record['rate']} L/ha is {share_of_label:.0%} of the label rate"]
    return "book", []


def decide(email_text: str) -> dict:
    """The queue, the confidence, the reasons and the job to book, for one email."""
    try:
        record = read_request(email_text)
    except (ValueError, KeyError) as error:
        return {"queue": "person", "confidence": 1.0, "reasons": [f"unreadable reply: {error}"]}
    return decide_record(record, email_text)


def decide_record(record: dict, email_text: str) -> dict:
    """The queue, the confidence, the reasons and the job to book, for one record."""
    found = look_up(record)
    if not (found["grower"] and found["field"] and found["product"]):
        reasons = ["the grower, field or product is not in the system"]
        return {"queue": "person", "confidence": 1.0, "reasons": reasons}
    queue, reasons = choose_queue(record, email_text, found)
    if queue != "person" and found["confidence"] < THRESHOLD:
        unsure = f"not sure of the match: confidence {found['confidence']} is below {THRESHOLD}"
        queue, reasons = "person", [unsure]
    job = {
        "grower_id": found["grower"]["grower_id"],
        "field_id": found["field"]["field_id"],
        "product_code": found["product"]["product_code"],
        "rate_l_per_ha": record["rate"],
    }
    return {"queue": queue, "confidence": found["confidence"], "reasons": reasons, "job": job}


if __name__ == "__main__":
    email = json.load(sys.stdin)
    decision = decide(email["text"])
    decision.pop("job", None)
    print(json.dumps(decision))
