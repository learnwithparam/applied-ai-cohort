# Messages from this part

These are the messages this part's own files can print. Each row says what it means and what to do.

| What you see                                     | What it means                                         | Fix                                                               |
| ------------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------- |
| `FileNotFoundError: ... index/chunks.jsonl`      | `search.py` or `ask.py` found no index                | Run `uv run python load.py` in the same folder first              |
| `Answer replay has no recording for this prompt` | Replay found no known question in your prompt         | Put the grower's whole question in the prompt                     |
| `Judge replay has no answer for this prompt`     | Replay found no known case email in your judge prompt | Put the whole email of the case in the prompt, after any examples |
| `There is no kit/ folder above this one`         | `part_kit.py` was run from a folder outside the part  | Work inside the step's `problem/` folder                          |
