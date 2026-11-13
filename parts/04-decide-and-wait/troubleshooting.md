# Messages from this part

These are the messages this part's own files can print. Each row says what it means and what to do.

| What you see                                              | What it means                                            | Fix                                                                  |
| --------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| `Waiting for 11 approvals. See them with: ...`            | The chain is waiting for the agronomist, as it should    | Approve or refuse each request with `approvals.py`                   |
| `There is no waiting request A-3. Run: approvals.py list` | That request does not exist, or it already has an answer | Run `approvals.py list` and use an id that says `waiting`            |
| `A-12  TB-1001  0.38 L/ha  waiting` after a second run    | `uv run world reset` does not clear the approvals        | Delete `runs/approvals.db` to start again at A-1                     |
| `No approval requests yet.`                               | Nothing has asked the agronomist yet                     | Run the chain first, from the same folder                            |
| `{"emails": 40, "still_waiting": 3}` and exit code 1      | The wait timed out with requests still open              | Answer them, then run the chain again; a durable chain picks them up |
| `The application system is not running at ...`            | The chain called the world and nothing answered          | Run `uv run world serve` in a second terminal                        |
| `There is no kit/ folder above this one`                  | `part_kit.py` was run from a folder outside the part     | Work inside the step's `problem/` folder                             |
