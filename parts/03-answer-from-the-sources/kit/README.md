# The kit for this part

This folder holds the data this part adds to the Tallgrass Bend world. Your code finds it through
`part_kit.py`, so you never copy it.

| File                                 | What it holds                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `documents/`                         | Six product labels and four co-op guides, as text with page markers                   |
| `questions/dev.jsonl`                | 20 questions, each with the page that answers it                                      |
| `questions/test.jsonl`               | 10 hidden questions. Each answer page is stored as a hash                             |
| `questions/out-of-scope-dev.jsonl`   | 10 questions the documents do not answer                                              |
| `questions/out-of-scope-test.jsonl`  | 5 more, for the milestone                                                             |
| `answer-replay.jsonl`                | What the fast role answers on replay, for each question                               |
| `answer_replay.py`                   | `ask_model(prompt)`: one call to the fast role, on replay or a live provider          |
| `build_kit.py`                       | Writes the documents, questions and answers. Run it only to change them               |
| `judge_replay.py` and `judge-cases/` | The "Measure before you change" part's judge, so the milestone can check line 2 again |
| `planted/extract.py`                 | The "Measure before you change" part's planted bad change, for the same reason        |

For example, `questions/dev.jsonl` holds Q-D11, "How long must Pulsepath stay dry after spraying?". Its answer
is on page 2 of `documents/pulsepath-label.txt`, which never says the word Pulsepath.
