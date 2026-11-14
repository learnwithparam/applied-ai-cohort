# Notes on records you can trust

## What broke first

The acre requests. The model read 0.97 L per acre. It gave back 0.97 with the unit L/ha. The record looked
fine and was well under the label. Only the match with the desk's records showed the rate was wrong. It was off
by about 2.5 times. So now any email that names acres goes to a person.

## What I would change before real users

I would turn acre rates into hectares myself, not send them all to a person. I would test that on its own
cases. I would also log why each email went to review. Then the desk can see which rule sends the most work.

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
