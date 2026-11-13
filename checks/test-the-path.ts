import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  agentRuns,
  deskRecords,
  everyRun,
  needsApproval,
  parseJson,
  plantedTask,
} from "../parts/05-let-it-act/agent-checks";
import type { Rule } from "../scripts/verify";
import { hasVerb, verbs } from "./lib/contract";
import { devEmails, PYTHON, REPLAY_ENV } from "./lib/world";

type GoldenTask = {
  // biome-ignore lint/style/useNamingConvention: the learner's files use snake_case keys.
  email_id?: string;
  // biome-ignore lint/style/useNamingConvention: the learner's files use snake_case keys.
  expected_tools?: string[];
};
type Report = {
  tasks?: number;
  // biome-ignore lint/style/useNamingConvention: the learner's files use snake_case keys.
  on_path?: number;
  // biome-ignore lint/style/useNamingConvention: the learner's files use snake_case keys.
  left_path?: Record<string, unknown>[];
};

const TOOL_NAMES = new Set(["find_grower", "find_product", "book_job", "send_to_review"]);
const MINIMUM_TASKS = 8;

function golden(folder: string): GoldenTask[] {
  const file = join(folder, "evals", "paths.jsonl");
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
  try {
    return lines.map((line) => JSON.parse(line));
  } catch {
    // A line that is not JSON makes the whole file unreadable.
    return [];
  }
}

const devIds = new Set(devEmails().map((email) => email.email_id));

function isWellFormed(task: GoldenTask): boolean {
  const tools = task.expected_tools ?? [];
  const knownTools = tools.length > 0 && tools.every((tool) => TOOL_NAMES.has(tool));
  return devIds.has(task.email_id ?? "") && knownTools;
}

// The golden set covers a clean booking on a big field, a misspelled product and a refusal.
function coversEveryKind(tasks: GoldenTask[]): boolean {
  const paths = tasks.map((task) => task.expected_tools ?? []);
  const asksTwice = paths.some((path) => path.filter((tool) => tool === "find_product").length > 1);
  const endsInReview = paths.some((path) => path[path.length - 1] === "send_to_review");
  const bookedBig = tasks.some((task) => {
    const record = deskRecords().find((row) => row.email_id === task.email_id);
    return record?.outcome === "booked" && needsApproval(record.field_id);
  });
  return asksTwice && endsInReview && bookedBig;
}

// The agent on the golden tasks, then the learner's paths verb on its trace.
const goldenRuns = (folder: string) =>
  agentRuns(folder, "golden", {
    split: "dev",
    tasks: golden(folder).map((task) => plantedTask(String(task.email_id), "")),
    withDesk: true,
    after: "paths",
  });

// A trace written by the check: every golden task on its path, except the first one,
// where the agent skipped find_product.
function plantedTrace(tasks: GoldenTask[]): { trace: string; skippedStep: number } {
  const lines: string[] = [];
  let skippedStep = 0;
  tasks.forEach((task, index) => {
    let tools = task.expected_tools ?? [];
    if (index === 0) {
      skippedStep = tools.indexOf("find_product") + 1;
      tools = tools.filter((_, position) => position !== skippedStep - 1);
    }
    for (const tool of tools) {
      // biome-ignore lint/style/useNamingConvention: the trace is read by the learner's Python.
      lines.push(JSON.stringify({ run_id: `run-${index}`, email_id: task.email_id, tool }));
    }
  });
  return { trace: `${lines.join("\n")}\n`, skippedStep };
}

const savedPlanted = new Map<string, { code: number; report: Report; skippedStep: number }>();

function pathsOnPlantedTrace(folder: string) {
  const saved = savedPlanted.get(folder);
  if (saved) return saved;
  const runsDir = mkdtempSync(join(tmpdir(), "planted-trace-"));
  const { trace, skippedStep } = plantedTrace(golden(folder));
  writeFileSync(join(runsDir, "trace.jsonl"), trace);
  const command = (verbs(folder).paths ?? "false").replace(/^uv run (python3?|python)\b/, PYTHON);
  const result = spawnSync("sh", ["-c", command], {
    cwd: folder,
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    env: { ...process.env, ...REPLAY_ENV, RUNS_DIR: runsDir },
    encoding: "utf8",
  });
  rmSync(runsDir, { recursive: true, force: true });
  const found = { code: result.status ?? 2, report: parseJson(result.stdout) ?? {}, skippedStep };
  savedPlanted.set(folder, found);
  return found;
}

function reportsTheSkip(folder: string): boolean {
  const { code, report, skippedStep } = pathsOnPlantedTrace(folder);
  const firstEmail = golden(folder)[0]?.email_id;
  const left = (report as Report).left_path ?? [];
  const named = left.find((item) => item.email_id === firstEmail);
  const rightStep = named?.step === skippedStep && named?.expected === "find_product";
  return code === 1 && rightStep;
}

export default [
  {
    says: `evals/paths.jsonl has ${MINIMUM_TASKS} or more golden tasks, dev emails, real tools`,
    test: (folder) => {
      const tasks = golden(folder);
      return tasks.length >= MINIMUM_TASKS && tasks.every(isWellFormed);
    },
    tryNext:
      "add one line per task: email_id and expected_tools, " +
      "using find_grower, find_product, book_job, send_to_review",
  },
  {
    says: "the golden tasks cover a big-field booking, a misspelled product and a refusal",
    test: (folder) => coversEveryKind(golden(folder)),
    tryNext: "add TB-1010 (a big field), TB-1008 (Stemshure) and TB-1004 (above the label)",
  },
  {
    says: "contract.toml names a paths verb",
    test: (folder) => hasVerb(folder, "paths"),
    tryNext: 'add paths = "uv run python paths.py" under [verbs] in contract.toml',
  },
  {
    says: "after the agent runs the golden tasks, paths exits 0: every task stayed on its path",
    test: (folder) =>
      everyRun(goldenRuns(folder), (run) => {
        const report = (parseJson(run.extra?.stdout) ?? {}) as Report;
        return run.extra?.code === 0 && report.on_path === golden(folder).length;
      }),
    tryNext:
      "run the agent on one golden email, read runs/trace.jsonl, " +
      "and write the tools it should call, in order",
  },
  {
    says: "on a planted trace that skips find_product, paths exits 1 and names the step",
    test: reportsTheSkip,
    tryNext: "compare the two paths step by step, not only the last tool: both end in book_job",
  },
  {
    says: "on that planted trace, every other golden task is reported on its path",
    test: (folder) => {
      const report = pathsOnPlantedTrace(folder).report as Report;
      return report.on_path === golden(folder).length - 1;
    },
    tryNext: "take each email's tools from its own run only, in the order they appear",
  },
] satisfies Rule[];
