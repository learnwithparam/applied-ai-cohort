# Runbook: the spray desk agent

## How to roll back

Go back to the last version that worked, and deploy it again as fast as you can.

## Budget limit

There is a spending limit on the service, so a runaway cannot cost too much money.

## Where traces are

Traces are kept for every run, and the team knows where to look for them.

## Who signs off

The team lead signs off on every release, after the tests and the gate pass.

## Known failure modes

- The model sometimes picks the wrong field when the name is vague.
- Some growers give the rate per acre instead of per hectare.
- Misspelled products can confuse the agent.
