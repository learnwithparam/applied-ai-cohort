# Tallgrass Bend Growers Co-op: the spray desk

Tallgrass Bend is a farmers' co-op. It sells crop protection products to its member growers and runs a
custom application service: the co-op's sprayer crews spray a grower's field for them. Growers ask by email.
A person at the spray desk reads each email and keys a spray job into the co-op's application system.

The co-op is fictional. The names, emails, fields and products are made up for this course.

## The job

Turn each spray request email into a spray job in the application system, or hand it to a person.

|                      |                                                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Documents**        | 40 dev emails in `inbox/dev/` and 20 test emails in `inbox/test/`                                                                                                                         |
| **System of record** | The application system: `uv run world serve`, a SQLite file behind a small HTTP API                                                                                                       |
| **Truth**            | The jobs the desk keyed by hand from the same emails: `truth/dev.jsonl`. The test split is stored as hashes in `truth/test.hashes.jsonl`, so you can score it without reading the answers |
| **Metric**           | Share of emails booked with no person and matching the desk's record, with zero wrong jobs booked                                                                                         |
| **Never**            | Book a job above the product's label rate, or on a crop the product's label does not cover                                                                                                |

## What the application system holds

`seed.json` is the starting state: 8 growers, 17 fields (each with its crop and area) and 6 products (each with
its label: the highest rate in litres per hectare and the crops it may be used on). `uv run world reset` puts
it back.

| Route                                              | What it does                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /`                                            | The jobs board: booked jobs and the review queue                                 |
| `GET /api/inbox`                                   | The emails waiting on the desk                                                   |
| `GET /api/growers`, `/api/fields`, `/api/products` | The co-op's records                                                              |
| `GET /api/jobs`, `/api/review`                     | What has been booked and what waits for a person                                 |
| `POST /api/jobs`                                   | Book a job: `email_id`, `grower_id`, `field_id`, `product_code`, `rate_l_per_ha` |
| `POST /api/review`                                 | Hand an email to a person: `email_id`, `reason`                                  |

**The planted fault in the system itself:** `POST /api/jobs` checks only that the ids exist. It books any rate
on any crop, as many real back-office systems do. Keeping within the label is your system's job.

## The planted traps

Each split mixes clean requests with five kinds of trap. The replay model makes the mistake a real model makes
on each one.

| Trap               | Dev | Test | What happens                                                                       |
| ------------------ | --- | ---- | ---------------------------------------------------------------------------------- |
| Rate per acre      | 4   | 2    | The grower writes "L per acre". The model copies the number and calls it L/ha      |
| Above the label    | 3   | 2    | The grower asks for more than the label allows. The model copies it faithfully     |
| Ambiguous field    | 3   | 1    | The grower says "the north block" and owns two north fields. The model guesses one |
| Misspelled product | 2   | 1    | The grower misspells the product. The model copies the misspelling                 |
| Wrong crop         | 2   | 1    | The product is not labelled for the crop in that field                             |
| Clean              | 26  | 13   | A request the desk booked as written                                               |

The desk booked the acre, ambiguous and misspelled requests after a person converted the rate, phoned the
grower or fixed the name. It refused the above-label and wrong-crop requests.

## Replay

`replay/` holds one reply per email, written for this course to behave like a model reading that email,
including the mistakes above. With `LLM_PROVIDER=replay` (the default), `config/llm.py` finds the inbox email
inside your prompt and returns its reply: bare JSON when you pass a schema, a chatty reply with JSON in a code
fence when you do not. Set a provider and a key in `.env` to read the same emails with a live model.

`build_data.py` wrote everything in this folder. Change the world there, run it, and commit what it writes.
