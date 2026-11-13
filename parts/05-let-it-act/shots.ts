// bun parts/05-let-it-act/shots.ts: captures the pictures this part's steps show.
// Set CHROMIUM_PATH to use a Chromium that is already installed instead of Playwright's own.
// Terminal output is rendered as HTML in a dark terminal style about 800 pixels wide.
// The jobs board is a real page, served by the world after the sample agent ran.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { worldEnv } from "../../checks/lib/contract";
import { PYTHON, REPLAY_ENV, startWorld } from "../../checks/lib/world";
import { ROOT } from "../../scripts/structure";
import { devTasks, runVerbAsync, startApprovalDesk } from "./agent-checks";

const PART = join(ROOT, "parts", "05-let-it-act");

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TERMINAL_STYLE = `
  body{margin:0;background:#FAFAFA;padding:16px}
  .window{width:800px;background:#1F1F1C;color:#FAFAFA;border-radius:8px;padding:16px 18px;
    box-sizing:border-box}
  .prompt{color:#FAFF69;font:13px/1.5 ui-monospace,Menlo,monospace;margin-top:6px}
  pre{margin:4px 0 10px;font:13px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;
    word-break:break-word}
`;

function terminal(command: string, output: string): string {
  const prompt = `<div class="prompt">$ ${escapeHtml(command)}</div>`;
  const printed = `<pre>${escapeHtml(output.trimEnd())}</pre>`;
  const head = `<head><meta charset="utf-8"><style>${TERMINAL_STYLE}</style></head>`;
  const body = `<body><div class="window">${prompt}${printed}</div></body>`;
  return `<!doctype html><html>${head}${body}</html>`;
}

function run(command: string, folder: string, extra: Record<string, string> = {}): string {
  const env = { ...process.env, ...REPLAY_ENV, ...extra };
  const result = spawnSync("sh", ["-c", command], { cwd: folder, env, encoding: "utf8" });
  return (result.stdout ?? "") + (result.stderr ?? "");
}

const pictureFor = (step: string) => {
  const folder = join(PART, step, "images");
  mkdirSync(folder, { recursive: true });
  return join(folder, "expected.png");
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 840, height: 400 }, deviceScaleFactor: 2 });

async function shootTerminal(step: string, command: string, output: string) {
  await page.setContent(terminal(command, output));
  await page.locator(".window").screenshot({ path: pictureFor(step) });
}

// 1. The tool list, as an MCP client sees it: one line per tool and its first sentence.
const listRequest = `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
const toolsFolder = join(PART, "01-write-the-tools", "solution");
const listed = JSON.parse(run(`${listRequest} | ${PYTHON} server.py`, toolsFolder));
const toolLines = listed.result.tools.map((tool: { name: string; description: string }) => {
  const firstSentence = tool.description.split(". ")[0];
  return `${tool.name.padEnd(15)} ${firstSentence}.`;
});
await shootTerminal("01-write-the-tools", "MCP tools/list", toolLines.join("\n"));

// 2. The jobs board after the sample agent worked on every dev email, with the approval desk.
const gradeFolder = join(PART, "04-grade-the-end-state", "solution");
const world = await startWorld("dev");
const desk = startApprovalDesk();
// biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
const env = { ...worldEnv(world), APPROVALS_URL: desk.url };
for (const task of devTasks()) await runVerbAsync(gradeFolder, "act", task, env);
await page.setViewportSize({ width: 1200, height: 900 });
await page.goto(world.url);
await page.screenshot({ path: pictureFor("04-grade-the-end-state"), fullPage: true });
desk.stop();
world.stop();

// 3. The paths eval after the agent ran the golden tasks.
await page.setViewportSize({ width: 840, height: 400 });
const pathsFolder = join(PART, "07-test-the-path", "solution");
const pathsWorld = await startWorld("dev");
const pathsDesk = startApprovalDesk();
// biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
const pathsEnv = { ...worldEnv(pathsWorld), APPROVALS_URL: pathsDesk.url };
const goldenIds = [
  "TB-1001",
  "TB-1010",
  "TB-1008",
  "TB-1024",
  "TB-1004",
  "TB-1007",
  "TB-1006",
  "TB-1026",
];
const goldenTasks = devTasks().filter((task) => goldenIds.includes(task.email_id));
for (const task of goldenTasks) await runVerbAsync(pathsFolder, "act", task, pathsEnv);
const pathsRun = await runVerbAsync(pathsFolder, "paths", undefined, pathsEnv);
const pathsReport = JSON.stringify(JSON.parse(pathsRun.stdout), null, 2);
await shootTerminal(
  "07-test-the-path",
  "uv run python paths.py",
  `${pathsReport}\nexit code ${pathsRun.code}`,
);
pathsDesk.stop();
pathsWorld.stop();

// 4. The milestone check on the sample solution.
const proveOutput = run("bun run verify prove-the-agent solution", ROOT);
await shootTerminal("08-prove-the-agent", "bun run verify prove-the-agent solution", proveOutput);

await browser.close();
console.log("Wrote the let-it-act pictures.");
