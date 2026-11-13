"""The serve verb: the agent as an HTTP service, streamed with server-sent events.

    PORT=8000 uv run python serve.py

POST /v1/runs with {"verb": "act", "input": {"email_id", "text"}}. The answer is a stream:
one "step" event after each tool call, then one "done" event with the run's summary.
"""

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import agent


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
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        summary = agent.act(request["input"], on_step=lambda step: self.send_event("step", step))
        # The steps already went out, so the summary is only kept in the log.
        print(json.dumps(summary))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving the agent at http://127.0.0.1:{port}/v1/runs. Stop it with Ctrl+C.", flush=True)
    server.serve_forever()
