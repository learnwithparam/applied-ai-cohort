// Reads the repo layout once. Every other script asks this file where things are.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

type StepSettings = { minutes?: number; screen?: boolean; solution?: boolean };
type PartFolder = { name: string; dir: string };

// Part and step folders carry an order prefix ("01-").
// Other folders, such as images/, are not steps.
function orderedSubfolders(folder: string): string[] {
  if (!existsSync(folder)) return [];
  const entries = readdirSync(folder);
  const ordered = entries.filter((entry) => /^\d+-/.test(entry));
  const folders = ordered.filter((entry) => statSync(join(folder, entry)).isDirectory());
  return folders.sort();
}

// Folders keep an order prefix for sorting only. Learners never type it.
export const bareName = (folder: string) => folder.replace(/^\d+-/, "");

function readSettings(stepFolder: string): StepSettings {
  const settingsPath = join(stepFolder, "step.toml");
  if (!existsSync(settingsPath)) return {};
  return Bun.TOML.parse(readFileSync(settingsPath, "utf8")) as StepSettings;
}

function loadStep(partFolder: PartFolder, stepName: string): Step {
  const stepFolder = join(partFolder.dir, stepName);
  const settings = readSettings(stepFolder);
  return {
    name: bareName(stepName),
    dir: stepFolder,
    part: partFolder.name,
    meta: {
      minutes: Number(settings.minutes ?? 0),
      screen: Boolean(settings.screen),
      solution: Boolean(settings.solution),
    },
  };
}

// The orientation is the first part: it has a checked step like any other.
function partFolders(): PartFolder[] {
  const folders: PartFolder[] = [];
  const orientation = join(ROOT, "00-orientation");
  if (existsSync(orientation)) folders.push({ name: "orientation", dir: orientation });
  const partsFolder = join(ROOT, "parts");
  for (const partName of orderedSubfolders(partsFolder)) {
    folders.push({ name: bareName(partName), dir: join(partsFolder, partName) });
  }
  return folders;
}

function isSkeleton(partFolder: PartFolder, steps: Step[]): boolean {
  const readme = join(partFolder.dir, "README.md");
  if (steps.length > 0 || !existsSync(readme)) return false;
  return readFileSync(readme, "utf8").includes("TODO(part session)");
}

export function parts(): Part[] {
  return partFolders().map((partFolder) => {
    const stepNames = orderedSubfolders(partFolder.dir);
    const steps = stepNames.map((stepName) => loadStep(partFolder, stepName));
    const skeleton = isSkeleton(partFolder, steps);
    return { name: partFolder.name, dir: partFolder.dir, steps, skeleton };
  });
}

export const allSteps = () => parts().flatMap((part) => part.steps);

export function findStep(name: string): Step | undefined {
  return allSteps().find((step) => step.name === name);
}
