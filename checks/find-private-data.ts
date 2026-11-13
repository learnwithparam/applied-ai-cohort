import { spawnSync } from "node:child_process";
import { type PrivateRow, privateDev } from "../parts/06-make-it-safe-and-visible/agent-checks";
import type { Rule } from "../scripts/verify";
import { hasVerb, verbs } from "./lib/contract";
import { devEmails, PYTHON, REPLAY_ENV } from "./lib/world";

type Found = { start: number; end: number };

// The spans the learner's private verb finds in one text, or undefined when it fails.
export function findSpans(folder: string, text: string): Found[] | undefined {
  const command = (verbs(folder).private ?? "false").replace(/^uv run (python3?|python)\b/, PYTHON);
  const result = spawnSync("sh", ["-c", command], {
    cwd: folder,
    input: JSON.stringify({ text }),
    env: { ...process.env, ...REPLAY_ENV },
    encoding: "utf8",
  });
  if (result.status !== 0) return undefined;
  try {
    return JSON.parse(result.stdout).spans;
  } catch {
    // The verb printed something that is not JSON.
    return undefined;
  }
}

export type Detection = { found: number; total: number; extra: number; reported: number };

const covers = (outer: Found, inner: Found) => outer.start <= inner.start && outer.end >= inner.end;
const touches = (first: Found, second: Found) =>
  first.start < second.end && second.start < first.end;

// Recall: private spans found whole. Extra: reported spans that touch no private span.
export function detect(folder: string, rows: PrivateRow[]): Detection {
  const detection = { found: 0, total: 0, extra: 0, reported: 0 };
  for (const row of rows) {
    const spans = findSpans(folder, row.text) ?? [];
    detection.total += row.spans.length;
    detection.found += row.spans.filter((gold) => spans.some((span) => covers(span, gold))).length;
    detection.reported += spans.length;
    const extra = spans.filter((span) => !row.spans.some((gold) => touches(span, gold)));
    detection.extra += extra.length;
  }
  return detection;
}

const saved = new Map<string, Detection>();

function devDetection(folder: string): Detection {
  let detection = saved.get(folder);
  if (!detection) {
    detection = detect(folder, privateDev());
    saved.set(folder, detection);
  }
  return detection;
}

export const recall = (detection: Detection) => detection.found / Math.max(1, detection.total);

// Plain inbox emails hold rates, ids and dates but nothing private.
function quietOnPlainEmails(folder: string): boolean {
  return devEmails()
    .slice(0, 10)
    .every((email) => findSpans(folder, email.text)?.length === 0);
}

export default [
  {
    says: "contract.toml names a private verb",
    test: (folder) => hasVerb(folder, "private"),
    tryNext: 'add private = "uv run python privacy.py" under [verbs] in contract.toml',
  },
  {
    says: "recall of private spans on data/private-dev.jsonl is 0.95 or more",
    test: (folder) => recall(devDetection(folder)) >= 0.95,
    tryNext:
      "list every phone, bank account and card format in data/private-dev.jsonl, " +
      "and add a pattern for each",
  },
  {
    says: "at most 1 in 10 reported spans is not private data",
    test: (folder) => {
      const detection = devDetection(folder);
      return detection.reported > 0 && detection.extra <= detection.reported * 0.1;
    },
    tryNext: "make each pattern need enough digits, so rates such as 0.38 L/ha do not match",
  },
  {
    says: "plain inbox emails, with rates and ids but nothing private, give no spans",
    test: quietOnPlainEmails,
    tryNext: "run your verb on uv run world email TB-1001 and read what it finds",
  },
] satisfies Rule[];
