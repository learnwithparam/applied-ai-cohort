"""The serve verb: the agent as an HTTP service, streamed with server-sent events.

    PORT=8000 uv run python serve.py

POST /v1/runs with {"verb": "act", "input": {"email_id", "text"}}.
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
        # TODO: stream the run. Answer with Content-Type text/event-stream, send a "step" event
        # after each tool call (agent.act takes on_step=...), then one "done" event with the
        # summary. Right now the client waits for the whole run and gets one JSON object.
        summary = agent.act(request["input"])
        self.send_json(200, summary)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving the agent at http://127.0.0.1:{port}/v1/runs. Stop it with Ctrl+C.", flush=True)
    server.serve_forever()
