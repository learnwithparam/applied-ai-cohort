# Prove the records

## The problem

Everything so far ran on the 40 dev emails, the ones you read while writing your rules. A system tuned on the
emails it was built from can look perfect and fail on the next one. The proof is a run on emails you have not
seen, scored against answers you cannot read.

## Your challenge

Run your intake on the hidden test inbox: 20 emails in `worlds/tallgrass_bend/inbox/test/`, scored against
hashes of the desk's records. Then write `NOTES.md` from your own runs. Copy your `brief.md` from
`name-the-job` into this folder, since the milestone reruns that step too.

```bash
uv run world serve --split test
```

Expect: `The spray desk is open at http://127.0.0.1:8100 (test inbox). Stop it with Ctrl+C.`

![Scorecard line 1 green on the test inbox](../images/expected.png)

## Done when

- `NOTES.md` answers What broke first and What I would change before real users, from your own runs.
- `brief.md` still passes every `name-the-job` rule.
- On the hidden test inbox, over 3 fresh runs: zero booked jobs differ from the desk's records, zero are
  off label, every email is handled once, and at least 60% are booked correctly with no person.
- The test inbox costs under $0.01 in model calls.

```bash
bun run verify prove-the-records
```

Expect: `Done. All 6 rules pass.`

## If you get stuck

- A rule that looks up dev email ids or dev answers passes on dev and fails here. Rules must read the email.
- If the test run books something wrong, find the trap it belongs to in the world's brief and fix the rule.

## Words you will use

- **Dev split:** the examples you look at while building.
- **Test split:** examples held back to measure the finished system. Here it is stored as hashes.
- **Milestone:** a step that proves a whole part and reruns the earlier rules.
