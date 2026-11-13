import type { Rule } from "../scripts/verify";
import { sections, written } from "./lib/markdown";

// Each elective and the live-labs lab folders that teach it.
export const ELECTIVE_LABS: Record<string, string[]> = {
  "route-to-cheaper-models": ["26-llm-gateway"],
  "run-it-overnight": ["03-batch-prompts"],
  "remember-the-grower": ["14-agent-memory"],
  "tune-a-small-model": ["34-fine-tune"],
  "split-the-research": ["15-research-subagents"],
  "read-the-photos": ["18-vision-damage"],
  "add-a-voice-line": ["16-voice-pipecat", "17-voice-phone"],
};

// The numbers the spray desk's scorecard can measure, and the direction that counts as better.
export const METRICS: Record<string, "at most" | "at least"> = {
  "cost per correct booking": "at most",
  "total cost": "at most",
  "model calls": "at most",
  "share booked correctly": "at least",
};

export type Target = { direction: "at most" | "at least"; amount: number };

export const electivePlan = (folder: string) => sections(folder, "elective.md");

// The first number in a piece of text. "65%" gives 0.65, and "$0.000022" gives 0.000022.
export function firstAmount(text: string | undefined): number | undefined {
  const match = (text ?? "").match(/(\d+(?:\.\d+)?(?:e-?\d+)?)(\s*%)?/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (match[2]) return amount / 100;
  return amount;
}

function namedElective(folder: string): string | undefined {
  const text = electivePlan(folder).elective ?? "";
  const names = Object.keys(ELECTIVE_LABS);
  const found = names.filter((name) => text.includes(name));
  if (found.length !== 1) return undefined;
  return found[0];
}

export function namedMetric(folder: string): string | undefined {
  const text = (electivePlan(folder).metric ?? "").toLowerCase();
  const names = Object.keys(METRICS);
  const found = names.filter((name) => text.includes(name));
  if (found.length !== 1) return undefined;
  return found[0];
}

export function target(folder: string): Target | undefined {
  const text = (electivePlan(folder).target ?? "").toLowerCase();
  const direction = text.match(/\b(at most|at least)\b/)?.[1] as Target["direction"] | undefined;
  const amount = firstAmount(text);
  if (!direction || amount === undefined) return undefined;
  return { direction, amount };
}

function labMatchesElective(folder: string): boolean {
  const elective = namedElective(folder);
  if (!elective) return false;
  const lab = electivePlan(folder).lab ?? "";
  return ELECTIVE_LABS[elective].some((labFolder) => lab.includes(labFolder));
}

function targetPointsTheRightWay(folder: string): boolean {
  const metric = namedMetric(folder);
  const chosenTarget = target(folder);
  if (!metric || !chosenTarget) return false;
  return METRICS[metric] === chosenTarget.direction;
}

export default [
  {
    says: "elective.md has the sections Elective, Lab, Metric, Target and Why, each written",
    test: (folder) => {
      const plan = electivePlan(folder);
      const names = ["elective", "lab", "metric", "target", "why"];
      return names.every((name) => written(plan[name], 1));
    },
    tryNext: "replace every TODO in elective.md with your own words",
  },
  {
    says: "the Elective names exactly one elective from the menu",
    test: (folder) => namedElective(folder) !== undefined,
    tryNext: "copy one name from the menu in the step README, such as route-to-cheaper-models",
  },
  {
    says: "the Lab is the live-labs lab for that elective",
    test: labMatchesElective,
    tryNext: "copy the lab path from the menu row of your elective, such as labs/26-llm-gateway",
  },
  {
    says: "the Metric is one number the scorecard measures",
    test: (folder) => namedMetric(folder) !== undefined,
    tryNext:
      "pick one: cost per correct booking, total cost, model calls or share booked correctly",
  },
  {
    says: "the Target has a direction and a number, and the direction means better",
    test: targetPointsTheRightWay,
    tryNext:
      'write "at most" and a number for a cost or a count, "at least" and a number for a share',
  },
] satisfies Rule[];
