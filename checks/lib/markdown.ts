// Reads a learner's Markdown file by its "## " sections.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function sections(dir: string, file: string): Record<string, string> {
  const path = join(dir, file);
  if (!existsSync(path)) return {};
  const found: Record<string, string> = {};
  let current = "";
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const heading = line.match(/^## (.+)$/);
    if (heading) { current = heading[1].trim().toLowerCase(); found[current] = ""; continue; }
    if (current) found[current] += line + "\n";
  }
  return found;
}

// A section counts as written when it has words of its own, not the starter's TODO.
export const written = (text: string | undefined, minimumWords = 3) =>
  !!text && !/TODO/.test(text) && text.split(/\s+/).filter(Boolean).length >= minimumWords;
