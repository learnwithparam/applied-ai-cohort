// Runs a short Python script inside a learner's folder and reads back one line of JSON.
// The small steps use this: the check builds its own fake inputs, so no course world is needed.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PYTHON } from "./world";

export type Findings = Record<string, unknown>;

export function inspect(folder: string, code: string): Findings | undefined {
  const result = spawnSync(PYTHON, ["-c", code], {
    cwd: folder,
    encoding: "utf8",
    timeout: 30_000,
  });
  if (result.status !== 0) return undefined;
  const lines = result.stdout.split("\n").filter(Boolean);
  const lastLine = lines[lines.length - 1];
  if (!lastLine) return undefined;
  try {
    return JSON.parse(lastLine) as Findings;
  } catch {
    // The script printed something that is not JSON, so the rule counts as not met.
    return undefined;
  }
}

// Runs a command in the learner's folder, for steps whose script is the thing being checked.
export function runScript(folder: string, args: string[]): boolean {
  const result = spawnSync(PYTHON, args, { cwd: folder, encoding: "utf8", timeout: 30_000 });
  return result.status === 0;
}

// Runs `work` on a throwaway copy of the learner's folder, so a script that writes files
// never changes the starter or the solution.
export function withCopy<T>(folder: string, work: (copy: string) => T): T {
  const copy = mkdtempSync(join(tmpdir(), "mini-"));
  try {
    cpSync(folder, copy, { recursive: true });
    return work(copy);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}

export function readLines(file: string): Record<string, unknown>[] {
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}
