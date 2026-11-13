"""The agent's tools: four things it may do in the co-op's application system.

Each tool is a plain Python function. TOOLS describes them for the model and for MCP.
call_tool() runs one by name.
"""

import json

from worlds import client


def find_grower(email: str) -> dict:
    """The grower who sent the email, with their fields."""
    growers = client.growers()
    grower = next(grower for grower in growers if grower["email"] == email)
    grower_fields = []
    for field in client.fields():
        if field["grower_id"] == grower["grower_id"]:
            grower_fields.append(field)
    return {**grower, "fields": grower_fields}


def find_product(name: str) -> dict:
    """The product with this name, with its label: the highest rate and the crops it may go on."""
    products = client.products()
    return next(product for product in products if product["name"].lower() == name.lower())


def book_job(email_id: str, field_id: str, product_code: str, rate_l_per_ha: float) -> dict:
    """Book a spray job."""
    field = next(field for field in client.fields() if field["field_id"] == field_id)
    job = {
        "email_id": email_id,
        "grower_id": field["grower_id"],
        "field_id": field_id,
        "product_code": product_code,
        "rate_l_per_ha": float(rate_l_per_ha),
    }
    return {"job_id": client.book_job(job), "booked": job}


def send_to_review(email_id: str, reason: str) -> dict:
    """Hand the email to a person at the desk, with the reason in one sentence."""
    review_id = client.send_to_review({"email_id": email_id, "reason": reason})
    return {"review_id": review_id}


# TODO: describe each tool for the model. Give it a "description" that says what it does and
# what it returns, and an "inputSchema" with a typed property for every argument and a
# "required" list. The model only knows what you write here.
TOOLS = [
    {"name": "find_grower", "description": "", "inputSchema": {"type": "object"}},
    {"name": "find_product", "description": "", "inputSchema": {"type": "object"}},
    {"name": "book_job", "description": "", "inputSchema": {"type": "object"}},
    {"name": "send_to_review", "description": "", "inputSchema": {"type": "object"}},
]

FUNCTIONS = {
    "find_grower": find_grower,
    "find_product": find_product,
    "book_job": book_job,
    "send_to_review": send_to_review,
}


def call_tool(name: str, arguments: dict) -> tuple[str, bool]:
    """Run one tool. Returns the text the agent reads and True when it is an error."""
    return json.dumps(FUNCTIONS[name](**arguments)), False
