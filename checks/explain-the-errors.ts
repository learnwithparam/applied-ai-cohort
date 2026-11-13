import { mcpSession, type ToolAnswer } from "../parts/05-let-it-act/agent-checks";
import type { Rule } from "../scripts/verify";
import { startWorld } from "./lib/world";

// A book_job call. The keys stay in snake_case because the learner's Python reads them.
function booking(emailId: string, fieldId: string, productCode: string, rate?: number) {
  const pairs: [string, unknown][] = [
    ["email_id", emailId],
    ["field_id", fieldId],
    ["product_code", productCode],
  ];
  if (rate !== undefined) pairs.push(["rate_l_per_ha", rate]);
  return { name: "book_job", arguments: Object.fromEntries(pairs) };
}

// Bad calls an agent really makes, and a good one to prove the tools still work.
const CALLS = [
  { name: "find_product", arguments: { name: "Podshild" } },
  { name: "find_grower", arguments: { email: "someone@nowhere.example" } },
  booking("TB-1001", "F14", "P150"),
  booking("TB-1001", "F99", "P150", 0.38),
  booking("TB-1004", "F12", "P130", 2.4),
  booking("TB-1006", "F03", "P100", 0.97),
  booking("TB-1026", "F05", "P140", 0.6),
  { name: "find_product", arguments: { name: "Podshield" } },
];
const BAD_CALLS = CALLS.length - 1;

type Answers = { answers: (ToolAnswer | undefined)[]; alive: boolean; jobsBooked: number };
const savedAnswers = new Map<string, Promise<Answers>>();

// Sends every call to the learner's server on a fresh world, then counts the jobs booked.
function answersFor(folder: string): Promise<Answers> {
  let found = savedAnswers.get(folder);
  if (!found) {
    found = (async () => {
      const world = await startWorld("dev");
      try {
        const session = mcpSession(folder, world, CALLS);
        const jobs = (await (await fetch(`${world.url}/api/jobs`)).json()) as unknown[];
        return { answers: session.answers, alive: session.alive, jobsBooked: jobs.length };
      } finally {
        world.stop();
      }
    })();
    savedAnswers.set(folder, found);
  }
  return found;
}

async function answer(folder: string, index: number): Promise<string> {
  return (await answersFor(folder)).answers[index]?.text ?? "";
}

async function badAnswers(folder: string): Promise<(ToolAnswer | undefined)[]> {
  return (await answersFor(folder)).answers.slice(0, BAD_CALLS);
}

function mentionsAll(text: string, words: string[]): boolean {
  const lowerText = text.toLowerCase();
  return words.every((word) => lowerText.includes(word.toLowerCase()));
}

export default [
  {
    says: "every bad call comes back as a result marked isError, and the server keeps answering",
    test: async (folder) => {
      const found = await answersFor(folder);
      const marked = (await badAnswers(folder)).every((item) => item?.isError === true);
      return marked && found.alive;
    },
    tryNext: "catch each problem in call_tool and return (sentence, True) instead of raising",
  },
  {
    says: "no error shows a stack trace or a bare exception name",
    test: async (folder) =>
      (await badAnswers(folder)).every((item) => {
        const text = item?.text ?? "";
        const words = text.split(/\s+/).filter(Boolean).length;
        return !/Traceback|File "|StopIteration|KeyError/.test(text) && words >= 6;
      }),
    tryNext: "write each error as a sentence a new colleague could act on, not Python's own words",
  },
  {
    says: "an unknown product's error lists the products the co-op sells",
    test: async (folder) => mentionsAll(await answer(folder, 0), ["Podshield", "Pulsepath"]),
    tryNext: 'when find_product finds nothing, name every product: "It sells: Glyfallow 540, ..."',
  },
  {
    says: "an unknown sender's error and a missing argument's error each say what to do next",
    test: async (folder) => {
      const unknownSender = mentionsAll(await answer(folder, 1), ["review"]);
      const missingArgument = mentionsAll(await answer(folder, 2), ["rate_l_per_ha"]);
      return unknownSender && missingArgument;
    },
    tryNext: "say to send an unknown sender to review, and name the argument that is missing",
  },
  {
    says: "an unknown field's error names the tool that finds the right field_id",
    test: async (folder) => mentionsAll(await answer(folder, 3), ["find_grower"]),
    tryNext: 'add the next move to the error: "Call find_grower to see the fields of the sender."',
  },
  {
    says: "book_job refuses a rate above the label, gives the label rate and says to use review",
    test: async (folder) => mentionsAll(await answer(folder, 4), ["1.2", "review"]),
    tryNext: "compare the rate with max_rate_l_per_ha before booking, as intake.py did in part one",
  },
  {
    says: "book_job refuses a rate per acre and a field the email does not name, saying why",
    test: async (folder) => {
      const acre = mentionsAll(await answer(folder, 5), ["acre", "review"]);
      const vagueField = mentionsAll(await answer(folder, 6), ["field", "review"]);
      return acre && vagueField;
    },
    tryNext: "book_job can read the email by its email_id: check it for acres and the field's name",
  },
  {
    says: "no refused call booked a job, and a good call still works",
    test: async (folder) => {
      const found = await answersFor(folder);
      const good = found.answers[BAD_CALLS];
      return found.jobsBooked === 0 && good?.isError === false && good.text.includes("P150");
    },
    tryNext: "make every check in book_job run before client.book_job, never after it",
  },
] satisfies Rule[];
