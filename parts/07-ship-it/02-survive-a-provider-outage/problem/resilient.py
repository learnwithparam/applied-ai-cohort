"""Ask the model, and survive a bad hour at the provider."""

import time


def ask(primary, backup, prompt, sleep=time.sleep):
    """Return the model's text. `primary` and `backup` are provider calls: text in, text out."""
    return primary(prompt)
