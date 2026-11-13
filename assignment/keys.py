"""Write the secrets for your own Langfuse stack to assignment/.env, which git ignores.

Every value is random and never printed. Run it once:

    uv run python assignment/keys.py
"""

import argparse
import secrets
from pathlib import Path

HERE = Path(__file__).parent


def make_values() -> dict[str, str]:
    return {
        "LANGFUSE_HOST": "http://localhost:3000",
        "LANGFUSE_PUBLIC_KEY": "pk-lf-" + secrets.token_hex(16),
        "LANGFUSE_SECRET_KEY": "sk-lf-" + secrets.token_hex(16),
        "LANGFUSE_UI_PASSWORD": secrets.token_urlsafe(16),
        "NEXTAUTH_SECRET": secrets.token_hex(32),
        "SALT": secrets.token_hex(16),
        "ENCRYPTION_KEY": secrets.token_hex(32),
        "POSTGRES_PASSWORD": secrets.token_hex(16),
        "CLICKHOUSE_PASSWORD": secrets.token_hex(16),
        "REDIS_AUTH": secrets.token_hex(16),
        "MINIO_ROOT_PASSWORD": secrets.token_hex(16),
    }


def main() -> int:
    parser = argparse.ArgumentParser(prog="keys")
    parser.add_argument("--out", default=str(HERE / ".env"), help="where to write the secrets")
    destination = Path(parser.parse_args().out)
    if destination.exists():
        print(f"{destination} already exists, so I left it alone. Delete it to make new secrets.")
        return 0
    lines = [f"{name}={value}" for name, value in make_values().items()]
    destination.write_text("\n".join(lines) + "\n")
    destination.chmod(0o600)
    print(f"Wrote {len(lines)} secrets to {destination}. Nothing was printed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
