"""Build the prompt for the next model call. This one trims every tool result, even the newest."""

KEEP_WHOLE = 3
TRIMMED_LENGTH = 80


def shortened(text):
    return text[:TRIMMED_LENGTH] + " [trimmed]"


def build_prompt(system_text, history):
    """`history` is a list of messages: {"role": "user" | "assistant" | "tool", "content": text}."""
    tool_positions = [i for i, message in enumerate(history) if message["role"] == "tool"]
    old_positions = set(tool_positions)
    prompt = [{"role": "system", "content": system_text}]
    for i, message in enumerate(history):
        if i in old_positions:
            prompt.append({"role": "tool", "content": shortened(message["content"])})
        else:
            prompt.append(message)
    return prompt
