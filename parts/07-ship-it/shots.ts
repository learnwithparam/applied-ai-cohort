// bun parts/07-ship-it/shots.ts: captures the pictures this part's steps show.
// Set CHROMIUM_PATH to use a Chromium that is already installed instead of Playwright's own.
// Terminal output is rendered as HTML in a dark terminal style about 800 pixels wide.
// Each picture is the real output of the sample solution.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { PYTHON, REPLAY_ENV } from "../../checks/lib/world";
import { ROOT } from "../../scripts/structure";

const PART = join(ROOT, "parts", "07-ship-it");

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

// Runs a command in a scratch copy of a solution folder, so nothing is written into the repo.
function runInCopy(step: string, command: string): string {
  const scratch = mkdtempSync(join(tmpdir(), "ship-it-shot-"));
  cpSync(join(PART, step, "solution"), scratch, { recursive: true });
  const printed = run(command, scratch);
  const scorecard = join(scratch, "SCORECARD.md");
  const output = command.includes("scorecard") ? readFileSync(scorecard, "utf8") : printed;
  rmSync(scratch, { recursive: true, force: true });
  return output;
}

// 1. The release gate on the planted change: the prompt line is gone and the gate says no.
const trim = "sed -i '/follow its advice/d' prompt.md";
const gateOutput = runInCopy("03-gate-the-release", `${trim} && ${PYTHON} gate.py; echo "exit $?"`);
await shootTerminal(
  "03-gate-the-release",
  "uv run python gate.py   # on the planted change",
  gateOutput,
);

// 2. The scorecard the sample solution writes.
const scorecard = runInCopy("05-show-the-scorecard", `${PYTHON} scorecard.py`);
await shootTerminal(
  "05-show-the-scorecard",
  "uv run python scorecard.py && cat SCORECARD.md",
  scorecard,
);

// 3. The milestone check on the sample solution.
const proveCommand = "bun run verify prove-the-release solution";
await shootTerminal("06-prove-the-release", proveCommand, run(proveCommand, ROOT));

await browser.close();
console.log("Wrote the ship-it pictures.");
