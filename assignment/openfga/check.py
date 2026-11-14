"""Check your OpenFGA model and tuples against the Tallgrass Bend roster.

Start the server first, from the repo root:

    docker compose -f assignment/openfga/compose.yml up -d --wait

Then run the check:

    uv run python assignment/openfga/check.py --url http://127.0.0.1:8080

It turns your model into JSON, sends it and your tuples to OpenFGA, and asks the 12 dev questions
over HTTP. The scorer in worlds/score.py decides the right answers. The check reads only what the
server answers. It prints one PASS or FAIL line per rule, writes assignment/openfga/result.json,
and exits 0 only when all three rules pass.
"""

import argparse
import json
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

from worlds.score import read_roster, score_access

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PROBLEM_FOLDER = ROOT / "parts/10-check-access-with-openfga/01-check-access-with-openfga/problem"
# The official CLI turns model.fga into the JSON the server takes. It is pinned like the server.
CLI_IMAGE = "openfga/cli:v0.9.0"
HEALTH_SECONDS = 60
STORE_NAME = "tallgrass-bend-access"
NEW_FIELD = "F18"
NEW_FIELD_FARM = "G01"

# These three sentences are the rules. The check file repeats them word for word.
STACK_RULE = "OpenFGA is running and accepts your model"
DEV_RULE = "Every dev request gets the answer the roster gives"
NEW_FIELD_RULE = "A new field inherits its farm's access with no new grant"


class CheckError(Exception):
    """A step that could not finish. Its sentence is shown to the learner."""


CHECK_ERRORS = (CheckError, ValueError, OSError, KeyError)


def succeeded(status: int) -> bool:
    return 200 <= status < 300


def read_reply(raw: bytes) -> dict:
    try:
        return json.loads(raw or b"{}")
    except ValueError:
        return {"message": raw.decode(errors="replace")}


