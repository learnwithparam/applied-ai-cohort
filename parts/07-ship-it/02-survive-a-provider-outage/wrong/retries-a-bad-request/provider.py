"""The model provider's side. You do not need to change this file.

A provider call is a function: it takes a prompt and returns text.
When the provider is down or slow, it raises ProviderError
with the HTTP status the provider sent.

    503  the provider is down for now
    429  you sent too many calls; slow down
    400  your request is wrong; sending it again will not help
"""


class ProviderError(Exception):
    def __init__(self, status: int, message: str = ""):
        super().__init__(f"provider answered {status}: {message}")
        self.status = status
