"""uv run models: one tiny call per role on the chosen provider. Never prints a key."""

import sys

from config import llm, models

SAMPLE_EMAIL = models.ROOT / "worlds" / "tallgrass_bend" / "inbox" / "dev" / "TB-1001.txt"


def main() -> int:
    try:
        chosen = models.provider()
    except ValueError as error:
        print(f"FAIL  {error}")
        return 1
    print(f"Provider: {chosen}")
    email_text = SAMPLE_EMAIL.read_text().strip()
    prompt = (
        f"Reply with the field name this email is about, in three words or fewer.\n\n{email_text}"
    )
    failures = 0
    for role in models.ROLES:
        try:
            reply = llm.complete(role, [{"role": "user", "content": prompt}])
            print(
                f"PASS  {role:<6} {reply.input_tokens} tokens in, {reply.output_tokens} out, ${reply.cost_usd:.6f}"
            )
        except Exception as error:  # every failure is reported as a sentence, never a stack trace
            failures += 1
            print(f"FAIL  {role:<6} {error}")
    if failures:
        print("Fix the FAIL lines. 00-orientation/troubleshooting.md lists each message.")
        return 1
    print("Every role answered.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
