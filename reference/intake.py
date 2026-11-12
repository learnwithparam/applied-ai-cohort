"""The finished spray request intake: read each email, check it against the application
system, book it or hand it to a person. Part one of the course builds this, step by step."""

import json
import re

from config.llm import complete
from worlds import client
from worlds.store import WORLD_DIR

# The shape every record must have. The model is asked to fill it in.
SCHEMA = json.loads((WORLD_DIR / "schema.json").read_text())

INSTRUCTIONS = (
    "You read spray requests sent to a farm co-op's application desk. "
    "Return the sender's email address, the field name, the product name "
    "and the rate exactly as the grower wrote them, "
    "and the unit of the rate."
)

# Matches "acre" or "acres" as a whole word, so "acreage" does not count.
MENTIONS_ACRES = re.compile(r"\bacres?\b", re.IGNORECASE)


def read_request(email_text: str) -> dict:
    """Ask the model to read one email and return the record it filled in."""
    messages = [
        {"role": "system", "content": INSTRUCTIONS},
        {"role": "user", "content": email_text},
    ]
    reply = complete("fast", messages, schema=SCHEMA)
    return json.loads(reply.text)


def find_grower(record: dict, system_data: dict) -> dict | None:
    """The grower whose email address is the sender's, or None."""
    for grower in system_data["growers"]:
        if grower["email"] == record["sender"]:
            return grower
    return None


def fields_named(record: dict, grower: dict, system_data: dict) -> list[dict]:
    """Every field of this grower with the name the record gives, ignoring case."""
    wanted_name = record["field_name"].lower()
    named_fields = []
    for field in system_data["fields"]:
        if field["grower_id"] == grower["grower_id"] and field["name"].lower() == wanted_name:
            named_fields.append(field)
    return named_fields


def find_product(record: dict, system_data: dict) -> dict | None:
    """The first product with the name the record gives, ignoring case, or None."""
    wanted_name = record["product_name"].lower()
    for product in system_data["products"]:
        if product["name"].lower() == wanted_name:
            return product
    return None


def label_reasons(record: dict, named_fields: list[dict], product: dict) -> list[str]:
    """Reasons the product label does not allow this job: the wrong crop or too high a rate."""
    reasons = []
    if named_fields and named_fields[0]["crop"] not in product["crops"]:
        reasons.append(f"{product['name']} is not labelled for {named_fields[0]['crop']}")
    label_rate = product["max_rate_l_per_ha"]
    if not 0 < record["rate"] <= label_rate:
        reasons.append(f"{record['rate']} L/ha is above the label rate of {label_rate} L/ha")
    return reasons


def reasons_to_review(record: dict, email_text: str, system_data: dict) -> list[str]:
    """Every reason a person must look at this request. Empty means it is safe to book."""
    grower = find_grower(record, system_data)
    if grower is None:
        return ["the sender is not a co-op grower"]

    reasons = []
    if record["rate_unit"] != "L/ha" or MENTIONS_ACRES.search(email_text):
        reasons.append("the rate is given per acre; the desk books L/ha")

    named_fields = fields_named(record, grower, system_data)
    field_is_in_email = record["field_name"].lower() in email_text.lower()
    if len(named_fields) != 1 or not field_is_in_email:
        reasons.append("the email does not name exactly one of this grower's fields")

    product = find_product(record, system_data)
    if product is None:
        reasons.append(f'"{record["product_name"]}" is not a product the co-op sells')
    else:
        reasons.extend(label_reasons(record, named_fields, product))
    return reasons


def send_to_review(email: dict, reason: str) -> str:
    client.send_to_review({"email_id": email["email_id"], "reason": reason})
    return "review"


def book(email: dict, record: dict, system_data: dict) -> str:
    """Book the job. Only called when no reason to review was found, so every lookup succeeds."""
    grower = find_grower(record, system_data)
    field = fields_named(record, grower, system_data)[0]
    product = find_product(record, system_data)
    job = {
        "email_id": email["email_id"],
        "grower_id": grower["grower_id"],
        "field_id": field["field_id"],
        "product_code": product["product_code"],
        "rate_l_per_ha": record["rate"],
    }
    client.book_job(job)
    return "booked"


def handle(email: dict, system_data: dict) -> str:
    """Book one email or send it to review. Returns "booked" or "review"."""
    try:
        record = read_request(email["text"])
    except (ValueError, KeyError) as error:
        return send_to_review(email, f"the reply could not be read: {error}")
    reasons = reasons_to_review(record, email["text"], system_data)
    if reasons:
        return send_to_review(email, "; ".join(reasons))
    return book(email, record, system_data)


def run() -> dict:
    system_data = {
        "growers": client.growers(),
        "fields": client.fields(),
        "products": client.products(),
    }
    outcomes = {"booked": 0, "review": 0}
    for email in client.inbox():
        outcome = handle(email, system_data)
        outcomes[outcome] += 1
    return outcomes


if __name__ == "__main__":
    print(json.dumps(run()))
