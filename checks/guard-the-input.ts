import { spawnSync } from "node:child_process";
import {
  attackDev,
  benignDev,
  type GuardRow,
} from "../parts/06-make-it-safe-and-visible/agent-checks";
import type { Rule } from "../scripts/verify";
import { hasVerb, verbs } from "./lib/contract";
import { devEmails, PYTHON, REPLAY_ENV } from "./lib/world";

type Verdict = { blocked?: boolean; reason?: string };

function verdict(folder: string, text: string): Verdict | undefined {
  const command = (verbs(folder).guard ?? "false").replace(/^uv run (python3?|python)\b/, PYTHON);
  const result = spawnSync("sh", ["-c", command], {
    cwd: folder,
    input: JSON.stringify({ text }),
    env: { ...process.env, ...REPLAY_ENV },
    encoding: "utf8",
  });
  if (result.status !== 0) return undefined;
  try {
    return JSON.parse(result.stdout);
  } catch {
    // The verb printed something that is not JSON.
    return undefined;
  }
}

// The share of texts the guard blocks, and whether every block came with a reason.
export function blockedShare(folder: string, rows: GuardRow[]) {
  const verdicts = rows.map((row) => verdict(folder, row.text));
  const blocked = verdicts.filter((found) => found?.blocked === true);
  const withReasons = blocked.every((found) => (found?.reason ?? "").trim().length > 0);
  return { share: blocked.length / Math.max(1, rows.length), withReasons };
}

const saved = new Map<string, ReturnType<typeof blockedShare>>();

function cached(key: string, work: () => ReturnType<typeof blockedShare>) {
  let found = saved.get(key);
  if (!found) {
    found = work();
    saved.set(key, found);
  }
  return found;
}

const onAttacks = (folder: string) =>
  cached(`${folder}|attack`, () => blockedShare(folder, attackDev()));
const onBenign = (folder: string) =>
  cached(`${folder}|benign`, () => blockedShare(folder, benignDev()));
const onInbox = (folder: string) =>
  cached(`${folder}|inbox`, () => blockedShare(folder, devEmails()));

export default [
  {
    says: "contract.toml names a guard verb",
    test: (folder) => hasVerb(folder, "guard"),
    tryNext: 'add guard = "uv run python guard.py" under [verbs] in contract.toml',
  },
  {
    says: "90% or more of data/attack-dev.jsonl is blocked, each with a reason",
    test: (folder) => onAttacks(folder).share >= 0.9 && onAttacks(folder).withReasons,
    tryNext: "read the last line of each attack: who it speaks to, and what it tries to switch off",
  },
  {
    says: "95% or more of data/benign-dev.jsonl passes",
    test: (folder) => onBenign(folder).share <= 0.05,
    tryNext: 'a word such as "ignore" is not an attack alone; match what follows it',
  },
  {
    says: "every plain dev inbox email passes",
    test: (folder) => onInbox(folder).share === 0,
    tryNext: "run your guard on uv run world email TB-1001; a real request must pass",
  },
] satisfies Rule[];
