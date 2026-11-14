# My capstone

## Job

The agent answers questions from library members and sends the hard ones to a librarian.

## Number

Before my fix, 7 of 12 golden cases passed. After it, 10 of 12 passed.

## Fix

The agent made up a price when a member asked about a lost book. I changed the prompt so that any question about money is sent to a librarian.

## Evidence

The files `golden.jsonl` and `results.json` hold the twelve cases and the two runs.

## Next

Two cases still fail. The agent does not know the age rule for child cards, so I would add that page to its sources.
