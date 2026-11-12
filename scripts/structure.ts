// Reads the repo layout once. Every other script asks this file where things are.
import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(import.meta.dir, "..");

export type Step = {
  name: string; // verb-the-thing, also the command argument
  dir: string;
  part: string;
  meta: { minutes: number; screen: boolean; solution: boolean };
};
// A skeleton part has its README and no steps yet; a later build session fills it in.
export type Part = { name: string; dir: string; steps: Step[]; skeleton: boolean };

// Part and step folders carry an order prefix ("01-"); other folders, such as images/, are not steps.
const dirs = (p: string) =>
  existsSync(p) ? readdirSync(p).filter((d) => /^\d+-/.test(d) && statSync(join(p, d)).isDirectory()).sort() : [];

// Folders keep an order prefix for sorting only. Learners never type it.
export const bareName = (folder: string) => folder.replace(/^\d+-/, "");

// The orientation is the first part: it has a checked step like any other.
const partDirs = () => [
  ...(existsSync(join(ROOT, "00-orientation")) ? [{ name: "orientation", dir: join(ROOT, "00-orientation") }] : []),
  ...dirs(join(ROOT, "parts")).map((p) => ({ name: bareName(p), dir: join(ROOT, "parts", p) })),
];

export function parts(): Part[] {
  return partDirs().map(({ name, dir }) => {
    const steps = dirs(dir).map((s) => {
      const sdir = join(dir, s);
      const metaPath = join(sdir, "step.toml");
      const raw = existsSync(metaPath) ? (Bun.TOML.parse(readFileSync(metaPath, "utf8")) as any) : {};
      return {
        name: bareName(s),
        dir: sdir,
        part: name,
        meta: { minutes: Number(raw.minutes ?? 0), screen: Boolean(raw.screen), solution: Boolean(raw.solution) },
      };
    });
    const readme = join(dir, "README.md");
    const skeleton = steps.length === 0 && existsSync(readme) && readFileSync(readme, "utf8").includes("TODO(part session)");
    return { name, dir, steps, skeleton };
  });
}

export const allSteps = () => parts().flatMap((p) => p.steps);

export function findStep(name: string): Step | undefined {
  return allSteps().find((s) => s.name === name);
}
