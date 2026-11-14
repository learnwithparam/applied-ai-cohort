# Runbook: the spray desk agent

## How to roll back

Find the pull request that changed the prompt or a tool, and revert its merge commit with
`git revert -m 1 <merge commit>`. Push the revert and let the release gate pass before you deploy it.
Then restart the service with `uv run python serve.py`.

## Budget limit

The service refuses new runs with 429 once they have spent `SPEND_LIMIT_USD`, which is $0.05 by
default. A normal request costs about $0.0001, so the limit covers about 500 requests. Raise it only
after you read the cost per successful outcome in `runs/cost-per-outcome.md`.

## Where traces are

Every run sends its spans to the trace store at `TRACES_URL`. Find a run by its `run_id`, which is
also its trace id. Without `TRACES_URL`, the spans are in `runs/traces.jsonl` on the server.

## Who signs off

The desk lead signs off every change to the prompt, the tools or the guards, after the release gate
passes. A person at the approval desk says yes to every job on a field over 40 ha.

## Known failure modes

- TB-1026: the grower writes "north block" and owns two north fields, so the agent guesses a field.
  `book_job` refuses it and a person phones the grower.
- TB-1006: the rate is given per acre. `book_job` refuses it, because the desk books litres per hectare.
- TB-1008: the product is misspelled. The agent recovers only while the prompt tells it to follow a
  tool's advice. The release gate catches a prompt that drops that line.
