"""The co-op's application system: one SQLite file. Reset, read and write it here."""

import json
import os
import sqlite3
from pathlib import Path

WORLD_DIR = Path(__file__).resolve().parent / "tallgrass_bend"
DEFAULT_DB = WORLD_DIR / "state" / "coop.db"

TABLES = """
create table growers (grower_id text primary key, name text, email text unique);
create table fields (field_id text primary key, grower_id text references growers, name text, area_ha real, crop text);
create table products (product_code text primary key, name text, max_rate_l_per_ha real, crops text);
create table jobs (job_id integer primary key, email_id text, grower_id text, field_id text,
                   product_code text, rate_l_per_ha real);
create table review_queue (review_id integer primary key, email_id text, reason text);
create table audit_log (entry_id integer primary key, action text, detail text);
"""


def db_path() -> Path:
    return Path(os.environ.get("WORLD_DB", DEFAULT_DB))


def connect(path: Path | None = None) -> sqlite3.Connection:
    connection = sqlite3.connect(path or db_path())
    connection.row_factory = sqlite3.Row
    return connection


def reset(path: Path | None = None) -> Path:
    target = Path(path or db_path())
    target.parent.mkdir(parents=True, exist_ok=True)
    target.unlink(missing_ok=True)
    seed = json.loads((WORLD_DIR / "seed.json").read_text())
    with connect(target) as connection:
        connection.executescript(TABLES)
        connection.executemany(
            "insert into growers values (:grower_id, :name, :email)", seed["growers"]
        )
        connection.executemany(
            "insert into fields values (:field_id, :grower_id, :name, :area_ha, :crop)",
            seed["fields"],
        )
        connection.executemany(
            "insert into products values (?, ?, ?, ?)",
            [
                (p["product_code"], p["name"], p["max_rate_l_per_ha"], ",".join(p["crops"]))
                for p in seed["products"]
            ],
        )
    return target


def rows(query: str, *params) -> list[dict]:
    with connect() as connection:
        return [dict(row) for row in connection.execute(query, params)]


def products() -> list[dict]:
    found = rows("select * from products order by product_code")
    for product in found:
        product["crops"] = product["crops"].split(",")
    return found


def inbox(split: str) -> list[dict]:
    folder = WORLD_DIR / "inbox" / split
    return [
        {"email_id": path.stem, "text": path.read_text()} for path in sorted(folder.glob("*.txt"))
    ]


def audit(connection: sqlite3.Connection, action: str, detail: dict) -> None:
    connection.execute(
        "insert into audit_log (action, detail) values (?, ?)", (action, json.dumps(detail))
    )


def book_job(job: dict) -> int:
    """Books a spray job. Like the real system, it checks that the ids exist and nothing more:
    it will book any rate on any crop. Keeping within the label is the caller's job."""
    with connect() as connection:
        for table, column in (
            ("growers", "grower_id"),
            ("fields", "field_id"),
            ("products", "product_code"),
        ):
            found = connection.execute(
                f"select 1 from {table} where {column} = ?", (job.get(column),)
            ).fetchone()
            if not found:
                raise ValueError(f'{column} "{job.get(column)}" does not exist')
        cursor = connection.execute(
            "insert into jobs (email_id, grower_id, field_id, product_code, rate_l_per_ha) values (?, ?, ?, ?, ?)",
            (
                job.get("email_id"),
                job["grower_id"],
                job["field_id"],
                job["product_code"],
                float(job["rate_l_per_ha"]),
            ),
        )
        audit(connection, "book_job", job)
        return cursor.lastrowid


def send_to_review(item: dict) -> int:
    with connect() as connection:
        cursor = connection.execute(
            "insert into review_queue (email_id, reason) values (?, ?)",
            (item.get("email_id"), item.get("reason", "")),
        )
        audit(connection, "send_to_review", item)
        return cursor.lastrowid
