// Runs the learner's load verb and reads the index it writes: chunk ids, pages and text.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { hasVerb, runVerb } from "./lib/contract";
import { readJsonLines } from "./lib/world";

export const PART_THREE_KIT = join(ROOT, "parts", "03-answer-from-the-sources", "kit");
const DOCUMENTS = join(PART_THREE_KIT, "documents");
const LONGEST_CHUNK = 1500;

export type Chunk = { chunkId: string; docId: string; page: number; text: string };
export type Index = { code: number; dir: string; chunks: Chunk[] };

function readChunks(indexDir: string): Chunk[] {
  const file = join(indexDir, "chunks.jsonl");
  if (!existsSync(file)) return [];
  return readJsonLines(file).map((row) => ({
    chunkId: String(row.chunk_id),
    docId: String(row.doc_id),
    page: Number(row.page),
    text: typeof row.text === "string" ? row.text : "",
  }));
}

function buildIndex(folder: string): Index {
  const dir = mkdtempSync(join(tmpdir(), "index-"));
  // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
  const run = runVerb(folder, "load", { env: { INDEX_DIR: dir } });
  return { code: run.code, dir, chunks: readChunks(dir) };
}

// Each folder's index is built twice: once to use, once to see that the ids stay the same.
// The search and ask verbs read the index, so its folder stays until the check ends.
const savedIndexes = new Map<string, Index[]>();

export function indexes(folder: string): Index[] {
  let saved = savedIndexes.get(folder);
  if (!saved) {
    saved = [buildIndex(folder), buildIndex(folder)];
    savedIndexes.set(folder, saved);
  }
  return saved;
}

export const index = (folder: string) => indexes(folder)[0];

function removeIndexes() {
  for (const saved of savedIndexes.values()) {
    for (const built of saved) rmSync(built.dir, { recursive: true, force: true });
  }
}

process.on("exit", removeIndexes);

// Each page of a document as its text, by "doc_id|page".
export function documentPages(): Map<string, string> {
  const pages = new Map<string, string>();
  const files = readdirSync(DOCUMENTS).filter((name) => name.endsWith(".txt"));
  for (const file of files.sort()) {
    const docId = file.replace(/\.txt$/, "");
    const pieces = readFileSync(join(DOCUMENTS, file), "utf8").split(/^--- page (\d+) ---$/m);
    for (let position = 1; position < pieces.length; position += 2) {
      pages.set(`${docId}|${pieces[position]}`, pieces[position + 1]);
    }
  }
  return pages;
}

function hasEveryField(chunk: Chunk): boolean {
  const filled = chunk.chunkId !== "" && chunk.docId !== "" && chunk.text.trim() !== "";
  return filled && Number.isInteger(chunk.page) && chunk.page >= 1;
}

function idsAreUniqueAndStable(folder: string): boolean {
  const [first, second] = indexes(folder);
  const firstIds = first.chunks.map((chunk) => chunk.chunkId);
  const secondIds = second.chunks.map((chunk) => chunk.chunkId);
  const unique = new Set(firstIds).size === firstIds.length;
  return firstIds.length > 0 && unique && firstIds.join("\n") === secondIds.join("\n");
}

function coversEveryDocument(folder: string): boolean {
  const covered = new Set(index(folder).chunks.map((chunk) => chunk.docId));
  const documents = readdirSync(DOCUMENTS).filter((name) => name.endsWith(".txt"));
  return documents.every((name) => covered.has(name.replace(/\.txt$/, "")));
}

// A chunk may start with a header of its own, so its last 40 characters must be on its page.
function sitsOnItsPage(chunk: Chunk, pages: Map<string, string>): boolean {
  const pageText = pages.get(`${chunk.docId}|${chunk.page}`);
  const ending = chunk.text.trim().slice(-40);
  return pageText !== undefined && chunk.text.length <= LONGEST_CHUNK && pageText.includes(ending);
}

export default [
  {
    says: "contract.toml names a load verb, and it exits 0",
    test: (folder) => hasVerb(folder, "load") && index(folder).code === 0,
    tryNext: "run uv run python load.py in this folder and read the error it prints",
  },
  {
    says: "every chunk has a chunk_id, a doc_id, a page number and some text",
    test: (folder) => index(folder).chunks.length > 0 && index(folder).chunks.every(hasEveryField),
    tryNext: 'write one JSON object per line with "chunk_id", "doc_id", "page" and "text"',
  },
  {
    says: "every document in kit/documents has chunks",
    test: coversEveryDocument,
    tryNext: "read every .txt file in the kit's documents folder, labels and guides alike",
  },
  {
    says: "each chunk is 1500 characters or fewer and sits on the page it names",
    test: (folder) => {
      const pages = documentPages();
      const chunks = index(folder).chunks;
      return chunks.length > 0 && chunks.every((chunk) => sitsOnItsPage(chunk, pages));
    },
    tryNext: 'split each document at its "--- page N ---" lines, then into paragraphs',
  },
  {
    says: "chunk ids are unique, and a rebuild gives the same ids",
    test: idsAreUniqueAndStable,
    tryNext: "build each id from the document, the page and the paragraph, never from chance",
  },
] satisfies Rule[];
