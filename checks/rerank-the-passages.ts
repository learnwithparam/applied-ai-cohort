import type { Rule } from "../scripts/verify";
import { inspect } from "./lib/mini";

// Runs rerank on every question. A counter wraps score_pair first, so the check sees each call.
function everyQuestion(breakTheReranker: boolean): string {
  return `
import json
import reranker

calls = {"count": 0}
real_score_pair = reranker.score_pair

def counted(question, passage_text):
    calls["count"] += 1
    if ${breakTheReranker ? "True" : "False"}:
        raise RuntimeError("the reranker is down")
    return real_score_pair(question, passage_text)

reranker.score_pair = counted
from rerank import rerank

queries = json.load(open("first_pass.json"))
hits = 0
valid = True
most_calls_per_question = 0
for query in queries:
    calls["count"] = 0
    ids = [candidate["id"] for candidate in query["candidates"]]
    answer = rerank(query["question"], query["candidates"])
    valid = valid and len(answer) == 2 and all(item in ids for item in answer)
    hits += query["relevant"] in answer
    most_calls_per_question = max(most_calls_per_question, calls["count"])
print(json.dumps({"hits": hits, "valid": valid, "most_calls": most_calls_per_question}))
`;
}

export default [
  {
    says: "rerank returns two ids that came from the candidates",
    test: (folder) => inspect(folder, everyQuestion(false))?.valid === true,
    tryNext: "return a list of two candidate ids: [candidates[i]['id'] for i in best_first[:keep]]",
  },
  {
    says: "the right passage is in the top two for at least five of the six questions",
    test: (folder) => Number(inspect(folder, everyQuestion(false))?.hits) >= 5,
    tryNext: "sort the candidates by score_pair(question, text), highest first",
  },
  {
    says: "score_pair is called once for each candidate, and no more",
    test: (folder) => {
      const calls = Number(inspect(folder, everyQuestion(false))?.most_calls);
      return calls >= 1 && calls <= 6;
    },
    tryNext: "score each candidate once, keep the scores in a list, and sort from that list",
  },
  {
    says: "when score_pair raises an error, rerank still returns two ids",
    test: (folder) => {
      const found = inspect(folder, everyQuestion(true));
      return found?.valid === true;
    },
    tryNext: "wrap the scoring in try, and in except return the first two candidate ids",
  },
] satisfies Rule[];
