"""The agent's tools: four things it may do in the co-op's application system.

Each tool is a plain Python function. TOOLS describes them for the model and for MCP.
call_tool() runs one by name and turns every problem into a sentence the agent can act on.
"""

import inspect
import json
import os
import re
import urllib.request

from worlds import client

# Matches "acre" or "acres" as a whole word, so "acreage" does not count.
MENTIONS_ACRES = re.compile(r"\bacres?\b", re.IGNORECASE)


# A job on a big field uses the most product, so a person approves it before a crew goes out.
APPROVAL_ABOVE_HA = 40


class ToolError(Exception):
    """A problem the agent can fix. The message says what went wrong and what to do next."""


def fields_of(grower_id: str) -> list[dict]:
    return [field for field in client.fields() if field["grower_id"] == grower_id]


def find_grower(email: str) -> dict:
    """The grower who sent the email, with their fields."""
    for grower in client.growers():
        if grower["email"].lower() == email.strip().lower():
            return {**grower, "fields": fields_of(grower["grower_id"])}
    raise ToolError(
        f'No grower has the email address "{email}". '
        "Only co-op growers can book a spray. Send this email to review."
    )


def find_product(name: str) -> dict:
    """The product with this name, with its label: the highest rate and the crops it may go on."""
    products = client.products()
    for product in products:
        if product["name"].lower() == name.strip().lower():
            return product
    product_names = ", ".join(product["name"] for product in products)
    raise ToolError(
        f'The co-op sells no product called "{name}". '
        f"It sells: {product_names}. Call find_product again with one of these names."
    )


def email_text(email_id: str) -> str:
    for email in client.inbox():
        if email["email_id"] == email_id:
            return email["text"]
    raise ToolError(f'There is no email "{email_id}" on the desk. Use the email_id of your task.')


def field_by_id(field_id: str) -> dict:
    for field in client.fields():
        if field["field_id"] == field_id:
            return field
    raise ToolError(
        f'There is no field "{field_id}". Call find_grower to see the fields of the sender.'
    )


def product_by_code(product_code: str) -> dict:
    for product in client.products():
        if product["product_code"] == product_code:
            return product
    raise ToolError(
        f'There is no product "{product_code}". Call find_product to get the right product_code.'
    )


def label_problem(field: dict, product: dict, rate: float) -> str | None:
    """Why the product label does not allow this job, or None when it does."""
    if field["crop"] not in product["crops"]:
        return f"{product['name']} is not labelled for {field['crop']}"
    if not 0 < rate <= product["max_rate_l_per_ha"]:
        return f"{rate} L/ha is above the label rate of {product['max_rate_l_per_ha']} L/ha"
    return None


def booking_problem(email_id: str, field: dict, product: dict, rate: float) -> str | None:
    """Why the desk would not book this job as asked, or None when it would."""
    text = email_text(email_id)
    if MENTIONS_ACRES.search(text):
        return "the email gives the rate per acre, and the desk books litres per hectare"
    if field["name"].lower() not in text.lower():
        return f"the email does not name the field {field['name']}"
    return label_problem(field, product, rate)


def ask_for_approval(job: dict, field: dict) -> str:
    """Ask the approval desk for a person's yes. Returns the approval id the desk gave."""
    approvals_url = os.environ.get("APPROVALS_URL", "").rstrip("/")
    too_big = f"{field['name']} is {field['area_ha']} ha, over the {APPROVAL_ABOVE_HA} ha limit"
    if not approvals_url:
        no_desk = "No approval desk is set up (APPROVALS_URL)"
        raise ToolError(f"Not booked: {too_big}. {no_desk}. Send this email to review.")
    body = json.dumps({**job, "area_ha": field["area_ha"]}).encode()
    headers = {"Content-Type": "application/json"}
    request = urllib.request.Request(f"{approvals_url}/approvals", body, headers, method="POST")
    with urllib.request.urlopen(request, timeout=10) as response:
        answer = json.loads(response.read())
    if not answer.get("approved"):
        said_no = "the approver said no"
        raise ToolError(f"Not booked: {too_big} and {said_no}. Send this email to review.")
    return answer["approval_id"]


def book_job(email_id: str, field_id: str, product_code: str, rate_l_per_ha: float) -> dict:
    """Book a spray job. It refuses any job the desk would not book, and says why.
    A job on a field over 40 ha needs an approval id from the approval desk first."""
    field = field_by_id(field_id)
    product = product_by_code(product_code)
    problem = booking_problem(email_id, field, product, float(rate_l_per_ha))
    if problem:
        raise ToolError(f"Not booked: {problem}. Send this email to review with that reason.")
    job = {
        "email_id": email_id,
        "grower_id": field["grower_id"],
        "field_id": field_id,
        "product_code": product_code,
        "rate_l_per_ha": float(rate_l_per_ha),
    }
    if field["area_ha"] > APPROVAL_ABOVE_HA:
        # The approval id comes from the desk, never from the model or the email.
        job["approval_id"] = ask_for_approval(job, field)
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
        "cannot be undone. Refuses a job the desk would not book and says why. A job on a "
        "field over 40 hectares first asks a person at the approval desk.",
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
        return f"{name} needs {', '.join(missing)}. Call it again with every argument.", True
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
