// Reads a learner's Markdown file by its "## " sections.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// For example, "## Metric" followed by two lines gives { metric: "the two lines\n" }.
export function sections(folder: string, file: string): Record<string, string> {
  const path = join(folder, file);
  if (!existsSync(path)) return {};
  const found: Record<string, string> = {};
  let current = "";
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      found[current] = "";
    } else if (current) {
      found[current] += `${line}\n`;
    }
  }
  return found;
}

// A section counts as written when it has words of its own, not the starter's TODO.
export function written(text: string | undefined, minimumWords = 3): boolean {
  if (!text || /TODO/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  return words.length >= minimumWords;
}
