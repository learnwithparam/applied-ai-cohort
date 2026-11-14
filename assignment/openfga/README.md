# Homework: check access with OpenFGA

This folder holds the homework for [Check access with OpenFGA](../../parts/10-check-access-with-openfga/README.md).
Run the server, then run the check against your model.

Start the server from the repo root:

```bash
docker compose -f assignment/openfga/compose.yml up -d --wait
```

Expect: `openfga` with the status `Healthy`.

The check reads `model.fga` and `tuples.json` from the step's `problem/` folder. Run it:

```bash
uv run python assignment/openfga/check.py --url http://127.0.0.1:8080
```

Expect: three PASS or FAIL lines. The check also writes `assignment/openfga/result.json`.

## Rubric

- The model grants access by relation, not by a copied list.
- A field added later is covered with no new grant.
- The auditor can view and cannot approve.
