# Fix the shape

## The problem

The reply from the last step is easy for a person to read. A program cannot use it. It has four problems:

- It has friendly words around the data.
- The JSON sits inside a code fence (the three backticks around a code block).
- Nobody agreed on the keys.
- The rate is a string with its unit stuck on.

For example, the reply for TB-1001 has `"rate": "0.38 L/ha"`. A program needs the number `0.38` and the unit
`L/ha` as two separate values. You could cut the JSON out of the fence, and it would parse. But the keys and
types would still change from one reply to the next.

## Your challenge

Change `extract.py` so it prints one bare JSON record that fits `worlds/tallgrass_bend/schema.json`. Bare
means nothing else: no words and no code fence. Load the schema. Pass it to the model as the shape it must
return:

```python
reply = complete("fast", messages, schema=SCHEMA)
record = json.loads(reply.text)
```

A live provider makes the model follow the schema. This is called structured output. On replay, you get the
matching recorded JSON instead.

![Before: prose with a fenced reply. After: one record that fits the schema](../images/expected.png)

## Done when

- `contract.toml` names an `extract` verb.
- `extract` prints bare JSON, with no prose and no code fence, on 10 dev emails over 3 runs.
- Every record fits `schema.json`: the keys `sender`, `field_name`, `product_name`, `rate`, `rate_unit`,
  the right types, `rate_unit` one of `L/ha` or `L/acre`, and no other keys.

```bash
uv run world email TB-1006 | uv run python extract.py
```

Expect: one line of JSON with `"rate": 0.97` and `"rate_unit": "L/ha"`. Read the email: it says per acre.
The shape is right and the value is wrong. The next step catches that.

Here is the full line on replay:
`{"sender": "marta@lindqvistfarms.example", "field_name": "Schoolhouse Quarter", "product_name": "Glyfallow 540", "rate": 0.97, "rate_unit": "L/ha"}`.
The grower wrote "0.97 L per acre", so `rate_unit` should say `L/acre`.

```bash
bun run verify fix-the-shape
```

Expect: `Done. All 3 rules pass.`

## If you get stuck

- Print `json.dumps(record)`, not the reply text, so nothing else reaches stdout.
- Give the model a short instruction. Tell it to copy names and rates exactly as the grower wrote them.

## Words you will use

- **Schema:** a written agreement about a record's keys and types. JSON Schema is the most common format.
- **Structured output:** asking the provider to return only JSON that fits a schema.
- **Valid is not right:** a record can fit the schema and still be wrong. Only the truth can show it.
