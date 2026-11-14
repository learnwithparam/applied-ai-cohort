// bun capstone/check.ts <folder>: judges the learner's own folder, never the course world.
import { resolve } from "node:path";
import rules from "../checks/prove-it-on-your-work";

const folder = resolve(process.argv[2] ?? ".");
const failed = rules.filter((rule) => !rule.test(folder));
for (const rule of failed) console.log(`Not yet: ${rule.says}. Try: ${rule.tryNext}`);
if (failed.length > 0) process.exit(1);
console.log("Your capstone folder has the shape and the evidence.");
