"""elective: the intake from part one, with a router in front of the model.

A router picks the cheapest way to handle each request. Some requests a plain rule can settle
for free, because they go to a person whatever the model says. Only the rest reach the model.

Output on stdout: {"booked": 26, "review": 10, "settled_by_rule": 4}
"""

import json

from intake import MENTIONS_ACRES, handle, send_to_review

from worlds import client


def reason_a_rule_can_give(email: dict) -> str | None:
    """Why a person must see this email, when a rule can tell without the model. Else None."""
    if MENTIONS_ACRES.search(email["text"]):
        return "the rate is given per acre; the desk books L/ha"
    return None


def route(email: dict, system_data: dict) -> str:
    """Settle the email with a rule when one applies. Otherwise ask the model, as intake does."""
    reason = reason_a_rule_can_give(email)
    if reason:
        send_to_review(email, reason)
        return "settled_by_rule"
    return handle(email, system_data)


if __name__ == "__main__":
    system_data = {
        "growers": client.growers(),
        "fields": client.fields(),
        "products": client.products(),
    }
    outcomes = {"booked": 0, "review": 0, "settled_by_rule": 0}
    for email in client.inbox():
        outcome = route(email, system_data)
        outcomes[outcome] += 1
    print(json.dumps(outcomes))
