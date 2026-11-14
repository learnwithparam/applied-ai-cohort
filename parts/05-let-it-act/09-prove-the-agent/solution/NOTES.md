# Notes on records you can trust, and on the agent

## What broke first

The acre requests. The model read 0.97 L per acre and returned 0.97 with the unit L/ha, so the record looked
valid and was well under the label. Only the match against the desk's records showed the rate was wrong by a
factor of about 2.5. That is why I now send any email that mentions acres to a person.

## What I would change before real users

I would convert acre rates myself instead of sending them all to a person, and test the conversion on its own
cases. I would also log the reason for each review, so the desk can see which rule sends them the most work.

## What the agent got wrong first

The agent said "Done" on every task, even when book_job refused the job. Only the grade verb, which reads the
jobs and the review queue, showed that seven emails had gone to a person. The planted approval email was worse:
the model passed the approval id from the email, so the gate now asks the desk and ignores any id it is given.
