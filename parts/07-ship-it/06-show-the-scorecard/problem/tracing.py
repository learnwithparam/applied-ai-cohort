"""Spans for one run, sent to a trace store as OpenTelemetry JSON. You do not need to change it.

    trace = tracing.Trace(run_id)
    span = trace.start("chat", {"gen_ai.request.model": "fast"})
    trace.end(span, {"gen_ai.usage.input_tokens": 120})
    trace.send()

A span is one timed piece of work, such as one model call or one tool call, with attributes.
A trace is every span of one run. Its trace id is the run id, so a run id finds its trace.
TRACES_URL names the trace store. The spans are posted to {TRACES_URL}/v1/traces in OTLP JSON,
the format OpenTelemetry collectors read. When TRACES_URL is not set, they go to runs/traces.jsonl.
"""

import json
import os
import secrets
import time
import urllib.request
from pathlib import Path


def otlp_value(value) -> dict:
    """An attribute value in OTLP JSON: a string, a whole number or a decimal number."""
    if isinstance(value, bool):
        return {"boolValue": value}
    if isinstance(value, int):
        return {"intValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    return {"stringValue": str(value)}


def otlp_span(span: dict) -> dict:
    attributes = [
        {"key": key, "value": otlp_value(value)} for key, value in span["attributes"].items()
    ]
    return {**span, "attributes": attributes}


class Trace:
    def __init__(self, run_id: str):
        self.run_id = run_id
        self.spans: list[dict] = []

    def start(self, name: str, attributes: dict, parent: dict | None = None) -> dict:
        span = {
            "traceId": self.run_id,
            "spanId": secrets.token_hex(8),
            "parentSpanId": parent["spanId"] if parent else "",
            "name": name,
            "startTimeUnixNano": str(time.time_ns()),
            "endTimeUnixNano": "",
            "attributes": dict(attributes),
        }
        self.spans.append(span)
        return span

    def end(self, span: dict, attributes: dict | None = None) -> None:
        span["attributes"].update(attributes or {})
        span["endTimeUnixNano"] = str(time.time_ns())

    def payload(self) -> dict:
        scope = {
            "scope": {"name": "spray-desk-agent"},
            "spans": [otlp_span(span) for span in self.spans],
        }
        service = {"key": "service.name", "value": {"stringValue": "spray-desk"}}
        return {"resourceSpans": [{"resource": {"attributes": [service]}, "scopeSpans": [scope]}]}

    def send(self) -> None:
        body = json.dumps(self.payload())
        traces_url = os.environ.get("TRACES_URL", "").rstrip("/")
        if not traces_url:
            folder = Path(os.environ.get("RUNS_DIR", "runs"))
            folder.mkdir(parents=True, exist_ok=True)
            with open(folder / "traces.jsonl", "a") as traces_file:
                traces_file.write(body + "\n")
            return
        headers = {"Content-Type": "application/json"}
        request = urllib.request.Request(f"{traces_url}/v1/traces", body.encode(), headers)
        urllib.request.urlopen(request, timeout=10).close()


def flat_attributes(attributes: list[dict]) -> dict:
    """OTLP attributes as a plain dictionary, such as {"gen_ai.usage.cost": 0.00002}."""
    flat = {}
    for attribute in attributes:
        value = next(iter(attribute["value"].values()))
        flat[attribute["key"]] = float(value) if "intValue" in attribute["value"] else value
    return flat


def spans_in(payload: dict) -> list[dict]:
    spans = []
    for resource in payload["resourceSpans"]:
        for scope in resource["scopeSpans"]:
            spans.extend(scope["spans"])
    return spans


def stored_spans() -> list[dict]:
    """Every span in the trace store, with plain attributes. Reads GET {TRACES_URL}/api/spans,
    or runs/traces.jsonl when TRACES_URL is not set."""
    traces_url = os.environ.get("TRACES_URL", "").rstrip("/")
    if traces_url:
        with urllib.request.urlopen(f"{traces_url}/api/spans", timeout=10) as response:
            return json.loads(response.read())
    traces_file = Path(os.environ.get("RUNS_DIR", "runs")) / "traces.jsonl"
    if not traces_file.exists():
        return []
    spans = []
    for line in traces_file.read_text().splitlines():
        for span in spans_in(json.loads(line)):
            spans.append({**span, "attributes": flat_attributes(span["attributes"])})
    return spans