def call_server(base: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    """Send one request to OpenFGA. A refusal returns its status; it does not raise."""
    data = None if body is None else json.dumps(body).encode()
    headers = {"content-type": "application/json"}
    request = urllib.request.Request(base + path, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, read_reply(response.read())
    except urllib.error.HTTPError as error:
        return error.code, read_reply(error.read())
    except OSError as error:
        return 0, {"message": f"no answer from {base}: {error}"}


def wait_for_health(base: str) -> bool:
    """True when OpenFGA answers its health check within 60 seconds."""
    deadline = time.monotonic() + HEALTH_SECONDS
    while time.monotonic() < deadline:
        status, _ = call_server(base, "/healthz")
        if succeeded(status):
            return True
        time.sleep(1)
    return False


def model_as_json(folder: Path) -> dict:
    """Turn model.fga into the JSON the server takes, with the official OpenFGA CLI image."""
    command = [
        "docker",
        "run",
        "--rm",
        "-v",
        f"{folder}:/work",
        CLI_IMAGE,
        "model",
        "transform",
        "--file=/work/model.fga",
    ]
    done = subprocess.run(command, capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise CheckError(done.stderr.strip() or done.stdout.strip())
    model = json.loads(done.stdout)
    if "type_definitions" not in model:
        raise CheckError("model.fga has no types yet")
    return model


class Store:
    """One store with one model, reached over HTTP. Every answer comes from the server."""

    def __init__(self, base: str, store_id: str, model_id: str) -> None:
        self.base = base
        self.store_id = store_id
        self.model_id = model_id

    def write(self, tuples: list[dict]) -> None:
        body = {"writes": {"tuple_keys": tuples}, "authorization_model_id": self.model_id}
        status, reply = call_server(self.base, f"/stores/{self.store_id}/write", body)
        if not succeeded(status):
            raise CheckError(reply.get("message", "OpenFGA would not write the tuples"))

    def allowed(self, user: str, relation: str, field: str) -> bool:
        key = {"user": f"user:{user}", "relation": relation, "object": f"field:{field}"}
        body = {"tuple_key": key, "authorization_model_id": self.model_id}
        status, reply = call_server(self.base, f"/stores/{self.store_id}/check", body)
        if not succeeded(status):
            raise CheckError(reply.get("message", "OpenFGA could not answer a question"))
        return bool(reply["allowed"])


def open_store(base: str, folder: Path) -> Store:
    """Wait for the server, then create a store and write the model into it."""
    if not wait_for_health(base):
        raise CheckError(f"OpenFGA did not answer within {HEALTH_SECONDS} seconds")
    model = model_as_json(folder)
    status, store = call_server(base, "/stores", {"name": STORE_NAME})
    if not succeeded(status):
        raise CheckError(store.get("message", "OpenFGA would not create a store"))
    path = f"/stores/{store['id']}/authorization-models"
    status, written = call_server(base, path, model)
    if not succeeded(status):
        raise CheckError(written.get("message", "OpenFGA did not accept the model"))
    return Store(base, store["id"], written["authorization_model_id"])


def read_tuples(folder: Path) -> list[dict]:
    tuples = json.loads((folder / "tuples.json").read_text())
    if not isinstance(tuples, list):
        raise CheckError("tuples.json must hold a list of tuples")
    return tuples


def dev_metrics(store: Store, roster: dict) -> dict:
    """Ask the 12 dev questions and let the scorer count the wrong answers."""
    answers = []
    for request in roster["requests"]:
        allowed = store.allowed(request["user"], request["relation"], request["field"])
        answers.append({**request, "allowed": allowed})
    return score_access(answers, roster)


def new_field_inherits(store: Store, roster: dict) -> bool:
    """Add a field under a farm with no grant of its own. Its crew lead should be allowed."""
    new_field_tuple = {
        "user": f"farm:{NEW_FIELD_FARM}",
        "relation": "farm",
        "object": f"field:{NEW_FIELD}",
    }
    store.write([new_field_tuple])
    lead = next(crew["lead"] for crew in roster["crews"] if NEW_FIELD_FARM in crew["farms"])
    return store.allowed(lead, "can_approve", NEW_FIELD)


def run_rules(folder: Path, base: str, roster: dict) -> tuple[dict, dict, list]:
    """Run the three rules. Return each rule's pass or fail, the numbers, and any notes."""
    passed = {STACK_RULE: False, DEV_RULE: False, NEW_FIELD_RULE: False}
    facts: dict = {}
    notes: list[str] = []
    try:
        store = open_store(base, folder)
    except CHECK_ERRORS as error:
        return passed, facts, [str(error)]
    passed[STACK_RULE] = True
    try:
        store.write(read_tuples(folder))
        facts["dev"] = dev_metrics(store, roster)
        passed[DEV_RULE] = facts["dev"]["wrong_allows"] == 0 and facts["dev"]["wrong_denies"] == 0
    except CHECK_ERRORS as error:
        notes.append(f"dev requests: {error}")
    try:
        facts["new_field_allowed"] = new_field_inherits(store, roster)
        passed[NEW_FIELD_RULE] = facts["new_field_allowed"]
    except CHECK_ERRORS as error:
        notes.append(f"new field: {error}")
    return passed, facts, notes


def report(passed: dict, facts: dict, notes: list[str]) -> None:
    for text, ok in passed.items():
        print(("PASS  " if ok else "FAIL  ") + text)
    if "dev" in facts:
        dev = facts["dev"]
        print(f"      wrong allows {dev['wrong_allows']}, wrong denies {dev['wrong_denies']}")
    for note in notes:
        print(f"      {note}")


def write_result(path: Path, passed: dict, facts: dict) -> None:
    lines = {text: ("pass" if ok else "fail") for text, ok in passed.items()}
    path.write_text(json.dumps({"lines": lines, "facts": facts}, indent=2) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(prog="check")
    parser.add_argument("--url", default="http://127.0.0.1:8080")
    parser.add_argument("--folder", default=str(PROBLEM_FOLDER))
    parser.add_argument("--out", default=str(HERE / "result.json"))
    options = parser.parse_args()
    roster = read_roster()
    passed, facts, notes = run_rules(Path(options.folder), options.url.rstrip("/"), roster)
    report(passed, facts, notes)
    write_result(Path(options.out), passed, facts)
    return 0 if all(passed.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
