// Reads each answer against the passages it cites: is it on an answer page, and does the
// cited text hold every number the answer states?
import type { Rule } from "../scripts/verify";
import { type Answer, answers } from "./cite-every-answer";
import { chunksById, onAnswerPage, type QuestionSplit, questions } from "./search-the-passages";

const NUMBER = /\d+(?:\.\d+)?/g;
const numbersIn = (text: string) => text.match(NUMBER) ?? [];

const isAnswered = (answer: Answer) => answer.code === 0 && answer.abstained !== true;

function citedText(folder: string, answer: Answer): string {
  const byId = chunksById(folder);
  return answer.citations.map((chunkId) => byId.get(chunkId)?.text ?? "").join(" ");
}

export function numbersAreBacked(folder: string, answer: Answer): boolean {
  const backed = new Set(numbersIn(citedText(folder, answer)));
  return (
    answer.citations.length > 0 && numbersIn(answer.answer).every((number) => backed.has(number))
  );
}

export function answeredShare(folder: string, split: QuestionSplit): number {
  const all = answers(folder, split);
  return all.filter(isAnswered).length / all.length;
}

// Of the answered questions, the share whose citations sit on an answer page and back
// every number in the answer.
export function supportedShare(folder: string, split: QuestionSplit): number {
  const byId = chunksById(folder);
  const asked = questions(split);
  const all = answers(folder, split);
  const answered = all.filter(isAnswered);
  const supported = all.filter((answer, position) => {
    if (!isAnswered(answer)) return false;
    const onPage = answer.citations.some((chunkId) =>
      onAnswerPage(byId.get(chunkId), asked[position]),
    );
    return onPage && numbersAreBacked(folder, answer);
  });
  return answered.length ? supported.length / answered.length : 0;
}

export function everyNumberBacked(folder: string, split: QuestionSplit): boolean {
  const answered = answers(folder, split).filter(isAnswered);
  return answered.every((answer) => numbersAreBacked(folder, answer));
}

export default [
  {
    says: "every number in every answer appears in a passage it cites",
    test: (folder) => everyNumberBacked(folder, "dev"),
    tryNext: "compare the numbers in the answer with the cited passages; abstain when they differ",
  },
  {
    says: "90% or more of the answers cite a page that answers the question",
    test: (folder) => supportedShare(folder, "dev") >= 0.9,
    tryNext: "print each answer beside its cited passage and read the ones that do not match",
  },
  {
    says: "80% or more of the dev questions still get an answer",
    test: (folder) => answeredShare(folder, "dev") >= 0.8,
    tryNext: "hold back only the answers your check rejects; a supported answer should go out",
  },
] satisfies Rule[];
