// The milestone: routing and the crash test hold on the hidden test inbox, and lines 1 to 3 of
// the scorecard still pass. Lines 2 and 3 are checked here against this part's kit.
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Rule } from "../scripts/verify";
import { runVerb } from "./lib/contract";
import { sections, written } from "./lib/markdown";
import { calls, readJsonLines } from "./lib/world";
import proveTheRecords from "./prove-the-records";
import { PART_FOUR_KIT, type Row, wrongAutoRoutes, wrongShare } from "./route-the-inbox";
import { oneRequestPerEmail } from "./survive-the-crash";
import { approvalRun, approvedBookedOnceWithId, handledOnceAndRight } from "./wait-for-approval";

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const NUMBER = /\d+(?:\.\d+)?/g;

function notesAreWritten(folder: string): boolean {
  const notes = sections(folder, "NOTES.md");
  const wrongFirst = written(notes["what the routing got wrong first"], 20);
  const wouldChange = written(notes["what i would change before the agronomist relies on it"], 20);
  return wrongFirst && wouldChange;
}

function scratchFolder(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function parsed(printed: string): Row {
  try {
    return JSON.parse(printed.trim());
  } catch {
    // The verb printed something that is not JSON.
    return {};
  }
}

// Line 3: the learner's search and ask on part three's hidden test questions.
type Answer = { answer: string; citations: string[]; abstained: unknown };

function askEach(folder: string, file: string, env: Record<string, string>): Answer[] {
  return readJsonLines(join(PART_FOUR_KIT, "questions", file)).map((question) => {
    const reply = parsed(
      runVerb(folder, "ask", { stdin: { question: question.question }, env }).stdout,
    );
    const citations = Array.isArray(reply.citations) ? reply.citations.map(String) : [];
    return { answer: String(reply.answer ?? ""), citations, abstained: reply.abstained };
  });
}

function onAnswerPage(question: Row, chunk: Row | undefined): boolean {
  if (!chunk) return false;
  const pageHash = sha256(`${question.question_id}|${chunk.doc_id}|${chunk.page}`);
  return (question.page_hashes as string[]).includes(pageHash);
}

function isSupported(question: Row, answer: Answer, chunks: Map<string, Row>): boolean {
  const cited = answer.citations.map((chunkId) => chunks.get(chunkId));
  const citedText = cited.map((chunk) => String(chunk?.text ?? "")).join(" ");
  const backed = new Set(citedText.match(NUMBER) ?? []);
  const numbersBacked = (answer.answer.match(NUMBER) ?? []).every((number) => backed.has(number));
  return numbersBacked && cited.some((chunk) => onAnswerPage(question, chunk));
}

function searchHits(
  folder: string,
  questions: Row[],
  env: Record<string, string>,
  chunks: Map<string, Row>,
) {
  return questions.filter((question) => {
    const found = parsed(
      runVerb(folder, "search", { stdin: { question: question.question, k: 5 }, env }).stdout,
    );
    const ids = Array.isArray(found.chunk_ids) ? found.chunk_ids.slice(0, 5) : [];
    return ids.some((chunkId) => onAnswerPage(question, chunks.get(String(chunkId))));
  }).length;
}

function lineThreeHolds(folder: string): boolean {
  const indexDir = scratchFolder("index-");
  const runsDir = scratchFolder("ask-runs-");
  try {
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    const env = { INDEX_DIR: indexDir, RUNS_DIR: runsDir };
    if (runVerb(folder, "load", { env }).code !== 0) return false;
    const rows = readJsonLines(join(indexDir, "chunks.jsonl"));
    const chunks = new Map(rows.map((chunk) => [String(chunk.chunk_id), chunk]));
    const questions = readJsonLines(join(PART_FOUR_KIT, "questions", "test.jsonl"));
    const recall = searchHits(folder, questions, env, chunks) / questions.length;
    const answers = askEach(folder, "test.jsonl", env);
    const answered = answers.filter((answer) => answer.abstained !== true);
    const supported = answers.filter(
      (answer, position) =>
        answer.abstained !== true && isSupported(questions[position], answer, chunks),
    );
    const outOfScope = askEach(folder, "out-of-scope-test.jsonl", env);
    const abstained = outOfScope.filter((answer) => answer.abstained === true).length;
    const answersHold =
      answered.length / answers.length >= 0.8 && supported.length / answered.length >= 0.9;
    return recall >= 0.8 && answersHold && abstained >= 4;
  } finally {
    rmSync(indexDir, { recursive: true, force: true });
    rmSync(runsDir, { recursive: true, force: true });
  }
}

// Line 2: the judge on the grader's hashed labels, and the eval against the planted change.
function judgeStillAgrees(folder: string): boolean {
  const runsDir = scratchFolder("judge-runs-");
  try {
    const cases = readJsonLines(join(PART_FOUR_KIT, "judge-cases", "grader.jsonl"));
    const stdin = cases.map(({ label_hash: _labelHash, ...withoutLabel }) => withoutLabel);
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    const run = runVerb(folder, "judge", { stdin, env: { RUNS_DIR: runsDir } });
    const verdicts: Row[] = run.code === 0 ? JSON.parse(run.stdout) : [];
    const verdictOf = new Map(verdicts.map((item) => [item.case_id, item.verdict]));
    const personPasses = (row: Row) => row.label_hash === sha256(`${row.case_id}|pass`);
    const passes = cases.filter(personPasses);
    const fails = cases.filter((row) => !personPasses(row));
    const kept = passes.filter((row) => verdictOf.get(row.case_id) === "pass").length;
    const caught = fails.filter((row) => verdictOf.get(row.case_id) === "fail").length;
    const examples = calls(runsDir).flatMap((call) => (call.example_case_ids ?? []) as string[]);
    const leaked = examples.some((caseId) => /^J-[HG]/.test(caseId));
    return !leaked && caught / fails.length >= 0.8 && kept / passes.length >= 0.8;
  } finally {
    rmSync(runsDir, { recursive: true, force: true });
  }
}

function evalExitCode(folder: string, planted: boolean): number {
  const copy = mkdtempSync(join(dirname(folder), ".planted-"));
  const runsDir = scratchFolder("eval-runs-");
  try {
    cpSync(folder, copy, { recursive: true });
    if (planted)
      copyFileSync(join(PART_FOUR_KIT, "planted", "extract.py"), join(copy, "extract.py"));
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    return runVerb(copy, "eval", { env: { RUNS_DIR: runsDir } }).code;
  } finally {
    rmSync(copy, { recursive: true, force: true });
    rmSync(runsDir, { recursive: true, force: true });
  }
}

// Line 1 of the scorecard: part one's rules on the hidden test inbox.
const lineOne = proveTheRecords.filter((rule) => rule.says.includes("test inbox"));

export default [
  {
    says:
      "NOTES.md answers What the routing got wrong first and " +
      "What I would change before the agronomist relies on it",
    test: notesAreWritten,
    tryNext: "write two to four sentences under each new heading in NOTES.md, from your own runs",
  },
  {
    says: "on the hidden test inbox, zero wrong auto-routes and 10% or fewer wrong queues",
    test: (folder) => wrongAutoRoutes(folder, "test") === 0 && wrongShare(folder, "test") <= 0.1,
    tryNext: "rerun bun run verify send-unsure-to-a-person here; keep the confidence threshold",
  },
  {
    says:
      "on the hidden test inbox, after a SIGKILL during the " +
      "wait, each approved email is booked once with its id",
    test: async (folder) => {
      const run = await approvalRun(folder, "test", true);
      return (
        approvedBookedOnceWithId(run) && oneRequestPerEmail(run, "test") && handledOnceAndRight(run)
      );
    },
    tryNext: "rerun bun run verify survive-the-crash on this folder and fix its FAIL lines first",
  },
  {
    says: "line 3: search, cited answers and abstentions hold on the hidden test questions",
    test: lineThreeHolds,
    tryNext:
      "keep load.py, search.py and ask.py from part three; run bun run verify say-i-do-not-know",
  },
  {
    says: "line 2: the judge agrees with the grader, and eval blocks the planted change",
    test: (folder) =>
      judgeStillAgrees(folder) &&
      evalExitCode(folder, false) === 0 &&
      evalExitCode(folder, true) === 1,
    tryNext: "keep judge.py, eval.py and evals/baseline.json from part two",
  },
  ...lineOne,
] satisfies Rule[];
