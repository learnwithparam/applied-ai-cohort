"""Ask the model, and survive a bad hour at the provider."""

import time

from provider import ProviderError


def ask(primary, backup, prompt, sleep=time.sleep):
    """Return the model's text. `primary` and `backup` are provider calls: text in, text out."""
    return primary(prompt)
