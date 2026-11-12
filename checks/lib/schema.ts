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

const typeOf = (value: unknown) =>
  value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value === "number"
        ? "number"
        : typeof value;

export function problems(record: unknown, schema: Schema = SCHEMA): string[] {
  if (typeof record !== "object" || record === null || Array.isArray(record))
    return ["it is not a JSON object"];
  const found: string[] = [];
  const fields = record as Record<string, unknown>;
  for (const key of schema.required) if (!(key in fields)) found.push(`"${key}" is missing`);
  for (const [key, value] of Object.entries(fields)) {
    const property = schema.properties[key];
    if (!property) {
      if (schema.additionalProperties === false) found.push(`"${key}" is not in the schema`);
      continue;
    }
    if (typeOf(value) !== property.type)
      found.push(`"${key}" is ${typeOf(value)}, the schema wants ${property.type}`);
    if (property.enum && !property.enum.includes(value as string))
      found.push(`"${key}" must be one of ${property.enum.join(", ")}`);
  }
  return found;
}
