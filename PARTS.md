# Parts

The course map for build sessions. Each part session builds one part from its row here and its README in
`parts/`. Learners start at the [root README](README.md).

## How a part is built

Copy the shape of `parts/01-get-records-you-can-trust/`:

- `NN-<step-name>/step.toml` (minutes 5 to 30, `screen`, `solution`), `problem/` with `README.md` (The problem,
  Your challenge, Done when, If you get stuck, Words you will use) and the starter, `solution/`, at least one
  `wrong/<mistake>/`, and `checks/<step-name>.ts`. Each check fails on the starter and every wrong answer and
  passes on the solution (`bun run verify --all`).
- A step's `problem/` starts from the previous step's solution, so a learner can begin any step fresh.
- Checks run the learner's verbs from `contract.toml` through `checks/lib/contract.ts`, against a fresh world
  from `checks/lib/world.ts`, and read the world's state, `calls.jsonl` and logs, never the model's reply.
  Behaviour that depends on a model is judged over 3 fresh runs in replay mode (`intakeRuns` shows how).
- Scoring against the truth lives in `worlds/score.py`, the one place that decides what counts as correct.
  Extend it there rather than scoring again in a check.
- Every step runs on **Tallgrass Bend** (`worlds/tallgrass_bend/`), the only world with data. A part that needs
  more of the world (agronomy guides, crews, approvals, planted instructions, private data) extends
  `build_data.py` and `seed.json`, adds replay replies, and keeps the dev and test splits.
- Replace the part README's Walkthrough `TODO(part session)` with the real commands, each with `Expect:`.
- Each milestone step (`prove-the-...`) runs on the test split and reruns the earlier milestones' rules.

## The parts

| Part folder                                  | Steps (minutes)                                                                                                                                                                                  | Minutes | Core labs        | What each step's check reads                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `00-orientation` (built)                     | run-the-finished-system (15)                                                                                                                                                                     | 15      | none             | `goal.md` against `uv run finished --json`                                                                                                                                                                                                                                                                                         |
| `parts/01-get-records-you-can-trust` (built) | name-the-job (15), call-the-model (20), fix-the-shape (30), check-against-truth (30), count-the-cost (15), prove-the-records (20)                                                                | 130     | 01               | `brief.md` sections; `calls.jsonl`; each record against `schema.json`; the world's jobs and review queue scored by `worlds/score.py`; the cost verb against `calls.jsonl` and correct jobs; the test split's hashes, cost and `NOTES.md`                                                                                           |
| `parts/02-measure-before-you-change`         | read-the-traces (30), name-the-failures (20), build-the-golden-set (30), write-a-code-check (20), draft-a-judge (20), align-the-judge (20), block-a-bad-change (20), prove-the-measurements (20) | 180     | 02               | `evals/labels.jsonl` rows and notes; `evals/failure-modes.md` counts against the labels; `evals/golden.jsonl` coverage and `signed_off_by`; the `eval` verb's pass rate per mode; the judge's verdicts on dev labels; TPR and TNR on held-out labels; `eval` exit code with a planted prompt patch; the grader's labels and line 1 |
| `parts/03-answer-from-the-sources`           | load-the-documents (30), search-the-passages (20), beat-the-baseline (20), cite-every-answer (20), check-the-citations (20), say-i-do-not-know (20), prove-the-answers (20)                      | 150     | 04, 05           | Chunk ids, pages and rebuild stability; recall@5 from the `search` verb against labelled chunk ids, beside a BM25 baseline; `ask` citations exist; the part two judge on cited passages; abstentions on out-of-scope questions; test split recall and supported rate                                                               |
| `parts/04-decide-and-wait`                   | route-the-inbox (30), send-unsure-to-a-person (20), chain-the-steps (20), stop-the-chain (20), wait-for-approval (20), survive-the-crash (20), prove-the-routing (20)                            | 150     | 10, 08           | `route` queues against truth and a non-model baseline; wrong auto-routes at the threshold; the trace per chain step; a failed check landing in review; one booking with the approval id after an approval through the world; one write after SIGKILL during the wait and a restart; the test split                                 |
| `parts/05-let-it-act`                        | write-the-tools (20), explain-the-errors (20), run-the-loop (20), grade-the-end-state (20), stop-at-the-limit (20), ask-before-acting (30), test-the-path (30), prove-the-agent (20)             | 180     | 12, 22           | An MCP client's tool list; the error text for a bad argument; `act` exit codes; the world's state after each task against the expected state; the runaway task's stop reason and spend; approval records against destructive calls in the audit log; the tool order in the trace; the test tasks                                   |
| `parts/06-make-it-safe-and-visible`          | trace-every-run (30), price-each-outcome (20), find-private-data (20), hide-private-data (20), guard-the-input (20), guard-the-tools (20), prove-the-guards (20)                                 | 150     | 23, 24, 28       | The trace store's API per run id; `runs/cost-per-outcome.md` against the traces; recall of private spans; the private list searched in `calls.jsonl` and the traces; blocked and passed shares on the attack and benign sets; write tool calls in the audit log; the grader's sets                                                 |
| `parts/07-ship-it`                           | serve-the-contract (20), lock-the-endpoint (20), gate-the-release (30), write-the-runbook (20), show-the-scorecard (30), prove-the-release (20)                                                  | 140     | 29, 31           | An HTTP client's 20 calls and time to first token; 401 on a bad token and a refusal over budget; CI status on a planted and a clean pull request; `RUNBOOK.md` sections; generated `SCORECARD.md`; the grader's full run                                                                                                           |
| `parts/08-add-one-capability`                | pick-an-elective (10), build-the-elective (30), measure-the-elective (30), report-the-trade (20)                                                                                                 | 90      | one elective lab | `elective.md` names a metric and target; the elective verb runs on dev; the metric moved and lines 1 to 7 still pass; the write-up's numbers against the run                                                                                                                                                                       |
| `parts/10-check-access-with-openfga`         | check-access-with-openfga (30)                                                                                                                                                                   | 30      | none             | OpenFGA's yes or no answers over HTTP: the model, the 12 dev requests scored by `worlds/score.py`, and one new field under a farm                                                                                                                                                                                                  |
| `parts/11-run-the-agent-with-google-adk`     | run-the-loop-on-adk (20, optional)                                                                                                                                                               | 20      | none             | `act` exit codes and printed JSON; end states in the world, once each; bookings; the ADK event log in tool order                                                                                                                                                                                                                   |

Every step from the brief that ran 40 minutes is split into two steps of 20, each with its own check, and the
total minutes are kept. Lab minutes are listed in `schedules.toml`, not in step minutes.

## live-labs

Labs are linked by path to `learnwithparam/live-labs`, never copied. Core labs per part are in the table.
**Revamp candidates, not lessons until revamped:** `labs/06-rag-judge`, `labs/09-request-routing`,
`labs/11-agent-loop` and `labs/27-prompt-registry` (support-desk worlds; lab 09 also needs a 4 GB first
download). The live-labs review also flags `labs/10-durable-workflow` (a refund waiting on a manager) for a
world revamp; it stays a core lab here until that revamp lands. Labs 16, 25 and 34 need Apple silicon today.

## Project briefs

Learners may take one of the briefs in `worlds/README.md` into the cohort. Only Tallgrass Bend has a data kit.
Building a kit for Corvane Mutual, Calder Fen Electric Co-op, Quillon and Pike Auction Rooms, Hollin Bank Home
Care or Glenmarrow National Park is open work.
