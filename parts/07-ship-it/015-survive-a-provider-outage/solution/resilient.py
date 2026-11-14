"""Ask the model, and survive a bad hour at the provider."""

import time

from provider import ProviderError

# These statuses mean "try again soon". Any other status means "this request is wrong".
TRY_AGAIN_STATUSES = {429, 500, 502, 503, 504}
MOST_TRIES = 3
FIRST_WAIT_SECONDS = 0.5


def ask(primary, backup, prompt, sleep=time.sleep):
    """Return the model's text. `primary` and `backup` are provider calls: text in, text out."""
    wait_seconds = FIRST_WAIT_SECONDS
    for attempt in range(MOST_TRIES):
        try:
            return primary(prompt)
        except ProviderError as error:
            if error.status not in TRY_AGAIN_STATUSES:
                raise
            if attempt < MOST_TRIES - 1:
                sleep(wait_seconds)
                wait_seconds = wait_seconds * 2
    return backup(prompt)
