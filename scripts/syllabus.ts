// Writes syllabus.json for proengineers.club: a module per part, a unit per step, one lab each.
// `bun scripts/syllabus.ts` writes it. `--check` fails when the file is stale or a key is unstable.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parts, ROOT } from "./structure";

// The club's stable key (app/syllabus.mjs validate): a-z, 0-9, . _ - and at most 64 characters.
const STABLE_KEY = /^[a-z0-9][a-z0-9._-]{0,63}$/;

type Item = {
  key: string;
  kind: "lab";
  title: string;
  minutes: number;
  // biome-ignore lint/style/useNamingConvention: the club schema field.
  lab: { slug: string; repo_path: string };
};
type Unit = { key: string; title: string; items: Item[] };
type Module = { key: string; title: string; units: Unit[] };

function heading(files: string[], fallback: string): string {
  for (const file of files) {
    const title = existsSync(file) ? /^# (.+)$/m.exec(readFileSync(file, "utf8"))?.[1] : undefined;
    if (title) return title.trim();
  }
  return fallback;
}

export function syllabus(root: string = ROOT): { modules: Module[] } {
  const modules = parts(root).map((part) => ({
    key: part.name,
    title: heading([join(part.dir, "README.md")], part.name.replaceAll("-", " ")),
    units: part.steps.map((step) => {
      const title = heading(
        [join(step.dir, "problem", "README.md"), join(step.dir, "README.md")],
        step.name,
      );
      // The part prefix keeps keys unique tree-wide: a one-step part shares its name with its step.
      const unitKey = `${part.name}.${step.name}`;
      // biome-ignore lint/style/useNamingConvention: the club schema field.
      const lab = { slug: step.name, repo_path: relative(root, step.dir) };
      return {
        key: unitKey,
        title,
        items: [
          { key: `${unitKey}.lab`, kind: "lab" as const, title, minutes: step.meta.minutes, lab },
        ],
      };
    }),
  }));
  return { modules: modules.filter((module) => module.units.length) };
}

export function syllabusProblems(tree: { modules: Module[] }): string[] {
  const keys = tree.modules.flatMap((module) => [
    module.key,
    ...module.units.flatMap((unit) => [unit.key, ...unit.items.map((item) => item.key)]),
  ]);
  const bad = keys
    .filter((key) => !STABLE_KEY.test(key))
    .map((key) => `syllabus.json: "${key}" is not a stable key`);
  const twice = [...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))];
  return [...bad, ...twice.map((key) => `syllabus.json: key "${key}" is used twice`)];
}

const text = (root: string) => `${JSON.stringify(syllabus(root), null, 2)}\n`;

if (import.meta.main) {
  const file = join(ROOT, "syllabus.json");
  const problems = syllabusProblems(syllabus());
  if (process.argv.includes("--check")) {
    if (!existsSync(file) || readFileSync(file, "utf8") !== text(ROOT))
      problems.push("syllabus.json is stale; run `bun scripts/syllabus.ts`");
    for (const problem of problems) console.log(problem);
    console.log(`syllabus: ${problems.length} problem(s)`);
    process.exit(problems.length ? 1 : 0);
  }
  if (problems.length) {
    console.log(problems.join("\n"));
    process.exit(1);
  }
  writeFileSync(file, text(ROOT));
}
