# Notes on records you can trust, and on the release

## What broke first

The acre requests. The model read 0.97 L per acre and returned 0.97 with the unit L/ha, so the record looked
valid and was well under the label. Only the match against the desk's records showed the rate was wrong by a
factor of about 2.5. That is why I now send any email that mentions acres to a person.

## What I would change before real users

I would convert acre rates myself instead of sending them all to a person, and test the conversion on its own
cases. I would also log the reason for each review, so the desk can see which rule sends them the most work.

## What I would watch after release

I would watch the cost per successful outcome and the share of emails sent to a person. If the review
share rises, a new kind of request is arriving that the tools refuse. Then the desk is doing the work by
hand again. If the cost rises, the agent is taking more turns, so I would read the traces of the slowest
runs first.
