"""Build the prompt for the next model call from the run so far."""

import time


def build_prompt(system_text, history):
    """`history` is a list of messages: {"role": "user" | "assistant" | "tool", "content": text}."""
    clock = time.time_ns()
    system_message = {"role": "system", "content": f"{system_text}\nNow: {clock}"}
    return [system_message] + list(history)
