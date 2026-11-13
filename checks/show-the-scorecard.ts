import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentRuns, type GuardRow, graderSets, testEmails } from "../parts/07-ship-it/agent-checks";
import type { Rule } from "../scripts/verify";
import { gateRuns } from "./gate-the-release";
import { hasVerb, intakeRuns, verbs } from "./lib/contract";
import { PYTHON, REPLAY_ENV } from "./lib/world";

type Row = { line: number; number: number; status: string };

// Runs the scorecard verb in a scratch copy, so the check never writes into your folder.
function scorecardRows(folder: string): Row[] | undefined {
  const scratch = mkdtempSync(join(tmpdir(), "scorecard-"));
  try {
    cpSync(folder, scratch, { recursive: true });
    const command = (verbs(folder).scorecard ?? "false").replace(
      /^uv run (python3?|python)\b/,
      PYTHON,
    );
    const env = { ...process.env, ...REPLAY_ENV };
    const result = spawnSync("sh", ["-c", command], { cwd: scratch, env, timeout: 300_000 });
    const file = join(scratch, "SCORECARD.md");
    if (result.status !== 0 || !existsSync(file)) return undefined;
    return parseRows(readFileSync(file, "utf8"));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// Table rows such as "| 5 | Agent end states right | 0.65 | 0.6 or more | PASS |".
export function parseRows(table: string): Row[] {
  const rows: Row[] = [];
  for (const line of table.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    if (!/^\d$/.test(cells[1] ?? "")) continue;
    rows.push({ line: Number(cells[1]), number: Number(cells[3]), status: cells[5] ?? "" });
  }
  return rows;
}

const saved = new Map<string, Row[] | undefined>();

export function rowsFor(folder: string): Row[] | undefined {
  if (!saved.has(folder)) saved.set(folder, scorecardRows(folder));
  return saved.get(folder);
}

const rowNumber = (folder: string, line: number) =>
  rowsFor(folder)?.find((row) => row.line === line)?.number;

const close = (learner: number | undefined, right: number) =>
  learner !== undefined && Math.abs(learner - right) < 0.01;

async function intakeShare(folder: string): Promise<number> {
  const runs = await intakeRuns(folder, "test");
  return runs[0].score.correctShare;
}

async function agentShare(folder: string): Promise<number> {
  const scenario = { split: "test" as const, tasks: testEmails(), withDesk: false };
  const runs = await agentRuns(folder, "scorecard agent", scenario);
  return runs[0].score.correctShare;
}

function blockedShare(folder: string, rows: GuardRow[]): number {
  const command = (verbs(folder).guard ?? "false").replace(/^uv run (python3?|python)\b/, PYTHON);
  const env = { ...process.env, ...REPLAY_ENV };
  const blocked = rows.filter((row) => {
    const input = JSON.stringify({ text: row.text });
    const result = spawnSync("sh", ["-c", command], { cwd: folder, env, input, encoding: "utf8" });
    return result.stdout.includes('"blocked": true');
  });
  return blocked.length / rows.length;
}

// Two peer reviews, by two people, each made at a commit and scored 0 to 2 on both questions.
function reviewsAreFiled(folder: string): boolean {
  const reviewsFolder = join(folder, "reviews");
  if (!existsSync(reviewsFolder)) return false;
  const files = readdirSync(reviewsFolder).filter((name) => name.endsWith(".md"));
  const reviews = files.map((name) => readFileSync(join(reviewsFolder, name), "utf8"));
  const complete = reviews.filter((text) => {
    const commit = /^Commit: [0-9a-f]{7,40}$/m.test(text);
    const scores = text.match(/^Score: [012]$/gm) ?? [];
    return commit && /^Reviewer: \S+/m.test(text) && scores.length >= 2;
  });
  const reviewers = new Set(complete.map((text) => text.match(/^Reviewer: (.+)$/m)?.[1]));
  return complete.length >= 2 && reviewers.size >= 2;
}

export default [
  {
    says: "contract.toml names a scorecard verb, and it writes SCORECARD.md with lines 1 to 7",
    test: (folder) => {
      const lines = (rowsFor(folder) ?? []).map((row) => row.line);
      const allSeven = [1, 2, 3, 4, 5, 6, 7].every((line) => lines.includes(line));
      return hasVerb(folder, "scorecard") && allSeven;
    },
    tryNext: "run uv run python scorecard.py, and fix what it prints first",
  },
  {
    says: "line 1 is the intake's correct share on the test inbox, as the check measures it",
    test: async (folder) => close(rowNumber(folder, 1), await intakeShare(folder)),
    tryNext:
      "measure line 1 by running intake.py on a fresh test world; never write a number in by hand",
  },
  {
    says: "line 5 is the agent's correct share on the test inbox, as the check measures it",
    test: async (folder) => close(rowNumber(folder, 5), await agentShare(folder)),
    tryNext: "measure line 5 by running the agent on every test email on a fresh test world",
  },
  {
    says: "line 6 is the share of the grader's attacks your guard blocks",
    test: (folder) => close(rowNumber(folder, 6), blockedShare(folder, graderSets().attack)),
    tryNext: "run guard.check on every attack in data/guard-sets.json and count the blocks",
  },
  {
    says: "line 7 says PASS, and the release gate really exits 0",
    test: (folder) => {
      const lineSeven = rowsFor(folder)?.find((row) => row.line === 7);
      return lineSeven?.status === "PASS" && gateRuns(folder).clean.code === 0;
    },
    tryNext: "run gate.py from the scorecard and use its exit code; rerun gate-the-release",
  },
  {
    says: "reviews/ holds two peer reviews by two people, each at a commit, both questions scored",
    test: reviewsAreFiled,
    tryNext: "ask two peers to clone your repo at a commit and fill in reviews/<name>.md",
  },
] satisfies Rule[];
