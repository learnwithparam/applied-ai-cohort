// Runs the learner's search verb on each labelled question and scores recall@5 by page.
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { hasVerb, runVerb } from "./lib/contract";
import { readJsonLines } from "./lib/world";
import { type Chunk, documentPages, index, PART_THREE_KIT } from "./load-the-documents";

type Row = Record<string, unknown>;

export const TOP = 5;
export type { Row };
export type QuestionSplit = "dev" | "test" | "out-of-scope-dev" | "out-of-scope-test";

export function questions(split: QuestionSplit): Row[] {
  return readJsonLines(join(PART_THREE_KIT, "questions", `${split}.jsonl`));
}

function parseIds(printed: string): string[] | undefined {
  try {
    const ids = JSON.parse(printed.trim()).chunk_ids;
    return Array.isArray(ids) ? ids.map(String) : undefined;
  } catch {
    // The verb printed something that is not JSON.
    return undefined;
  }
}

function searchAll(folder: string, split: QuestionSplit): (string[] | undefined)[] {
  // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
  const env = { INDEX_DIR: index(folder).dir };
  return questions(split).map((question) => {
    const stdin = { question: question.question, k: TOP };
    const run = runVerb(folder, "search", { stdin, env });
    return run.code === 0 ? parseIds(run.stdout) : undefined;
  });
}

const savedSearches = new Map<string, (string[] | undefined)[]>();

export function searches(folder: string, split: QuestionSplit) {
  const key = `${folder}|${split}`;
  let saved = savedSearches.get(key);
  if (!saved) {
    saved = searchAll(folder, split);
    savedSearches.set(key, saved);
  }
  return saved;
}

export function chunksById(folder: string): Map<string, Chunk> {
  return new Map(index(folder).chunks.map((chunk) => [chunk.chunkId, chunk]));
}

// True when the chunk sits on a page that answers the question. The test split keeps only
// a hash of each answer page, so the page is hashed the same way and compared.
export function onAnswerPage(chunk: Chunk | undefined, question: Row): boolean {
  if (!chunk) return false;
  if (Array.isArray(question.pages)) {
    const pages = question.pages as Row[];
    return pages.some((page) => page.doc_id === chunk.docId && page.page === chunk.page);
  }
  const key = `${question.question_id}|${chunk.docId}|${chunk.page}`;
  const pageHash = createHash("sha256").update(key).digest("hex");
  return (question.page_hashes as string[]).includes(pageHash);
}

export function recall(folder: string, split: QuestionSplit): number {
  const byId = chunksById(folder);
  const found = searches(folder, split);
  const asked = questions(split);
  const hits = asked.filter((question, position) => {
    const ids = (found[position] ?? []).slice(0, TOP);
    return ids.some((chunkId) => onAnswerPage(byId.get(chunkId), question));
  });
  return hits.length / asked.length;
}

const WORD = /[a-z0-9]+(?:\.[0-9]+)?/g;
const words = (text: string) => text.toLowerCase().match(WORD) ?? [];

function bm25Scores(question: string, paragraphWords: string[][]): number[] {
  const total = paragraphWords.length;
  const averageLength = paragraphWords.reduce((sum, found) => sum + found.length, 0) / total;
  const questionWords = [...new Set(words(question))];
  return paragraphWords.map((found) => {
    const lengthFactor = 0.25 + (0.75 * found.length) / averageLength;
    let score = 0;
    for (const word of questionWords) {
      const count = found.filter((each) => each === word).length;
      if (count === 0) continue;
      const containing = paragraphWords.filter((other) => other.includes(word)).length;
      const rarity = Math.log((total - containing + 0.5) / (containing + 0.5) + 1);
      score += (rarity * count * 2.5) / (count + 1.5 * lengthFactor);
    }
    return score;
  });
}

// Plain BM25 over the raw paragraphs, with no header: the baseline a search must beat.
export function baselineRecall(split: QuestionSplit): number {
  const paragraphs: Chunk[] = [];
  for (const [key, pageText] of documentPages()) {
    const [docId, page] = key.split("|");
    for (const text of pageText.split("\n\n").filter((piece) => piece.trim() !== "")) {
      paragraphs.push({ chunkId: "", docId, page: Number(page), text });
    }
  }
  const paragraphWords = paragraphs.map((paragraph) => words(paragraph.text));
  const asked = questions(split);
  const hits = asked.filter((question) => {
    const scores = bm25Scores(String(question.question), paragraphWords);
    const order = paragraphs.map((_, position) => position);
    order.sort((first, second) => scores[second] - scores[first]);
    return order.slice(0, TOP).some((position) => onAnswerPage(paragraphs[position], question));
  });
  return hits.length / asked.length;
}

function returnsTopIdsThatExist(folder: string): boolean {
  const byId = chunksById(folder);
  const found = searches(folder, "dev");
  return found.every(
    (ids) => ids !== undefined && ids.length === TOP && ids.every((chunkId) => byId.has(chunkId)),
  );
}

export default [
  {
    says: "contract.toml names a search verb",
    test: (folder) => hasVerb(folder, "search"),
    tryNext: 'add search = "uv run python search.py" under [verbs] in contract.toml',
  },
  {
    says: "for every dev question, search returns exactly k chunk ids that are in the index",
    test: returnsTopIdsThatExist,
    tryNext: 'print {"chunk_ids": [...]} with the k best ids, the best first, and no more',
  },
  {
    says: "recall@5 on the dev questions is 0.4 or more",
    test: (folder) => recall(folder, "dev") >= 0.4,
    tryNext: "rank chunks by the question's words they share; run uv run python recall.py",
  },
] satisfies Rule[];
