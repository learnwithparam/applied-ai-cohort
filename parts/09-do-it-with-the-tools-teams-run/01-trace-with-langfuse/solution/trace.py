"""Send one spray desk run to Langfuse, with one score."""

import os

from langfuse import Langfuse

from config import llm, models
from reference import finished, intake

client = Langfuse(
    host=os.environ["LANGFUSE_HOST"],
    public_key=os.environ["LANGFUSE_PUBLIC_KEY"],
    secret_key=os.environ["LANGFUSE_SECRET_KEY"],
)


def traced_complete(role, messages, **options):
    """The course's model call, with each call recorded as a Langfuse generation."""
    with client.start_as_current_observation(
        name=f"read email ({role})",
        as_type="generation",
        model=models.model_for(role),
        input=messages,
    ) as generation:
        reply = llm.complete(role, messages, **options)
        generation.update(
            output=reply.text,
            usage_details={"input": reply.input_tokens, "output": reply.output_tokens},
            cost_details={"total": reply.cost_usd},
        )
    return reply


def main() -> None:
    intake.complete = traced_complete
    with client.start_as_current_observation(name="spray desk, dev inbox", as_type="span"):
        result = finished.run_once("dev")
        trace_id = client.get_current_trace_id()
        client.create_score(trace_id=trace_id, name="correct_share", value=result["correct_share"])
    client.flush()
    print(f"Sent trace {trace_id}: {result['calls']} model calls.")


if __name__ == "__main__":
    main()
