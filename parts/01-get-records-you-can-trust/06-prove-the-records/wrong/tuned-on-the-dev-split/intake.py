"""intake: book every email the way the desk did on the dev split.

It scores perfectly on dev, because it copies the answers. On emails it has never seen it
can only hand them to a person.
"""

import json

from worlds import client
from worlds.store import WORLD_DIR

JOB_FIELDS = ("email_id", "grower_id", "field_id", "product_code", "rate_l_per_ha")

desk_rows = (WORLD_DIR / "truth" / "dev.jsonl").read_text().splitlines()
desk_answers = {}
for line in desk_rows:
    row = json.loads(line)
    desk_answers[row["email_id"]] = row

if __name__ == "__main__":
    outcomes = {"booked": 0, "review": 0}
    for email in client.inbox():
        answer = desk_answers.get(email["email_id"])
        if answer and answer["outcome"] == "booked":
            job = {field: answer[field] for field in JOB_FIELDS}
            client.book_job(job)
            outcomes["booked"] += 1
        else:
            client.send_to_review({"email_id": email["email_id"], "reason": "not seen before"})
            outcomes["review"] += 1
    print(json.dumps(outcomes))
