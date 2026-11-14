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
function partFolders(root: string): PartFolder[] {
  const folders: PartFolder[] = [];
  const orientation = join(root, "00-orientation");
  if (existsSync(orientation)) folders.push({ name: "orientation", dir: orientation });
  const partsFolder = join(root, "parts");
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

export function parts(root: string = ROOT): Part[] {
  return partFolders(root).map((partFolder) => {
    const stepNames = orderedSubfolders(partFolder.dir);
    const steps = stepNames.map((stepName) => loadStep(partFolder, stepName));
    const skeleton = isSkeleton(partFolder, steps);
    return { name: partFolder.name, dir: partFolder.dir, steps, skeleton };
  });
}

export const allSteps = (root: string = ROOT) => parts(root).flatMap((part) => part.steps);

export function findStep(name: string, root: string = ROOT): Step | undefined {
  return allSteps(root).find((step) => step.name === name);
}

export const STEP_SECTIONS = [
  "The problem",
  "Watch it done",
  "Your turn",
  "Do it on your work",
  "Done when",
  "Solution",
];
export const PART_SECTIONS = [
  "After this part you can",
  "You leave with",
  "The problem",
  "Watch and read",
  "Project",
];
export const MAX_PROBLEM_WORDS = 60;
export const MAX_EXAMPLE_FILES = 2;
export const EXAMPLE_TOO_BIG =
  "the example needs more than two world files: shrink it or move the rest to Go further";

const headingLine = (name: string) => new RegExp(`^## ${name}[ \\t]*$`, "m");

function sectionBody(text: string, name: string): string | undefined {
  const start = text.search(headingLine(name));
  if (start < 0) return undefined;
  const fromHeading = text.slice(start);
  const body = fromHeading.slice(fromHeading.indexOf("\n") + 1);
  return body.split(/^## /m)[0];
}

// Code does not count: a learner reads the sentences, and the how can have long commands.
export function wordsOutsideCode(text: string): number {
  const prose = text.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ");
  return prose.split(/\s+/).filter(Boolean).length;
}

function sectionsInOrder(text: string, names: string[]): string[] {
  const problems: string[] = [];
  let lastPosition = -1;
  for (const name of names) {
    const position = text.search(headingLine(name));
    if (position < 0) problems.push(`missing section "## ${name}"`);
    else if (position < lastPosition) problems.push(`section "## ${name}" is out of order`);
    else lastPosition = position;
  }
  return problems;
}

export function stepShapeProblems(text: string): string[] {
  const problems = sectionsInOrder(text, STEP_SECTIONS);
  const problem = sectionBody(text, "The problem");
  if (problem !== undefined && wordsOutsideCode(problem) > MAX_PROBLEM_WORDS) {
    const count = wordsOutsideCode(problem);
    problems.push(
      `the problem section has ${count} words; keep it to ${MAX_PROBLEM_WORDS} or fewer`,
    );
  }
  return problems;
}

export function partShapeProblems(text: string): string[] {
  const problems = sectionsInOrder(text, PART_SECTIONS);
  if (!/^\|\s*Step\s*\|.*\n\|[\s:|-]+\|/im.test(text)) {
    problems.push(`missing the steps table: a table whose first column is "Step"`);
  }
  return problems;
}

export function exampleFilesProblems(files: string[]): string[] {
  return files.length > MAX_EXAMPLE_FILES ? [EXAMPLE_TOO_BIG] : [];
}
