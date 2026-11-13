"""The grade verb: compare the application system's state with the desk's own records.

    uv run python grade.py

Run it after the agent has worked on every dev email. It must print
{"tasks", "matched", "booked", "sent_to_review"} as one line of JSON.
"""

import sys

# TODO: read the jobs and the review queue from the application system (worlds.client),
# and the desk's records from worlds/tallgrass_bend/truth/dev.jsonl. Count an email as
# matched when the system holds exactly what the desk did with it: one job with the same
# grower, field, product and rate, or no job and one review. Never read what the agent said.

if __name__ == "__main__":
    sys.exit("grade is not written yet. Open grade.py and follow its TODO.")
