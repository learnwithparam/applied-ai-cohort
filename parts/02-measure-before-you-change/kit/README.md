# The kit for this part

This folder holds the data this part adds to the Tallgrass Bend world. Your code finds it through
`part_kit.py`, so you never copy it.

| File                         | What it holds                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `judge-cases/dev.jsonl`      | 16 cases with a person's label. Tune your judge on these                                       |
| `judge-cases/held-out.jsonl` | 16 more labelled cases. The check scores your judge on these, so never copy them into a prompt |
| `judge-cases/grader.jsonl`   | 12 cases for the milestone. Each label is stored as a hash, so nobody can read it              |
| `judge-replay.jsonl`         | What the judge role answers on replay, for each case and each kind of prompt                   |
| `judge_replay.py`            | `ask_judge(prompt)`: one call to the judge role, on replay or a live provider                  |
| `planted/extract.py`         | A bad change. The checks run your eval against it. Never copy it into your folder              |
| `build_kit.py`               | Writes the cases and the replay answers. Run it only to change them                            |

For example, `judge-cases/dev.jsonl` holds case `J-D09`. Hollis asks for "the north block", and the
record says North Forty. Hollis owns two north fields, so a person labelled it `"pass": false`.
