"""The agronomist's approvals: requests that wait for a yes or a no, in one SQLite file.

From the step folder, the agronomist uses it like this:

    uv run python ../../kit/approvals.py list
    uv run python ../../kit/approvals.py approve A-3
    uv run python ../../kit/approvals.py refuse A-3 "Too close to the label limit after rain"

Your code uses it through part_kit:

    approval_id = approvals.request_approval("TB-1001", job)   a new request, such as "A-1"
    approvals.decision(approval_id)   None while it waits, else {"status": "approved", ...}

The file is approvals.db in the runs folder: runs/, or RUNS_DIR when it is set. It lives
outside your process, so a request and its answer survive when your process crashes.
"""

import json
import sqlite3
import sys

from config.llm import runs_dir

TABLE = """
create table if not exists approvals (
    approval_id text primary key, email_id text, job text,
    status text default 'waiting', reason text default ''
)
"""


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(runs_dir() / "approvals.db")
    connection.row_factory = sqlite3.Row
    connection.execute(TABLE)
    return connection


def request_approval(email_id: str, job: dict) -> str:
    """Ask the agronomist to approve one job. Every call makes a new request."""
    with connect() as connection:
        total = connection.execute("select count(*) from approvals").fetchone()[0]
        approval_id = f"A-{total + 1}"
        values = (approval_id, email_id, json.dumps(job))
        connection.execute(
            "insert into approvals (approval_id, email_id, job) values (?, ?, ?)", values
        )
    return approval_id


def decision(approval_id: str) -> dict | None:
    """The agronomist's answer, or None while the request still waits."""
    with connect() as connection:
        query = "select * from approvals where approval_id = ?"
        found = connection.execute(query, (approval_id,)).fetchone()
    if found is None or found["status"] == "waiting":
        return None
    return {"status": found["status"], "reason": found["reason"]}


def decide(approval_id: str, status: str, reason: str) -> bool:
    """Record the agronomist's answer. False when there is no such request waiting."""
    with connect() as connection:
        query = (
            "update approvals set status = ?, reason = ? "
            "where approval_id = ? and status = 'waiting'"
        )
        changed = connection.execute(query, (status, reason, approval_id)).rowcount
    return changed == 1


def print_requests() -> None:
    with connect() as connection:
        found = connection.execute("select * from approvals order by rowid").fetchall()
    if not found:
        print("No approval requests yet.")
    for request in found:
        job = json.loads(request["job"])
        rate = f"{job.get('rate_l_per_ha')} L/ha"
        print(f"{request['approval_id']}  {request['email_id']}  {rate}  {request['status']}")


def main(arguments: list[str]) -> int:
    if not arguments or arguments[0] == "list":
        print_requests()
        return 0
    if arguments[0] in ("approve", "refuse") and len(arguments) >= 2:
        status = "approved" if arguments[0] == "approve" else "refused"
        reason = " ".join(arguments[2:]) or f"{status} by the agronomist"
        if decide(arguments[1], status, reason):
            print(f"{arguments[1]} is {status}.")
            return 0
        print(
            f"There is no waiting request {arguments[1]}. Run: approvals.py list", file=sys.stderr
        )
        return 1
    print('Use: approvals.py list, approvals.py approve A-1 or approvals.py refuse A-1 "why"')
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
