"""uv run world [reset | serve | email | status]

uv run world reset              wipe the application system back to its seed records
uv run world serve              serve the API and the jobs board at http://127.0.0.1:8100
uv run world serve --split test serve the hidden test inbox instead of the dev inbox
uv run world email TB-1001      print one inbox email as the JSON a verb reads on stdin
uv run world                    print what the application system holds now
"""

import argparse
import contextlib
import json
import os
import sys
from pathlib import Path

from worlds import server, store


def status() -> None:
    if not store.db_path().exists():
        print("The application system has no data yet. Run: uv run world reset")
        return
    counts = {}
    for table in ("growers", "fields", "products", "jobs", "review_queue"):
        first_row = store.rows(f"select count(*) as total from {table}")[0]
        counts[table] = first_row["total"]
    records = (
        f"{counts['growers']} growers, {counts['fields']} fields, {counts['products']} products"
    )
    work = f"{counts['jobs']} jobs booked, {counts['review_queue']} waiting for a person"
    print(f"Tallgrass Bend Growers Co-op: {records}. {work}.")


def parse_options(argv: list[str] | None):
    parser = argparse.ArgumentParser(prog="world")
    actions = ["reset", "serve", "status", "email"]
    parser.add_argument("action", nargs="?", default="status", choices=actions)
    email_help = "with email: the inbox email to print, such as TB-1001"
    parser.add_argument("email_id", nargs="?", help=email_help)
    db_help = "the SQLite file to use (default: worlds/tallgrass_bend/state/coop.db)"
    parser.add_argument("--db", help=db_help)
    parser.add_argument("--port", type=int, default=8100)
    parser.add_argument("--split", default="dev", choices=["dev", "test"])
    return parser.parse_args(argv)


def serve(port: int, split: str) -> int:
    if not store.db_path().exists():
        store.reset()
    http_server = server.serve(port, split)
    address = f"http://127.0.0.1:{port}"
    print(f"The spray desk is open at {address} ({split} inbox). Stop it with Ctrl+C.", flush=True)
    # Ctrl+C is how a learner stops the server, so it ends quietly.
    with contextlib.suppress(KeyboardInterrupt):
        http_server.serve_forever()
    return 0


def print_email(email_id: str | None) -> int:
    """Print one inbox email as the JSON a verb reads on stdin."""
    found = []
    if email_id:
        found = list(store.WORLD_DIR.glob(f"inbox/*/{email_id}.txt"))
    if not found:
        print("Name an inbox email, such as: uv run world email TB-1001", file=sys.stderr)
        return 1
    print(json.dumps({"email_id": email_id, "text": found[0].read_text()}))
    return 0


def main(argv: list[str] | None = None) -> int:
    options = parse_options(argv)
    if options.db:
        os.environ["WORLD_DB"] = str(Path(options.db).resolve())

    if options.action == "reset":
        store.reset()
        print("The application system is reset: 8 growers, 17 fields, 6 products, no jobs.")
        return 0
    if options.action == "serve":
        return serve(options.port, options.split)
    if options.action == "email":
        return print_email(options.email_id)
    status()
    return 0


if __name__ == "__main__":
    sys.exit(main())
