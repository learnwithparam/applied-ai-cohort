# Prove the measurements

## The problem

You built an eval, a judge and a gate. Each worked on the cases you saw. A grader now checks them on cases you
did not see. Line 2 of the scorecard is yours when your measurements hold there too, and line 1 still holds.

## Your challenge

Write two short answers in `NOTES.md`, from your own runs. Then run the milestone check. It does four things:

- It scores your judge on the grader's 12 cases. Their labels are stored as hashes, so nobody can read them.
- It checks that no held-out or grader case went into the judge's prompt.
- It runs your eval on your code, then on the planted change.
- It reruns part one's rules on the hidden test inbox, 3 fresh runs.

```mermaid
flowchart LR
  A["Judge"] --> B["Grader's 12 cases"]
  C["eval"] --> D["Your code: exit 0"]
  C --> E["Planted change: exit 1"]
  F["intake"] --> G["Hidden test inbox"]
  B --> H["Scorecard line 2"]
  D --> H
  E --> H
  G --> I["Scorecard line 1"]
```

For example, a learner saves the baseline after the teammate's change. Then the eval passes and the gate is
open. The check catches this. The planted change no longer drops any mode, and the intake fails on the test
inbox.

```bash
bun run verify prove-the-measurements
```

Expect: `Done. All 8 rules pass.`

![The milestone check passing](../images/expected.png)

## Done when

- `NOTES.md` answers What the eval caught and What I would measure next, in 20 words or more each.
- On the grader's 12 cases, the judge catches and keeps 80% or more.
- No held-out or grader case is used as an example in the judge's prompt.
- `eval` passes on your code and blocks the planted change.
- On the hidden test inbox, part one's rules still pass.

## If you get stuck

- Run `bun run verify align-the-judge` and `bun run verify block-a-bad-change` here first.
- If line 1 fails, compare your `extract.py` with the one from part one. A shorter prompt can break it.

## Words you will use

- **Milestone:** a step that proves a part on data you have not seen.
- **Scorecard line:** one result the whole course builds up, such as "the judge agrees with people".
