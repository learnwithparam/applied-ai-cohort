# Run the finished system

## The problem

Before you build anything, you need to know what finished looks like. Here, finished is not "the model gave a
nice answer". It is a number the co-op's own records agree with: how many emails were booked right with no
person, how many were booked wrong, and how many went to a person.

## Your challenge

Run the finished system on the dev inbox and copy three of its numbers into `goal.md` in this folder.

```bash
uv run finished
```

Expect: a short report, then a scorecard with line 1 `PASS` and lines 2 to 7 `TO DO`.

![The finished system's scorecard](../images/expected.png)

```mermaid
flowchart LR
  A["40 dev emails"] --> B["Finished system"]
  B --> C["Booked jobs"]
  B --> D["Review queue"]
  C --> E["Scored against truth/dev.jsonl"]
```

## Done when

- `goal.md` has the number booked with no person, and it matches the finished system.
- `goal.md` has the number booked wrong, and it matches.
- `goal.md` has the number sent to a person, and it matches.

```bash
bun run verify run-the-finished-system
```

Expect: `Done. All 3 rules pass.`

## If you get stuck

- Copy only the number at the end of each line in the report, with nothing after it.
- If `uv run finished` prints an error, find the message in `00-orientation/troubleshooting.md`.
- Notice that the model alone would book all 40. The rules around it decide which ones a person sees.

## Words you will use

- **System of record:** the business system whose state counts. Here, the co-op's application system.
- **Truth:** a record of the right answer that the model never sees. Here, the jobs the desk keyed by hand.
- **Replay:** recorded model replies, so the course runs the same way with no key.
- **Review queue:** where work goes when the system is not sure. A person handles it.
