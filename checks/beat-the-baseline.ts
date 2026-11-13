// Scores the learner's search against a plain BM25 baseline over the raw paragraphs.
import type { Rule } from "../scripts/verify";
import { baselineRecall, recall } from "./search-the-passages";

const TARGET = 0.85;

export default [
  {
    says: `recall@5 on the dev questions is ${TARGET} or more`,
    test: (folder) => recall(folder, "dev") >= TARGET,
    tryNext:
      "run uv run python recall.py and read the questions it misses: which page answers them?",
  },
  {
    says: "recall@5 on the dev questions beats the plain BM25 baseline",
    test: (folder) => recall(folder, "dev") > baselineRecall("dev"),
    tryNext: "a label's second page never names the product; give each chunk a header that does",
  },
] satisfies Rule[];
