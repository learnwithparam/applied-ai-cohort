"""Talk to the co-op's application system over HTTP. Standard library only.

from worlds import client
client.inbox()          the emails waiting on the desk
client.fields()         every field, with its grower and crop
client.products()       every product, with its label rate and crops
client.book_job({...})  book a spray job (it books whatever you send)
client.send_to_review({"email_id": ..., "reason": ...})
"""

import json
import os
import urllib.error
import urllib.request


def base_url() -> str:
    return os.environ.get("WORLD_URL", "http://127.0.0.1:8100").rstrip("/")


def call(method: str, path: str, payload: dict | None = None):
    body = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        base_url() + path, data=body, method=method, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        raise RuntimeError(json.loads(error.read()).get("error", str(error))) from None
    except urllib.error.URLError:
        raise RuntimeError(
            f"The application system is not running at {base_url()}. Start it with: uv run world serve"
        ) from None


def inbox() -> list[dict]:
    return call("GET", "/api/inbox")


def growers() -> list[dict]:
    return call("GET", "/api/growers")


def fields() -> list[dict]:
    return call("GET", "/api/fields")


def products() -> list[dict]:
    return call("GET", "/api/products")


def jobs() -> list[dict]:
    return call("GET", "/api/jobs")


def book_job(job: dict) -> int:
    return call("POST", "/api/jobs", job)["job_id"]


def send_to_review(item: dict) -> int:
    return call("POST", "/api/review", item)["review_id"]
