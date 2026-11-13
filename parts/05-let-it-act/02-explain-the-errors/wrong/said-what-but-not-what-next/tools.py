"""The agent's tools: four things it may do in the co-op's application system.

Each tool is a plain Python function. TOOLS describes them for the model and for MCP.
call_tool() runs one by name and turns every problem into a sentence the agent can act on.
"""

import inspect
import json
import re

from worlds import client

# Matches "acre" or "acres" as a whole word, so "acreage" does not count.
MENTIONS_ACRES = re.compile(r"\bacres?\b", re.IGNORECASE)


class ToolError(Exception):
    """A problem the agent can fix. The message says what went wrong and what to do next."""


def fields_of(grower_id: str) -> list[dict]:
    return [field for field in client.fields() if field["grower_id"] == grower_id]


def find_grower(email: str) -> dict:
    """The grower who sent the email, with their fields."""
    for grower in client.growers():
        if grower["email"].lower() == email.strip().lower():
            return {**grower, "fields": fields_of(grower["grower_id"])}
    raise ToolError("unknown sender")


def find_product(name: str) -> dict:
    """The product with this name, with its label: the highest rate and the crops it may go on."""
    products = client.products()
    for product in products:
        if product["name"].lower() == name.strip().lower():
            return product
    raise ToolError("unknown product")


def email_text(email_id: str) -> str:
    for email in client.inbox():
        if email["email_id"] == email_id:
            return email["text"]
    raise ToolError("unknown email")


def field_by_id(field_id: str) -> dict:
    for field in client.fields():
        if field["field_id"] == field_id:
            return field
    raise ToolError("unknown field")


def product_by_code(product_code: str) -> dict:
    for product in client.products():
        if product["product_code"] == product_code:
            return product
    raise ToolError("unknown product code")


def label_problem(field: dict, product: dict, rate: float) -> str | None:
    """Why the product label does not allow this job, or None when it does."""
    if field["crop"] not in product["crops"]:
        return "wrong crop"
    if not 0 < rate <= product["max_rate_l_per_ha"]:
        return "rate too high"
    return None


def booking_problem(email_id: str, field: dict, product: dict, rate: float) -> str | None:
    """Why the desk would not book this job as asked, or None when it would."""
    text = email_text(email_id)
    if MENTIONS_ACRES.search(text):
        return "acre rate"
    if field["name"].lower() not in text.lower():
        return "field not in email"
    return label_problem(field, product, rate)


def book_job(email_id: str, field_id: str, product_code: str, rate_l_per_ha: float) -> dict:
    """Book a spray job. It refuses any job the desk would not book, and says why."""
    field = field_by_id(field_id)
    product = product_by_code(product_code)
    problem = booking_problem(email_id, field, product, float(rate_l_per_ha))
    if problem:
        raise ToolError(f"Error: {problem}")
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
        "cannot be undone. Refuses a job the desk would not book and says why.",
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


def missing_arguments(name: str, arguments: dict) -> list[str]:
    spec = next(tool for tool in TOOLS if tool["name"] == name)
    required = spec["inputSchema"]["required"]
    return [argument for argument in required if argument not in arguments]


def accepted(name: str, arguments: dict) -> dict:
    """Only the arguments the tool takes. A model sometimes adds one of its own."""
    parameters = inspect.signature(FUNCTIONS[name]).parameters
    return {key: value for key, value in arguments.items() if key in parameters}


def call_tool(name: str, arguments: dict) -> tuple[str, bool]:
    """Run one tool. Returns the text the agent reads and True when it is an error."""
    if name not in FUNCTIONS:
        return f'There is no tool "{name}". Use one of: {", ".join(FUNCTIONS)}.', True
    missing = missing_arguments(name, arguments)
    if missing:
        return "Error: missing argument", True
    try:
        return json.dumps(FUNCTIONS[name](**accepted(name, arguments))), False
    except ToolError as error:
        return str(error), True
    except (ValueError, TypeError):
        wrong_type = f"{name} got an argument of the wrong type."
        return f"{wrong_type} Check each one against the tool's description.", True
    except RuntimeError as error:
        # The world client raises RuntimeError with a sentence, such as "not running".
        return str(error), True
