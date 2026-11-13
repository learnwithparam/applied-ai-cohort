# Messages from this part

These are the messages this part's own files can print. Each row says what it means and what to do.

| What you see                                            | What it means                                                  | Fix                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `There are no traces yet. Run: uv run python traces.py` | `label.py` found no `runs/traces.jsonl`                        | Run `uv run python traces.py` in the same folder first            |
| `Judge replay has no answer for this prompt`            | Replay found no known case email in your judge prompt          | Put the whole email of the case in the prompt, after any examples |
| The judge answers `4` or `3`, not PASS or FAIL          | On replay, "score" or "1 to 5" in the prompt asks for a number | Take those words out, even from "do not give a score"             |
| `There is no kit/ folder above this one`                | `part_kit.py` was run from a folder outside the part           | Work inside the step's `problem/` folder                          |
| `FileNotFoundError: ... evals/baseline.json`            | `eval.py` has no baseline to compare with                      | Run `uv run python eval.py --save-baseline` once on good code     |
