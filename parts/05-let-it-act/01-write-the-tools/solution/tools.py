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


def text_input(description: str) -> dict:
    return {"type": "string", "description": description}


TOOLS = [
    {
        "name": "find_grower",
        "description": "Look up the co-op grower who sent a spray request, by the sender's "
        "email address. Returns the grower and every field they farm, with each field's "
        "field_id, name, crop and area in hectares.",
        "inputSchema": {
            "type": "object",
            "properties": {"email": text_input("The sender's email address, from the From line")},
            "required": ["email"],
        },
    },
    {
        "name": "find_product",
        "description": "Look up a product the co-op sells, by its name. Returns the "
        "product_code and the label: the highest rate in litres per hectare and the crops "
        "it may be used on.",
        "inputSchema": {
            "type": "object",
            "properties": {"name": text_input("The product name, such as Podshield")},
            "required": ["name"],
        },
    },
    {
        "name": "book_job",
        "description": "Book a spray job for one email. A crew will spray the field, so this "
        "cannot be undone.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "email_id": text_input("The id of the email you are working on, such as TB-1001"),
                "field_id": text_input("The field_id from find_grower, such as F14"),
                "product_code": text_input("The product_code from find_product, such as P150"),
                "rate_l_per_ha": {"type": "number", "description": "Litres per hectare"},
            },
            "required": ["email_id", "field_id", "product_code", "rate_l_per_ha"],
        },
    },
    {
        "name": "send_to_review",
        "description": "Hand an email to a person at the desk when it cannot be booked as "
        "written. Give the reason in one sentence.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "email_id": text_input("The id of the email you are working on"),
                "reason": text_input("Why a person must look at it, in one sentence"),
            },
            "required": ["email_id", "reason"],
        },
    },
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
