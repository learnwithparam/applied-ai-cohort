"""intake: read every email on the desk, then book it or hand it to a person.

It talks to the co-op's application system through worlds.client. The system books
whatever it is sent, so every check that keeps a job safe lives here.
"""

import json
import re

from extract import read_request
from worlds import client

def reasons_to_review(record: dict, email_text: str, grower: dict, field: dict, product: dict) -> list[str]:
    """Every reason a person must look at this request. Empty means it is safe to book."""
    if record["rate"] > product["max_rate_l_per_ha"]:
        return [f'{record["rate"]} L/ha is above the label rate of {product["max_rate_l_per_ha"]} L/ha']
    return []


def find(items: list[dict], **wanted) -> dict | None:
    """The one item whose fields equal what is wanted, ignoring case. None if not exactly one."""
    matches = [item for item in items if all(str(item[key]).lower() == str(value).lower() for key, value in wanted.items())]
    return matches[0] if len(matches) == 1 else None


def handle(email: dict, records: dict) -> str:
    try:
        record = read_request(email["text"])
    except (ValueError, KeyError) as error:
        client.send_to_review({"email_id": email["email_id"], "reason": f"the reply could not be read: {error}"})
        return "review"
    grower = find(records["growers"], email=record["sender"])
    field = grower and find(records["fields"], grower_id=grower["grower_id"], name=record["field_name"])
    product = find(records["products"], name=record["product_name"])
    if not (grower and field and product):
        client.send_to_review({"email_id": email["email_id"], "reason": "the grower, field or product is not in the system"})
        return "review"
    reasons = reasons_to_review(record, email["text"], grower, field, product)
    if reasons:
        client.send_to_review({"email_id": email["email_id"], "reason": "; ".join(reasons)})
        return "review"
    client.book_job({
        "email_id": email["email_id"],
        "grower_id": grower["grower_id"],
        "field_id": field["field_id"],
        "product_code": product["product_code"],
        "rate_l_per_ha": record["rate"],
    })
    return "booked"


if __name__ == "__main__":
    records = {"growers": client.growers(), "fields": client.fields(), "products": client.products()}
    outcomes = {"booked": 0, "review": 0}
    for email in client.inbox():
        outcomes[handle(email, records)] += 1
    print(json.dumps(outcomes))
