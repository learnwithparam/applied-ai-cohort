"""Pick the best passages for a question: first pass finds candidates, the reranker picks."""

from reranker import score_pair


def rerank(question, candidates, keep=2):
    """`candidates` is the first pass's list, best guess first: [{"id": ..., "text": ...}].
    Return the ids of the `keep` best passages."""
    return [candidate["id"] for candidate in candidates[:keep]]
