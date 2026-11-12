# Measure before you change

## The problem

Someone trims the extract prompt to save tokens. A case the desk cares about, a rate per acre or a
misspelled product, starts slipping through, and nobody knows until a grower phones about a burnt crop. Part
one proved the system once. Nothing stops the next change from breaking it.

## Why it matters

Anthropic's guide to agent evals shows why one passing run proves little: "If your agent has a 75%
per-trial success rate and you run 3 trials, the probability of passing all three is (0.75)³ ≈ 42%"
([Anthropic, Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)).
A change has to be measured over many cases and several runs before anyone can call it better.

## What you build

```mermaid
flowchart LR
  A["Traces from part one"] --> B["Labels: pass or fail, with a note"]
  B --> C["Failure modes, counted"]
  C --> D["Golden set, signed off"]
  D --> E["Code checks"]
  D --> F["A judge, aligned to people"]
  E --> G{"eval verb"}
  F --> G
  G -- "regression" --> H["Change blocked"]
  G -- "no regression" --> I["Change allowed"]
```

## The labs

- Core: [Test LLM Features with a Golden Dataset](https://github.com/learnwithparam/live-labs/tree/main/labs/02-golden-set) (live-labs `labs/02-golden-set`, about 20 minutes)
- Optional: [Score Risk with a Decision Model](https://github.com/learnwithparam/live-labs/tree/main/labs/19-decision-ai)

## Steps

| Step | Minutes | You produce | Done when (what the check reads) |
|---|---|---|---|
| `read-the-traces` | 30 | `evals/labels.jsonl`, 30 or more rows | Row count, pass or fail on each, a note of 5 or more words, no preset category |
| `name-the-failures` | 20 | `evals/failure-modes.md` | At least 3 modes, each defined and counted; every failed label maps to one mode |
| `build-the-golden-set` | 30 | `evals/golden.jsonl` | 25 or more cases, 2 or more per mode, each with an expected output and `signed_off_by` |
| `write-a-code-check` | 20 | A code check per mode code can judge | `eval` prints a pass rate per mode |
| `draft-a-judge` | 20 | A judge prompt for one mode code cannot judge | The judge returns pass or fail on every dev label, never a score from 1 to 5 |
| `align-the-judge` | 20 | The judge, tuned on held-out labels | True positive and true negative rates both 0.8 or more on held-out human labels |
| `block-a-bad-change` | 20 | An `eval` verb that exits non-zero on a regression | A planted prompt change makes `eval` fail; the current version passes |
| `prove-the-measurements` | 20 | Scorecard line 2 | Judge agreement on the grader's labels, the planted change blocked, line 1 still passes |

180 minutes of steps. `align-a-judge` (40 minutes in the brief) is split into `draft-a-judge` and `align-the-judge`.

## Walkthrough

TODO(part session): the commands for each step, each with an `Expect:` line. The steps above are planned and
have no folders yet, so this part has nothing to check:

```bash
bun run verify part measure-before-you-change
```

Expect: `Part measure-before-you-change is done: 0/0 steps pass.`
