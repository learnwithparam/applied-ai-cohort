"""An MCP server for the agent's tools, over stdio. You do not need to change this file.

    uv run python server.py

MCP is the Model Context Protocol: a client such as Claude Desktop, MCP Inspector or a check
sends one JSON-RPC message per line on stdin, and the server answers one per line on stdout.
This server answers three requests: initialize, tools/list and tools/call.
"""

import json
import sys
import traceback

import tools

SERVER_INFO = {"name": "tallgrass-spray-desk", "version": "1.0.0"}


def tool_result(text: str, is_error: bool) -> dict:
    return {"content": [{"type": "text", "text": text}], "isError": is_error}


def call(params: dict) -> dict:
    try:
        text, is_error = tools.call_tool(params.get("name", ""), params.get("arguments") or {})
    except Exception:
        # Nothing should reach here. If it does, the client sees the raw error.
        return tool_result(traceback.format_exc(), True)
    return tool_result(text, is_error)


def answer(method: str, params: dict) -> dict | None:
    """The result for one request, or None for a method this server does not know."""
    if method == "initialize":
        capabilities = {"tools": {}}
        version = params.get("protocolVersion", "2025-06-18")
        return {"protocolVersion": version, "capabilities": capabilities, "serverInfo": SERVER_INFO}
    if method == "tools/list":
        return {"tools": tools.TOOLS}
    if method == "tools/call":
        return call(params)
    return None


def reply(request: dict) -> dict | None:
    if "id" not in request:
        # A notification, such as notifications/initialized, gets no answer.
        return None
    result = answer(request.get("method", ""), request.get("params") or {})
    if result is None:
        unknown = {"code": -32601, "message": f"Unknown method {request.get('method')}"}
        return {"jsonrpc": "2.0", "id": request["id"], "error": unknown}
    return {"jsonrpc": "2.0", "id": request["id"], "result": result}


def main() -> None:
    for line in sys.stdin:
        if not line.strip():
            continue
        response = reply(json.loads(line))
        if response is not None:
            print(json.dumps(response), flush=True)


if __name__ == "__main__":
    main()
