"""Ask the model, and survive a bad hour at the provider."""

import time

from provider import ProviderError

MOST_TRIES = 3
FIRST_WAIT_SECONDS = 0.5


def ask(primary, backup, prompt, sleep=time.sleep):
    """Return the model's text. This one retries every error, even a wrong request."""
    wait_seconds = FIRST_WAIT_SECONDS
    for attempt in range(MOST_TRIES):
        try:
            return primary(prompt)
        except ProviderError:
            if attempt < MOST_TRIES - 1:
                sleep(wait_seconds)
                wait_seconds = wait_seconds * 2
    return backup(prompt)
