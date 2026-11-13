// Validates a record against a world's schema.json: required keys, types, enums, no extra keys.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WORLD_DIR } from "./world";

type Property = { type: string; enum?: string[] };
type Schema = {
  required: string[];
  properties: Record<string, Property>;
  additionalProperties?: boolean;
};

export const SCHEMA: Schema = JSON.parse(readFileSync(join(WORLD_DIR, "schema.json"), "utf8"));

// The type name JSON Schema uses for a value: "null", "array", "number", "string" and so on.
function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function propertyProblems(key: string, value: unknown, property: Property): string[] {
  const found: string[] = [];
  if (typeOf(value) !== property.type) {
    found.push(`"${key}" is ${typeOf(value)}, the schema wants ${property.type}`);
  }
  if (property.enum && !property.enum.includes(value as string)) {
    found.push(`"${key}" must be one of ${property.enum.join(", ")}`);
  }
  return found;
}

export function problems(record: unknown, schema: Schema = SCHEMA): string[] {
  if (!isPlainObject(record)) return ["it is not a JSON object"];
  const found: string[] = [];
  for (const key of schema.required) {
    if (!(key in record)) found.push(`"${key}" is missing`);
  }
  for (const [key, value] of Object.entries(record)) {
    const property = schema.properties[key];
    if (property) {
      found.push(...propertyProblems(key, value, property));
    } else if (schema.additionalProperties === false) {
      found.push(`"${key}" is not in the schema`);
    }
  }
  return found;
}
