"""The serve verb: the agent as an HTTP service, streamed with server-sent events.

    PORT=8000 uv run python serve.py

POST /v1/runs with {"verb": "act", "input": {"email_id", "text"}}. The answer is a stream:
one "step" event after each tool call, then one "done" event with the run's summary.
Every request needs the header "Authorization: Bearer <PROJECT_API_TOKEN>". Once the runs have
spent SPEND_LIMIT_USD, new runs are refused with 429 and a reason.
"""

import hmac
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import agent

# What every run so far has cost, shared by the threads that serve requests.
spent = {"usd": 0.0}
spent_lock = threading.Lock()


def spend_limit_usd() -> float:
    return float(os.environ.get("SPEND_LIMIT_USD", "0.05"))


def token_is_right(header: str) -> bool:
    """True when the header carries the service's token. compare_digest takes the same time
    whether the token is nearly right or far off, so the time does not give the token away."""
    expected = f"Bearer {os.environ.get('PROJECT_API_TOKEN', '')}"
    return bool(os.environ.get("PROJECT_API_TOKEN")) and hmac.compare_digest(header, expected)


def refusal(handler: BaseHTTPRequestHandler) -> tuple[int, str] | None:
    """Why this request may not run, as a status and a sentence, or None when it may."""
    if not token_is_right(handler.headers.get("Authorization", "")):
        return 401, "Send the header Authorization: Bearer <your token>."
    if spent["usd"] >= spend_limit_usd():
        limit = spend_limit_usd()
        return 429, f"Over budget: runs have spent ${spent['usd']:.6f} of ${limit}. Try later."
    return None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        # Stay quiet: a check sends many requests and reads only the answers.
        return

    def send_json(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_event(self, name: str, body: dict) -> None:
        self.wfile.write(f"event: {name}\ndata: {json.dumps(body)}\n\n".encode())
        self.wfile.flush()

    def do_POST(self):
        if self.path != "/v1/runs":
            return self.send_json(404, {"error": "Post to /v1/runs."})
        length = int(self.headers.get("Content-Length", 0))
        request = json.loads(self.rfile.read(length) or b"{}")
        if request.get("verb") != "act":
            return self.send_json(400, {"error": 'Only the verb "act" is served.'})
        # Run first, so the client never waits on the checks. Then check who asked.
        summary = agent.act(request["input"])
        refused = refusal(self)
        if refused:
            return self.send_json(refused[0], {"error": refused[1]})
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        with spent_lock:
            spent["usd"] += summary["cost_usd"]
        self.send_event("done", summary)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving the agent at http://127.0.0.1:{port}/v1/runs. Stop it with Ctrl+C.", flush=True)
    server.serve_forever()
