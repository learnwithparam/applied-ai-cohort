# Notes on records you can trust

## What broke first

The acre requests. The model read 0.97 L per acre and returned 0.97 with the unit L/ha, so the record looked
valid and was well under the label. Only the match against the desk's records showed the rate was wrong by a
factor of about 2.5. That is why I now send any email that mentions acres to a person.

## What I would change before real users

I would convert acre rates myself instead of sending them all to a person, and test the conversion on its own
cases. I would also log the reason for each review, so the desk can see which rule sends them the most work.

## What the eval caught

The planted change dropped the schema to save tokens. Every reply came back as friendly prose, so no record
could be read, and the clean cases fell from 1.0 to 0.0. The eval exited 1 and named the clean mode. Before I
fixed my eval, it skipped the unreadable replies and passed the change.

## What I would measure next

I would add more field-guessed cases, because three dev emails are too few to trust a pass rate. I would also
run the judge five times on each case with a live model, to see how often it changes its mind.
