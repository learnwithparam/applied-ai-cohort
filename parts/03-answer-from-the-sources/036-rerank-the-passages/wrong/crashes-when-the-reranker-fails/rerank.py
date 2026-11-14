"""Pick the best passages for a question. This one crashes when the reranker is down."""

from reranker import score_pair


def rerank(question, candidates, keep=2):
    scores = [score_pair(question, candidate["text"]) for candidate in candidates]
    best_first = sorted(range(len(candidates)), key=lambda i: -scores[i])
    return [candidates[i]["id"] for i in best_first[:keep]]
