"""The question writer. You do not need to change this file.

draft_questions(passage_id) returns the questions a model wrote for one passage.
Some are good. Some copy the passage, some repeat each other,
and some are not questions at all. These are recorded answers, so you need no key.
"""

import json


def draft_questions(passage_id):
    with open("drafts.json") as drafts:
        return json.load(drafts)[passage_id]
