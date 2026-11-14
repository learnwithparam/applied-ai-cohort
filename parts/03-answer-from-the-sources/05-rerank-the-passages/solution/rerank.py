"""Pick the best passages for a question: first pass finds candidates, the reranker picks."""

from reranker import score_pair


def rerank(question, candidates, keep=2):
    """`candidates` is the first pass's list, best guess first: [{"id": ..., "text": ...}].
    Return the ids of the `keep` best passages."""
    try:
        scores = [score_pair(question, candidate["text"]) for candidate in candidates]
    except Exception:
        # The reranker is down, so trust the first pass's order.
        return [candidate["id"] for candidate in candidates[:keep]]
    best_first = sorted(range(len(candidates)), key=lambda i: -scores[i])
    return [candidates[i]["id"] for i in best_first[:keep]]
