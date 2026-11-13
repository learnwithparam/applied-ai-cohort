import type { Rule } from "../scripts/verify";
import { hasVerb, runVerb } from "./lib/contract";
import { problems } from "./lib/schema";
import { devEmails, type InboxEmail } from "./lib/world";

type ExtractRun = { code: number; record: unknown };

function parseRecord(printed: string): unknown {
  try {
    return JSON.parse(printed.trim());
  } catch {
    // Prose or a code fence around the JSON: there is no record to read.
    return undefined;
  }
}

function extractOnce(folder: string, email: InboxEmail): ExtractRun {
  const run = runVerb(folder, "extract", { stdin: email });
  return { code: run.code, record: parseRecord(run.stdout) };
}

// Ten dev emails, each read three times, because a check judges behaviour over three fresh runs.
// Results are kept per folder so each rule reads the same runs.
const savedRuns = new Map<string, ExtractRun[]>();

function extractRuns(folder: string): ExtractRun[] {
  const saved = savedRuns.get(folder);
  if (saved) return saved;
  const runs: ExtractRun[] = [];
  for (const email of devEmails().slice(0, 10)) {
    for (let attempt = 0; attempt < 3; attempt++) runs.push(extractOnce(folder, email));
  }
  savedRuns.set(folder, runs);
  return runs;
}

function fitsSchema(run: ExtractRun): boolean {
  return run.record !== undefined && problems(run.record).length === 0;
}

export default [
  {
    says: "contract.toml names an extract verb",
    test: (folder) => hasVerb(folder, "extract"),
    tryNext: 'add extract = "uv run python extract.py" under [verbs] in contract.toml',
  },
  {
    says: "extract prints bare JSON, with no prose and no code fence, on 10 dev emails over 3 runs",
    test: (folder) =>
      extractRuns(folder).every((run) => run.code === 0 && run.record !== undefined),
    tryNext:
      "ask for JSON with complete(..., schema=SCHEMA) and print json.dumps of the parsed reply",
  },
  {
    says: "every record fits worlds/tallgrass_bend/schema.json",
    test: (folder) => extractRuns(folder).every(fitsSchema),
    tryNext:
      "load schema.json and pass it as schema=; " +
      "the keys are sender, field_name, product_name, rate and rate_unit",
  },
] satisfies Rule[];
