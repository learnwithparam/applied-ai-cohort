# The job

## Job

Growers email spray requests to the Tallgrass Bend co-op. A person at the desk reads each email and keys a
spray job into the application system: the grower, the field, the product and the rate in litres per hectare.

## Cost today

Every request is typed by hand, and the desk checks each rate against the product label from memory. One
rate typed wrong puts too much product on a crop, which can damage it and breaks the label.

## Truth

The jobs the desk keyed by hand from the same emails, in `truth/dev.jsonl`. The model never sees it.

## Metric

At least 60% of requests booked with no person, with zero booked jobs that differ from the desk's records.

## Never

Never book a job above the product's label rate, or on a crop the label does not cover.
