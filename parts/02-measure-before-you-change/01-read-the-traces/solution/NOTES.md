# Notes on records you can trust

## What broke first

The acre requests. The model read 0.97 L per acre. It gave back 0.97 with the unit L/ha. The record looked
fine and was well under the label. Only the match with the desk's records showed the rate was wrong. It was off
by about 2.5 times. So now any email that names acres goes to a person.

## What I would change before real users

I would turn acre rates into hectares myself, not send them all to a person. I would test that on its own
cases. I would also log why each email went to review. Then the desk can see which rule sends the most work.
