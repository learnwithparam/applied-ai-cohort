// Runs the learner's route verb on every inbox email and compares each queue with the desk's.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { hasVerb, runVerb } from "./lib/contract";
import { readJsonLines, WORLD_DIR } from "./lib/world";

export const PART_FOUR_KIT = join(ROOT, "parts", "04-decide-and-wait", "kit");
export type Split = "dev" | "test";
export type Row = Record<string, unknown>;
export type Routed = { emailId: string; queue: unknown; confidence: unknown; code: number };

const QUEUES = new Set(["book", "agronomist", "person"]);
const MOST_WRONG = 0.1;

function deskRows(split: Split): Row[] {
  const file = split === "dev" ? "dev.jsonl" : "test.hashes.jsonl";
  return readJsonLines(join(PART_FOUR_KIT, "routes", file));
}

// True when the queue is the one the desk chose. The test split keeps only a hash of it.
export function isDeskQueue(split: Split, emailId: string, queue: unknown): boolean {
  const desk = deskRows(split).find((row) => row.email_id === emailId);
  if (!desk) return false;
  if (split === "dev") return desk.queue === queue;
  const queueHash = createHash("sha256").update(`${emailId}|${queue}`).digest("hex");
  return desk.hash === queueHash;
}

export function emailIds(split: Split): string[] {
  return deskRows(split).map((row) => String(row.email_id));
}

export function agronomistEmails(split: Split): string[] {
  return emailIds(split).filter((emailId) => isDeskQueue(split, emailId, "agronomist"));
}

const emailText = (split: Split, emailId: string) =>
  readFileSync(join(WORLD_DIR, "inbox", split, `${emailId}.txt`), "utf8");

function routeOne(folder: string, split: Split, emailId: string): Routed {
  // biome-ignore lint/style/useNamingConvention: the learner's Python reads "email_id".
  const stdin = { email_id: emailId, text: emailText(split, emailId) };
  const run = runVerb(folder, "route", { stdin });
  try {
    const answer = JSON.parse(run.stdout.trim());
    return { emailId, queue: answer.queue, confidence: answer.confidence, code: run.code };
  } catch {
    // The verb printed something that is not JSON.
    return {
      emailId,
      queue: undefined,
      confidence: undefined,
      code: run.code === 0 ? 2 : run.code,
    };
  }
}

const savedRoutes = new Map<string, Routed[]>();

export function routes(folder: string, split: Split): Routed[] {
  const key = `${folder}|${split}`;
  let saved = savedRoutes.get(key);
  if (!saved) {
    saved = emailIds(split).map((emailId) => routeOne(folder, split, emailId));
    savedRoutes.set(key, saved);
  }
  return saved;
}

export function wrongShare(folder: string, split: Split): number {
  const all = routes(folder, split);
  const wrong = all.filter((routed) => !isDeskQueue(split, routed.emailId, routed.queue));
  return wrong.length / all.length;
}

// Booked or sent to the agronomist with no person, when the desk chose another queue.
export function wrongAutoRoutes(folder: string, split: Split): number {
  const automatic = routes(folder, split).filter((routed) => routed.queue !== "person");
  return automatic.filter((routed) => !isDeskQueue(split, routed.emailId, routed.queue)).length;
}

const SEED = JSON.parse(readFileSync(join(WORLD_DIR, "seed.json"), "utf8"));
const PRODUCT_NAMES: string[] = SEED.products.map((product: Row) =>
  String(product.name).toLowerCase(),
);

// The keyword baseline from baseline.py: no model, only words in the raw email.
function keywordQueue(text: string): string {
  const lowerText = text.toLowerCase();
  if (lowerText.includes("acre") || lowerText.includes("north block")) return "person";
  if (!PRODUCT_NAMES.some((name) => lowerText.includes(name))) return "person";
  return "book";
}

export function baselineWrongShare(split: Split): number {
  const ids = emailIds(split);
  const wrong = ids.filter((emailId) => {
    const queue = keywordQueue(emailText(split, emailId));
    return !isDeskQueue(split, emailId, queue);
  });
  return wrong.length / ids.length;
}

function everyAnswerIsValid(folder: string): boolean {
  return routes(folder, "dev").every((routed) => {
    const confidence = Number(routed.confidence);
    const validConfidence =
      typeof routed.confidence === "number" && confidence >= 0 && confidence <= 1;
    return routed.code === 0 && QUEUES.has(String(routed.queue)) && validConfidence;
  });
}

export default [
  {
    says: "contract.toml names a route verb",
    test: (folder) => hasVerb(folder, "route"),
    tryNext: 'add route = "uv run python route.py" under [verbs] in contract.toml',
  },
  {
    says:
      "route exits 0 on every dev email with a queue " +
      "(book, agronomist or person) and a confidence from 0 to 1",
    test: everyAnswerIsValid,
    tryNext: "pipe one email into uv run python route.py and read what it prints",
  },
  {
    says: `the queue differs from the desk's on ${MOST_WRONG * 100}% of dev emails or fewer`,
    test: (folder) => wrongShare(folder, "dev") <= MOST_WRONG,
    tryNext: "run uv run python routes.py and read the rows where Yours differs from Desk",
  },
  {
    says: "route picks the wrong queue less often than the keyword baseline",
    test: (folder) => wrongShare(folder, "dev") < baselineWrongShare("dev"),
    tryNext: "use the record and the label: the keyword baseline cannot read a rate",
  },
] satisfies Rule[];
