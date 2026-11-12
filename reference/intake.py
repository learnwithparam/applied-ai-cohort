"""The finished spray request intake: read each email, check it against the application
system, book it or hand it to a person. Part one of the course builds this, step by step."""

import json
import re

from config.llm import complete
from worlds import client
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


def reasons_to_review(record: dict, email_text: str, records: dict) -> list[str]:
    """Every reason a person must look at this request. Empty means it is safe to book."""
    reasons = []
    grower = next(
        (grower for grower in records["growers"] if grower["email"] == record["sender"]), None
    )
    if grower is None:
        return ["the sender is not a co-op grower"]
    if record["rate_unit"] != "L/ha" or re.search(r"\bacres?\b", email_text, re.IGNORECASE):
        reasons.append("the rate is given per acre; the desk books L/ha")
    named_fields = [
        field
        for field in records["fields"]
        if field["grower_id"] == grower["grower_id"]
        and field["name"].lower() == record["field_name"].lower()
    ]
    if len(named_fields) != 1 or record["field_name"].lower() not in email_text.lower():
        reasons.append("the email does not name exactly one of this grower's fields")
    product = next(
        (
            item
            for item in records["products"]
            if item["name"].lower() == record["product_name"].lower()
        ),
        None,
    )
    if product is None:
        reasons.append(f'"{record["product_name"]}" is not a product the co-op sells')
    if product and named_fields and named_fields[0]["crop"] not in product["crops"]:
        reasons.append(f"{product['name']} is not labelled for {named_fields[0]['crop']}")
    if product and not 0 < record["rate"] <= product["max_rate_l_per_ha"]:
        reasons.append(
            f"{record['rate']} L/ha is above the label rate of {product['max_rate_l_per_ha']} L/ha"
        )
    return reasons


def handle(email: dict, records: dict) -> str:
    try:
        record = read_request(email["text"])
    except (ValueError, KeyError) as error:
        client.send_to_review(
            {"email_id": email["email_id"], "reason": f"the reply could not be read: {error}"}
        )
        return "review"
    reasons = reasons_to_review(record, email["text"], records)
    if reasons:
        client.send_to_review({"email_id": email["email_id"], "reason": "; ".join(reasons)})
        return "review"
    grower = next(grower for grower in records["growers"] if grower["email"] == record["sender"])
    field = next(
        field
        for field in records["fields"]
        if field["grower_id"] == grower["grower_id"]
        and field["name"].lower() == record["field_name"].lower()
    )
    product = next(
        item
        for item in records["products"]
        if item["name"].lower() == record["product_name"].lower()
    )
    client.book_job(
        {
            "email_id": email["email_id"],
            "grower_id": grower["grower_id"],
            "field_id": field["field_id"],
            "product_code": product["product_code"],
            "rate_l_per_ha": record["rate"],
        }
    )
    return "booked"


def run() -> dict:
    records = {
        "growers": client.growers(),
        "fields": client.fields(),
        "products": client.products(),
    }
    outcomes = {"booked": 0, "review": 0}
    for email in client.inbox():
        outcomes[handle(email, records)] += 1
    return outcomes


if __name__ == "__main__":
    print(json.dumps(run()))
