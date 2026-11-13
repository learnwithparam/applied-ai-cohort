import type { Rule } from "../scripts/verify";
import { hasVerb, type IntakeRun, runVerb, worldEnv } from "./lib/contract";
import { score, startWorld } from "./lib/world";
import pickAnElective from "./pick-an-elective";

type Split = "dev" | "test";

// One run of a verb on a fresh world, scored against the desk's records.
async function oneRun(folder: string, verb: string, split: Split): Promise<IntakeRun> {
  const world = await startWorld(split);
  try {
    const run = runVerb(folder, verb, { env: worldEnv(world) });
    return { run, score: score(world, split) };
  } finally {
    world.stop();
  }
}

async function threeRuns(folder: string, verb: string, split: Split): Promise<IntakeRun[]> {
  const runs: IntakeRun[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    runs.push(await oneRun(folder, verb, split));
  }
  return runs;
}

// Runs a verb, such as "intake" or "elective", on three fresh worlds. Results are kept per
// folder, so every rule in this part reads the same runs.
const savedRuns = new Map<string, Promise<IntakeRun[]>>();

export function verbRuns(folder: string, verb: string, split: Split = "dev") {
  const key = `${folder}|${verb}|${split}`;
  let runs = savedRuns.get(key);
  if (!runs) {
    runs = threeRuns(folder, verb, split);
    savedRuns.set(key, runs);
  }
  return runs;
}

async function everyElectiveRun(folder: string, passes: (run: IntakeRun) => boolean) {
  const runs = await verbRuns(folder, "elective");
  return runs.every(passes);
}

async function planStillPasses(folder: string): Promise<boolean> {
  const results = await Promise.all(pickAnElective.map((rule) => rule.test(folder)));
  return results.every(Boolean);
}

export default [
  {
    says: "contract.toml names an elective verb, and still names intake",
    test: (folder) => hasVerb(folder, "elective") && hasVerb(folder, "intake"),
    tryNext: 'add elective = "uv run python elective.py" under [verbs] and keep the intake line',
  },
  {
    says: "elective.md still passes every pick-an-elective rule",
    test: planStillPasses,
    tryNext:
      "copy your elective.md from pick-an-elective, then run bun run verify pick-an-elective",
  },
  {
    says: "the elective verb runs on the dev inbox with no crash, over 3 fresh runs",
    test: (folder) => everyElectiveRun(folder, (elective) => elective.run.code === 0),
    tryNext: "run uv run python elective.py with the world serving and read the error it prints",
  },
  {
    says: "the elective books or sends every email to a person, once",
    test: (folder) =>
      everyElectiveRun(folder, (elective) => {
        const handledOnce = elective.score.lost === 0 && elective.score.handledTwice === 0;
        return elective.score.booked > 0 && handledOnce;
      }),
    tryNext:
      "an email a rule settles must still go to client.send_to_review, or the desk never sees it",
  },
  {
    says: "the elective books zero jobs wrong and zero jobs off label",
    test: (folder) =>
      everyElectiveRun(folder, (elective) => {
        const score = elective.score;
        return score.bookedWrong === 0 && score.bookedOffLabel === 0;
      }),
    tryNext: "send every request through the same label and field rules that intake.py uses",
  },
] satisfies Rule[];
