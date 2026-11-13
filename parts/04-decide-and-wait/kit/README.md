# The kit for this part

This folder holds the data this part adds to the Tallgrass Bend world. Your code finds it through
`part_kit.py`, so you never copy it.

| File                                   | What it holds                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `routes/dev.jsonl`                     | The desk's queue for each dev email: book, agronomist or person                |
| `routes/test.hashes.jsonl`             | The same for the test emails, stored as hashes                                 |
| `approvals.py`                         | The agronomist's approvals: ask, answer and read, in `runs/approvals.db`       |
| `build_kit.py`                         | Writes the routes from the world's own records. Run it only to change the rule |
| `documents/`, `questions/`, `answer_*` | Part three's sources, so the milestone can check line 3 again                  |
| `judge_*`, `judge-cases/`, `planted/`  | Part two's judge and planted change, so the milestone can check line 2 again   |

For example, `routes/dev.jsonl` says TB-1001 belongs to the agronomist. It asks for Podshield at 0.38 L/ha, and
the label allows 0.5 L/ha. That is 76% of the label rate, and the line is 75%.
