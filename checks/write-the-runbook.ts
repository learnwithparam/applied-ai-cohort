import type { Rule } from "../scripts/verify";
import { sections, written } from "./lib/markdown";
import { devEmails } from "./lib/world";

const SECTIONS = [
  "how to roll back",
  "budget limit",
  "where traces are",
  "who signs off",
  "known failure modes",
];

const runbook = (folder: string) => sections(folder, "RUNBOOK.md");
const section = (folder: string, name: string) => runbook(folder)[name] ?? "";
const devIds = new Set(devEmails().map((email) => email.email_id));

// Different real dev emails named by bullet lines, such as "- TB-1026: the field name is vague".
// Three bullets about the same email count as one failure.
function failureModesWithEvidence(folder: string): number {
  const bullets = section(folder, "known failure modes")
    .split("\n")
    .filter((line) => line.trim().startsWith("- "));
  const emailIds = bullets.map((line) => line.match(/TB-\d{4}/)?.[0] ?? "");
  return new Set(emailIds.filter((emailId) => devIds.has(emailId))).size;
}

export default [
  {
    says: "RUNBOOK.md has all five sections, each written in your own words",
    test: (folder) => SECTIONS.every((name) => written(section(folder, name), 15)),
    tryNext:
      "write 15 or more words under each heading: How to roll back, Budget limit, " +
      "Where traces are, Who signs off, Known failure modes",
  },
  {
    says: "How to roll back gives the git command to run",
    test: (folder) => /`git [^`]+`/.test(section(folder, "how to roll back")),
    tryNext: "write the command in backticks, such as `git revert -m 1 <merge commit>`",
  },
  {
    says: "Budget limit gives the limit in dollars and the setting that holds it",
    test: (folder) => {
      const budget = section(folder, "budget limit");
      return /\$\d/.test(budget) && budget.includes("SPEND_LIMIT_USD");
    },
    tryNext: "name SPEND_LIMIT_USD and its value, such as $0.05",
  },
  {
    says: "Where traces are names TRACES_URL, and how to find one run",
    test: (folder) => {
      const traces = section(folder, "where traces are");
      return traces.includes("TRACES_URL") && traces.includes("run_id");
    },
    tryNext: "say that each run's run_id is its trace id in the store at TRACES_URL",
  },
  {
    says: "Known failure modes lists 3 or more failures, each with a dev email that shows it",
    test: (folder) => failureModesWithEvidence(folder) >= 3,
    tryNext: "write one bullet per failure, each with its own email id, such as - TB-1026: ...",
  },
] satisfies Rule[];
