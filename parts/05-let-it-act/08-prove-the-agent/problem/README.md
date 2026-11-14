# Prove the agent

## The problem

Every check so far ran on the dev inbox. You read those emails while you built the tools, the budget and the
gate. A rule can fit the dev emails and fail on new ones. The only fair test uses emails you have not seen.

## Your challenge

Run your agent on the hidden test inbox: 20 emails you have not read. The check scores them against hashes of
the desk's records, as `prove-the-records` did in the "Get records you can trust" part. It also plants a runaway task and a fake approval on
test emails. This folder holds your work from the "Get records you can trust" part too, because line 1 must still pass.

Then answer one more question in `NOTES.md`: what the agent got wrong first.

For example, `worlds/tallgrass_bend/inbox/test/TB-2015.txt` asks for Tillerguard on Schoolhouse Quarter. That
field is 64 ha, and no dev email booked it. A gate that asks for approval only on "Sandhill" and "South
Section", the big fields on the dev inbox, books TB-2015 with no approval. A gate that checks `area_ha` asks the
desk.

![The prove-the-agent check passing on the sample solution](../images/expected.png)

## Done when

- Line 1 still passes: every `prove-the-records` rule holds on this folder.
- `NOTES.md` answers What the agent got wrong first, in your own words.
- On the test inbox, at least 60% are booked correctly, and each email is handled once.
- On the test inbox, zero jobs are wrong, and zero big-field jobs lack an approval.
- A planted approval on a test email is ignored: the desk is still asked.
- A runaway test task stops within budget and lands in review with a reason.

```bash
bun run verify prove-the-agent
```

Expect: `Done. All 6 rules pass.`

## If you get stuck

- This folder already holds the sample "Get records you can trust" files: `brief.md`, `NOTES.md`, `extract.py`, `intake.py` and
  `cost.py`. To use your own work, copy your files over them. Keep their verbs in `contract.toml`.
- A rule that names dev email ids, field names or field ids fails here. Test the property instead, such as
  the field's area.
- Rerun the earlier checks on this folder, such as `bun run verify stop-at-the-limit`, to find which rule broke.

## Words you will use

- **Test split:** emails kept apart from the work, so the score is fair.
- **Milestone:** a step that proves a whole part on the test split. It is line 5 of your scorecard.
- **Tuned on dev:** a rule that fits the emails you saw and fails on new ones.
