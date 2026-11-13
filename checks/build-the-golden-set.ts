// Reads evals/golden.jsonl: cases a person signed off, each with the record it should produce.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { problems } from "./lib/schema";
import { WORLD_DIR } from "./lib/world";
import { failureModes } from "./name-the-failures";
import { devTruth, type Row, readRows } from "./read-the-traces";

const LITRES_PER_ACRE_TO_PER_HECTARE = 2.4710538;
const RATE_GAP_ALLOWED = 0.02;
const NOT_A_PERSON = /\b(model|llm|ai|gpt|claude|auto|bot|todo)\b/i;

type Seed = { growers: Row[]; fields: Row[]; products: Row[] };
const SEED: Seed = JSON.parse(readFileSync(join(WORLD_DIR, "seed.json"), "utf8"));

export const goldenCases = (folder: string) => readRows(folder, join("evals", "golden.jsonl"));

const expectedOf = (goldenCase: Row) => (goldenCase.expected ?? {}) as Row;

function nameOf(records: Row[], idKey: string, id: unknown, nameKey: string): string {
  const found = records.find((record) => record[idKey] === id);
  return String(found?.[nameKey] ?? "").toLowerCase();
}

function differentDevEmails(folder: string): boolean {
  const truth = devTruth();
  const emailIds = goldenCases(folder).map((goldenCase) => String(goldenCase.email_id));
  const allKnown = emailIds.every((emailId) => truth.has(emailId));
  return emailIds.length >= 25 && allKnown && new Set(emailIds).size === emailIds.length;
}

function signedOffByPerson(goldenCase: Row): boolean {
  const signer = String(goldenCase.signed_off_by ?? "").trim();
  return signer.length >= 3 && !NOT_A_PERSON.test(signer);
}

function coversEveryMode(folder: string): boolean {
  const modeNames = failureModes(folder).map((mode) => mode.name);
  const caseModes = goldenCases(folder).map((goldenCase) => String(goldenCase.mode).toLowerCase());
  const knownModes = new Set([...modeNames, "clean"]);
  const everyCaseKnown = caseModes.every((mode) => knownModes.has(mode));
  const countOf = (name: string) => caseModes.filter((mode) => mode === name).length;
  return modeNames.length > 0 && everyCaseKnown && modeNames.every((name) => countOf(name) >= 2);
}

function rateInHectares(expected: Row): number {
  const rate = Number(expected.rate);
  if (expected.rate_unit === "L/acre") return rate * LITRES_PER_ACRE_TO_PER_HECTARE;
  return rate;
}

// The expected record must say what the desk booked: the same grower, product, field and rate.
function agreesWithDesk(goldenCase: Row, truth: Map<string, Row>): boolean {
  const desk = truth.get(String(goldenCase.email_id));
  if (!desk) return false;
  if (desk.outcome !== "booked") return true;
  const expected = expectedOf(goldenCase);
  const growerEmail = nameOf(SEED.growers, "grower_id", desk.grower_id, "email");
  const productName = nameOf(SEED.products, "product_code", desk.product_code, "name");
  const fieldName = nameOf(SEED.fields, "field_id", desk.field_id, "name");
  const sameSender = String(expected.sender).toLowerCase() === growerEmail;
  const sameProduct = String(expected.product_name).toLowerCase() === productName;
  const fieldIsClear = desk.trap !== "ambiguous_field";
  const sameField = !fieldIsClear || String(expected.field_name).toLowerCase() === fieldName;
  const rateGap = Math.abs(rateInHectares(expected) - Number(desk.rate_l_per_ha));
  return sameSender && sameProduct && sameField && rateGap <= RATE_GAP_ALLOWED;
}

function everyCaseAgreesWithDesk(folder: string): boolean {
  const truth = devTruth();
  const cases = goldenCases(folder);
  return cases.length > 0 && cases.every((goldenCase) => agreesWithDesk(goldenCase, truth));
}

export default [
  {
    says: "evals/golden.jsonl has 25 or more cases, each on a different dev email",
    test: differentDevEmails,
    tryNext: "add one line per case, starting from your labelled traces, until there are 25",
  },
  {
    says: "every expected record fits schema.json",
    test: (folder) =>
      goldenCases(folder).every((goldenCase) => problems(expectedOf(goldenCase)).length === 0),
    tryNext: "give expected the five keys of schema.json; rate_unit is L/ha or L/acre",
  },
  {
    says: "every case is signed off by a person, by name",
    test: (folder) => goldenCases(folder).every(signedOffByPerson),
    tryNext: 'set "signed_off_by" to the person who checked the case, such as the desk lead',
  },
  {
    says: "every failure mode has 2 cases or more, and every case names a mode or clean",
    test: coversEveryMode,
    tryNext: "copy the mode names from evals/failure-modes.md exactly, and use clean for the rest",
  },
  {
    says: "every expected record agrees with the desk's records",
    test: everyCaseAgreesWithDesk,
    tryNext:
      "write what the record should say, not what the model said: a rate per acre keeps L/acre",
  },
] satisfies Rule[];
