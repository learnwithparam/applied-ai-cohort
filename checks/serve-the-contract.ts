import {
  devTasks,
  postRun,
  type ServedRun,
  startService,
  writesFor,
} from "../parts/07-ship-it/agent-checks";
import type { Rule } from "../scripts/verify";
import { hasVerb } from "./lib/contract";

export const TOKEN = "check-token";
const CALLS = 20;
const SLOWEST_FIRST_EVENT_MS = 5000;

type Session = { runs: ServedRun[]; writes: number[] };

// Twenty calls, one per dev email, to a fresh service. Then how many writes each email got.
async function oneSession(folder: string): Promise<Session> {
  // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
  const service = await startService(folder, { PROJECT_API_TOKEN: TOKEN });
  try {
    const tasks = devTasks().slice(0, CALLS);
    const runs: ServedRun[] = [];
    for (const task of tasks) runs.push(await postRun(service, task, TOKEN));
    const writes: number[] = [];
    for (const task of tasks) writes.push(await writesFor(service, task.email_id));
    return { runs, writes };
  } finally {
    service.stop();
  }
}

const saved = new Map<string, Promise<Session[]>>();

// Three fresh sessions, kept per folder so every rule reads the same calls.
export function sessions(folder: string): Promise<Session[]> {
  let found = saved.get(folder);
  if (!found) {
    found = (async () => {
      const all: Session[] = [];
      for (let attempt = 0; attempt < 3; attempt++) all.push(await oneSession(folder));
      return all;
    })();
    saved.set(folder, found);
  }
  return found;
}

async function everySession(folder: string, passes: (session: Session) => boolean) {
  const all = await sessions(folder);
  return all.every(passes);
}

const isStream = (run: ServedRun) =>
  run.status === 200 && run.contentType.includes("text/event-stream");

function endsWithDone(run: ServedRun): boolean {
  const last = run.events[run.events.length - 1];
  const steps = run.events.filter((event) => event.name === "step").length;
  const summary = last?.data ?? {};
  const named = typeof summary.run_id === "string" && typeof summary.stop_reason === "string";
  return steps > 0 && last?.name === "done" && named;
}

// The 95th percentile: 19 of 20 first events arrived at least this fast.
export function slowestTypical(times: number[]): number {
  const sorted = [...times].sort((first, second) => first - second);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
}

export default [
  {
    says: "contract.toml names a serve verb",
    test: (folder) => hasVerb(folder, "serve"),
    tryNext: 'add serve = "uv run python serve.py" under [verbs] in contract.toml',
  },
  {
    says: `${CALLS} calls to POST /v1/runs each answer 200 with a text/event-stream`,
    test: (folder) => everySession(folder, (session) => session.runs.every(isStream)),
    tryNext: "send Content-Type: text/event-stream, and write each event as it happens",
  },
  {
    says: "each stream has step events, then a last done event with run_id and stop_reason",
    test: (folder) => everySession(folder, (session) => session.runs.every(endsWithDone)),
    tryNext: 'pass on_step to agent.act, then send one "done" event with the summary',
  },
  {
    says: "the world holds each of the 20 emails once: booked or with a person",
    test: (folder) =>
      everySession(folder, (session) => session.writes.every((count) => count === 1)),
    tryNext: "run the agent once per request, on the input the client sent",
  },
  {
    says: `the 95th percentile time to the first event is under ${SLOWEST_FIRST_EVENT_MS} ms`,
    test: (folder) =>
      everySession(folder, (session) => {
        const times = session.runs.map((run) => run.firstEventMs);
        return slowestTypical(times) < SLOWEST_FIRST_EVENT_MS;
      }),
    tryNext: "flush each event as soon as it is written; never wait for the whole run",
  },
] satisfies Rule[];
