# The worlds

Every step in this course runs on one shared world: **Tallgrass Bend Growers Co-op** (`tallgrass_bend/`). A
world is a small, made-up business with everything a step needs:

- data, such as the emails in `tallgrass_bend/inbox/dev/`
- a system of record: the business system whose state counts
- a truth the model never sees: the right answers, recorded by people
- replay replies: model answers recorded before, so you need no key
- planted traps: hard cases put there on purpose

For example, `tallgrass_bend/inbox/dev/TB-1006.txt` is a trap. The grower asks for Glyfallow 540 "at 0.97 L per
acre". The truth in `tallgrass_bend/truth/dev.jsonl` books it at 2.4 L per hectare, because one acre is smaller
than one hectare.

For your own project, you can stay on Tallgrass Bend. You can also take one of the briefs below into the
cohort. Each brief is a back-office job. It has documents and a record a person signed off. It has a number to
move, and one thing the system must never do. Every business here is made up.

**Only Tallgrass Bend has data today.** The five briefs below are cards. The job is written down, but the data
kit is not built yet. A data kit is the inbox, the truth, a small system of record, a schema and replay.

| Brief                                    | Business and job                                                                           | Documents                                             | Truth (outside the model)                   | Metric                                                   | Never                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| **Tallgrass Bend Growers Co-op** (built) | A farm co-op's spray desk turns growers' emails into spray jobs                            | Spray request emails, product labels                  | Jobs the desk keyed by hand                 | Share booked with no person, at zero wrong jobs          | Book above the label rate or on an unlabelled crop         |
| **Corvane Mutual**                       | A claims insurer turns first notice of loss emails into claims and fast-tracks simple ones | Claim emails, photos, the policy wording              | Adjusters' final decisions and paid amounts | Share fast-tracked correctly at a fixed overpayment rate | Pay above the authority limit without an adjuster          |
| **Calder Fen Electric Co-op**            | Line crews' field notes become coded work orders and follow-up visits                      | Crew notes, the work order code book                  | Work orders the office coded by hand        | Share closed with the right codes and no re-key          | Close an order marked hazard without a supervisor          |
| **Quillon and Pike Auction Rooms**       | Sellers' consignment emails become catalogue lot records                                   | Consignment emails, photos, the house's category list | Lots the cataloguers entered                | Share of lots catalogued with no re-key                  | List a lot below the seller's reserve without a specialist |
| **Hollin Bank Home Care**                | Carers' visit notes are routed to a nurse, the office or nobody                            | Visit notes, care plans                               | The nurse's own routing of the same notes   | Share routed right at zero missed nurse concerns         | Change a care plan without a nurse's sign-off              |
| **Glenmarrow National Park, trail desk** | Visitor trail reports become trail status changes                                          | Reports written by anyone, the trail register         | Changes the rangers made                    | Share of reports turned into the right change            | Close or open a trail without a ranger's sign-off          |
| **Bring your own**                       | A real job you own, with names removed                                                     | Your own                                              | At least 40 records a person signed off     | Your own, a number with a direction                      | Your own                                                   |

Some briefs fit some parts well. The public writes Glenmarrow's trail reports, so anyone can hide an
instruction in one. That makes it a good place to practise blocking planted instructions. Hollin Bank needs a
nurse to sign off. That makes it a good place to practise a wait for a person that survives a crash.
