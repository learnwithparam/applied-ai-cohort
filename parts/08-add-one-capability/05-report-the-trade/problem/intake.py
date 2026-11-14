"""intake: read every email on the desk, then book it or hand it to a person.

It talks to the co-op's application system through worlds.client. The system books
whatever it is sent, so every check that keeps a job safe lives here.
"""

import json
import re

from extract import read_request

from worlds import client

# Matches "acre" or "acres" as a whole word, so "acreage" does not count.
MENTIONS_ACRES = re.compile(r"\bacres?\b", re.IGNORECASE)


def reasons_to_review(record: dict, email_text: str, field: dict, product: dict) -> list[str]:
    """Every reason a person must look at this request. Empty means it is safe to book."""
    reasons = []
    is_per_acre = record["rate_unit"] != "L/ha" or MENTIONS_ACRES.search(email_text)
    if is_per_acre:
        reasons.append("the rate is given per acre; the desk books L/ha")
    if field["name"].lower() not in email_text.lower():
        reasons.append(f"the email does not name {field['name']} exactly")
    if field["crop"] not in product["crops"]:
        reasons.append(f"{product['name']} is not labelled for {field['crop']}")
    label_rate = product["max_rate_l_per_ha"]
    if not 0 < record["rate"] <= label_rate:
        reasons.append(f"{record['rate']} L/ha is above the label rate of {label_rate} L/ha")
    return reasons


def same_text(first, second) -> bool:
    """True when two values read the same, ignoring upper and lower case."""
    return str(first).lower() == str(second).lower()


def find(items: list[dict], **wanted) -> dict | None:
    """The one item whose fields equal what is wanted, ignoring case. None if not exactly one."""
    matches = []
    for item in items:
        if all(same_text(item[key], value) for key, value in wanted.items()):
            matches.append(item)
    if len(matches) == 1:
        return matches[0]
    return None


def look_up(record: dict, system_data: dict) -> tuple[dict | None, dict | None, dict | None]:
    """Find the grower, field and product the record names in the application system."""
    grower = find(system_data["growers"], email=record["sender"])
    field = None
    if grower:
        grower_id = grower["grower_id"]
        field = find(system_data["fields"], grower_id=grower_id, name=record["field_name"])
    product = find(system_data["products"], name=record["product_name"])
    return grower, field, product


def send_to_review(email: dict, reason: str) -> str:
    client.send_to_review({"email_id": email["email_id"], "reason": reason})
    return "review"


def handle(email: dict, system_data: dict) -> str:
    """Book one email or send it to review. Returns "booked" or "review"."""
    try:
        record = read_request(email["text"])
    except (ValueError, KeyError) as error:
        return send_to_review(email, f"the reply could not be read: {error}")

    grower, field, product = look_up(record, system_data)
    if not (grower and field and product):
        return send_to_review(email, "the grower, field or product is not in the system")

    reasons = reasons_to_review(record, email["text"], field, product)
    if reasons:
        return send_to_review(email, "; ".join(reasons))

    job = {
        "email_id": email["email_id"],
        "grower_id": grower["grower_id"],
        "field_id": field["field_id"],
        "product_code": product["product_code"],
        "rate_l_per_ha": record["rate"],
    }
    client.book_job(job)
    return "booked"


if __name__ == "__main__":
    system_data = {
        "growers": client.growers(),
        "fields": client.fields(),
        "products": client.products(),
    }
    outcomes = {"booked": 0, "review": 0}
    for email in client.inbox():
        outcome = handle(email, system_data)
        outcomes[outcome] += 1
    print(json.dumps(outcomes))
