// Asks the questions the documents do not answer, and checks the answers stay good on the rest.
import type { Rule } from "../scripts/verify";
import { answeredShare, supportedShare } from "./check-the-citations";
import { answers } from "./cite-every-answer";
import type { QuestionSplit } from "./search-the-passages";

export function abstainedCount(folder: string, split: QuestionSplit): number {
  return answers(folder, split).filter((answer) => answer.abstained === true).length;
}

export default [
  {
    says: "8 or more of the 10 out-of-scope dev questions get abstained: true",
    test: (folder) => abstainedCount(folder, "out-of-scope-dev") >= 8,
    tryNext: 'tell the model to reply "Not in the sources." when the passages do not answer',
  },
  {
    says: "on the in-scope dev questions, 80% or more still get an answer",
    test: (folder) => answeredShare(folder, "dev") >= 0.8,
    tryNext: "abstain only when the model says so or your citation check fails",
  },
  {
    says: "on the in-scope dev questions, 90% or more of the answers are supported",
    test: (folder) => supportedShare(folder, "dev") >= 0.9,
    tryNext: "rerun bun run verify check-the-citations on this folder and fix its FAIL lines",
  },
] satisfies Rule[];
