import type { Rule } from "../scripts/verify";
import { hasVerb, runVerb } from "./lib/contract";
import { problems } from "./lib/schema";
import { devEmails } from "./lib/world";

// Ten dev emails, each read three times, because a check judges behaviour over three fresh runs.
const cache = new Map<string, { code: number; record: unknown }[]>();
function results(dir: string) {
  if (!cache.has(dir)) {
    const runs = [];
    for (const email of devEmails().slice(0, 10)) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const run = runVerb(dir, "extract", { stdin: email });
        let record: unknown;
        try {
          record = JSON.parse(run.stdout.trim());
        } catch {
          /* not JSON */
        }
        runs.push({ code: run.code, record });
      }
    }
    cache.set(dir, runs);
  }
  return cache.get(dir)!;
}

export default [
  {
    says: "contract.toml names an extract verb",
    test: (dir) => hasVerb(dir, "extract"),
    tryNext: 'add extract = "uv run python extract.py" under [verbs] in contract.toml',
  },
  {
    says: "extract prints bare JSON, with no prose and no code fence, on 10 dev emails over 3 runs",
    test: (dir) => results(dir).every((run) => run.code === 0 && run.record !== undefined),
    tryNext:
      "ask for JSON with complete(..., schema=SCHEMA) and print json.dumps of the parsed reply",
  },
  {
    says: "every record fits worlds/tallgrass_bend/schema.json",
    test: (dir) =>
      results(dir).every((run) => run.record !== undefined && problems(run.record).length === 0),
    tryNext:
      "load schema.json and pass it as schema=; the keys are sender, field_name, product_name, rate and rate_unit",
  },
] satisfies Rule[];
