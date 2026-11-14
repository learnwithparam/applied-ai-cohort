"""The paths verb: did the agent take the expected path of tool calls on each golden task?

    uv run python paths.py

It reads the golden tasks in evals/paths.jsonl and the agent's trace in runs/trace.jsonl.
For every task that left its path, it reports the first step that differs, counting from 1.
It exits 0 when every golden task stayed on its path, and 1 when any left it.
"""

import sys

# TODO: read evals/paths.jsonl and runs/trace.jsonl (use RUNS_DIR when it is set).
# For each golden task, take the tools the agent called on that email in its last run, in order,
# and find the first step where they differ from expected_tools, counting from 1.
# Print {"tasks", "on_path", "left_path": [{"email_id", "step", "expected", "actual"}]}.
# Exit 0 when every task stayed on its path, and 1 when any left it.

if __name__ == "__main__":
    sys.exit("paths is not written yet. Open paths.py and follow its TODO.")
