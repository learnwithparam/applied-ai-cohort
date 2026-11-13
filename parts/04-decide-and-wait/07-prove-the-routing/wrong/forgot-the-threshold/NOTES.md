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

## Where search failed first

Questions about a label's second page. That page never names the product, so a search for "Pulsepath" found
Pulsepath's first page and the desk notes instead. Plain BM25 found the right page for only 12 of 20 dev
questions. Putting the document title and page at the start of every chunk fixed all of them.

## What I would check before agronomists use it

I would ask an agronomist to label 50 real questions, because 20 dev questions are too few. I would also
read every answer that cites a passage without the number it states. The model sometimes cites the wrong
passage, even when the right one is there.

## What the routing got wrong first

The misspelled products. My router matched "Stemshure" to Stemsure and "Pulse Path" to Pulsepath, and booked
them with no person. Each match was close, but not exact. A confidence threshold of 0.98 now sends any request
with a fuzzy match to a person. The wrong auto-routes on the dev inbox fell from 2 to 0.

## What I would change before the agronomist relies on it

I would send the agronomist a message when a request starts to wait, instead of a list to check. I would also
add a second person to ask when an approval waits too long. And I would test a crash just after a booking,
not only during the wait.
