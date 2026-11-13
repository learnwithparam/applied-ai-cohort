"""Send one spray desk run to Langfuse, with one score. This is the starter.

Run it from the repo root, with your Langfuse secrets loaded:

    uv run --group assignment --env-file assignment/.env python assignment/trace.py

TODO: do the three things below, then delete the line that says "not written yet".
  1. Make a Langfuse client. It reads LANGFUSE_HOST, LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY.
  2. Wrap the model call so each call becomes a generation with its model name and token counts.
     The course's intake finds the call at `reference.intake.complete`.
  3. Run the finished intake on the dev inbox with `reference.finished.run_once("dev")`, then
     attach one score to the trace. Name it for a number the scorer reports, such as
     `correct_share`, and give it the scorer's own value for this run.
"""

print("trace.py is not written yet: open assignment/trace.py and follow the TODO")
raise SystemExit(1)
