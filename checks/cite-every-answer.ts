// Runs the learner's ask verb on each question and reads the answer, citations and abstention.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { hasVerb, runVerb } from "./lib/contract";
import { calls } from "./lib/world";
import { index } from "./load-the-documents";

type Row = Record<string, unknown>;

import { chunksById, type QuestionSplit, questions } from "./search-the-passages";

export type Answer = { code: number; answer: string; citations: string[]; abstained: unknown };
export type AskRun = { answers: Answer[]; calls: Row[] };

function parseAnswer(code: number, printed: string): Answer {
  try {
    const parsed = JSON.parse(printed.trim());
    const citations = Array.isArray(parsed.citations) ? parsed.citations.map(String) : [];
    const answer = typeof parsed.answer === "string" ? parsed.answer : "";
    return { code, answer, citations, abstained: parsed.abstained };
  } catch {
    // The verb printed something that is not JSON.
    return { code: code === 0 ? 2 : code, answer: "", citations: [], abstained: undefined };
  }
}

function askAll(folder: string, split: QuestionSplit): AskRun {
  const runsDir = mkdtempSync(join(tmpdir(), "ask-runs-"));
  try {
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    const env = { INDEX_DIR: index(folder).dir, RUNS_DIR: runsDir };
    const answers = questions(split).map((question) => {
      const run = runVerb(folder, "ask", { stdin: { question: question.question }, env });
      return parseAnswer(run.code, run.stdout);
    });
    return { answers, calls: calls(runsDir) };
  } finally {
    rmSync(runsDir, { recursive: true, force: true });
  }
}

const savedRuns = new Map<string, AskRun>();

export function askRun(folder: string, split: QuestionSplit): AskRun {
  const key = `${folder}|${split}`;
  let saved = savedRuns.get(key);
  if (!saved) {
    saved = askAll(folder, split);
    savedRuns.set(key, saved);
  }
  return saved;
}

export const answers = (folder: string, split: QuestionSplit) => askRun(folder, split).answers;

function everyCitationExists(folder: string): boolean {
  const byId = chunksById(folder);
  const cited = answers(folder, "dev").flatMap((answer) => answer.citations);
  return cited.length > 0 && cited.every((chunkId) => byId.has(chunkId));
}

export default [
  {
    says: "contract.toml names an ask verb, and it exits 0 on every dev question",
    test: (folder) =>
      hasVerb(folder, "ask") && answers(folder, "dev").every((answer) => answer.code === 0),
    tryNext: "pipe one question into uv run python ask.py and read the error it prints",
  },
  {
    says: "every answer cites at least one chunk",
    test: (folder) => answers(folder, "dev").every((answer) => answer.citations.length > 0),
    tryNext: "number the passages in the prompt, and turn each [n] in the reply into a chunk id",
  },
  {
    says: "every cited chunk id is in the index",
    test: everyCitationExists,
    tryNext: 'cite chunk ids such as "pulsepath-label-p2-1", never the passage number itself',
  },
  {
    says: "ask makes one model call per question",
    test: (folder) => askRun(folder, "dev").calls.length === questions("dev").length,
    tryNext: "call ask_model once for each question, with the question and its passages",
  },
] satisfies Rule[];
