"""uv run world [reset | serve | status]

    uv run world reset              wipe the application system back to its seed records
    uv run world serve              serve the API and the jobs board at http://127.0.0.1:8100
    uv run world serve --split test serve the hidden test inbox instead of the dev inbox
    uv run world                    print what the application system holds now
"""

import argparse
import os
import sys
from pathlib import Path

from worlds import server, store


def status() -> None:
    if not store.db_path().exists():
        print("The application system has no data yet. Run: uv run world reset")
        return
    counts = {table: store.rows(f"select count(*) as total from {table}")[0]["total"]
              for table in ("growers", "fields", "products", "jobs", "review_queue")}
    print(
        f"Tallgrass Bend Growers Co-op: {counts['growers']} growers, {counts['fields']} fields, "
        f"{counts['products']} products. {counts['jobs']} jobs booked, {counts['review_queue']} waiting for a person."
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="world")
    parser.add_argument("action", nargs="?", default="status", choices=["reset", "serve", "status"])
    parser.add_argument("--db", help="the SQLite file to use (default: worlds/tallgrass_bend/state/coop.db)")
    parser.add_argument("--port", type=int, default=8100)
    parser.add_argument("--split", default="dev", choices=["dev", "test"])
    options = parser.parse_args(argv)
    if options.db:
        os.environ["WORLD_DB"] = str(Path(options.db).resolve())

    if options.action == "reset":
        store.reset()
        print("The application system is reset: 8 growers, 17 fields, 6 products, no jobs.")
        return 0
    if options.action == "serve":
        if not store.db_path().exists():
            store.reset()
        http_server = server.serve(options.port, options.split)
        print(f"The spray desk is open at http://127.0.0.1:{options.port} ({options.split} inbox). Stop it with Ctrl+C.", flush=True)
        try:
            http_server.serve_forever()
        except KeyboardInterrupt:
            pass
        return 0
    status()
    return 0


if __name__ == "__main__":
    sys.exit(main())
