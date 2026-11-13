# Notes on records you can trust, and on the guards

## What broke first

The acre requests. The model read 0.97 L per acre and returned 0.97 with the unit L/ha, so the record looked
valid and was well under the label. Only the match against the desk's records showed the rate was wrong by a
factor of about 2.5. That is why I now send any email that mentions acres to a person.

## What I would change before real users

I would convert acre rates myself instead of sending them all to a person, and test the conversion on its own
cases. I would also log the reason for each review, so the desk can see which rule sends them the most work.

## What the guards missed first

The first detector only knew one phone format, 0412 555 019, so numbers written as (306) 555-0142 reached the
call log. The check searched calls.jsonl for every private value and named the ones it found. Later the trace
still held the raw email, because the root span was written before the redaction ran.
