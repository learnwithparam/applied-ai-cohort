// bun parts/04-decide-and-wait/images/shoot.ts: captures this part's pictures
// from real output. Terminal output is rendered as HTML in a dark terminal style.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { PYTHON, REPLAY_ENV } from "../../../checks/lib/world";
import { ROOT } from "../../../scripts/structure";

const PART = join(ROOT, "parts", "04-decide-and-wait");

type TerminalBlock = { command: string; output: string };

const TERMINAL_STYLE = `
    body{margin:0;background:#FAFAFA;padding:16px}
    .window{width:800px;background:#1F1F1C;color:#FAFAFA;border-radius:8px;
      padding:16px 18px;box-sizing:border-box}
    .prompt{color:#FAFF69;font:13px/1.5 ui-monospace,Menlo,monospace;margin-top:6px}
    pre{margin:4px 0 10px;font:13px/1.5 ui-monospace,Menlo,monospace;
      white-space:pre-wrap;word-break:break-word}
  `;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function terminal(blocks: TerminalBlock[]): string {
  const body = blocks
    .map((block) => {
      const prompt = `<div class="prompt">$ ${escapeHtml(block.command)}</div>`;
      return `${prompt}<pre>${escapeHtml(block.output.trimEnd())}</pre>`;
    })
    .join("");
  const head = `<head><meta charset="utf-8"><style>${TERMINAL_STYLE}</style></head>`;
  return `<!doctype html><html>${head}<body><div class="window">${body}</div></body></html>`;
}

// Runs a command in a scratch copy of a step folder, so the real folder never changes.
function runInCopy(folder: string, command: string, input = ""): string {
  const copy = mkdtempSync(join(dirname(folder), ".shots-"));
  const runsDir = "runs";
  try {
    cpSync(folder, copy, { recursive: true });
    // biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
    const env = { ...process.env, ...REPLAY_ENV, RUNS_DIR: runsDir, INDEX_DIR: "index" };
    const options = { cwd: copy, env, input, encoding: "utf8" } as const;
    const result = spawnSync("sh", ["-c", command.replaceAll("uv run python", PYTHON)], options);
    return (result.stdout ?? "") + (result.stderr ?? "");
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}

// Set CHROMIUM_PATH to use a Chromium that is already installed instead of Playwright's own.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 840, height: 400 }, deviceScaleFactor: 2 });

async function shoot(blocks: TerminalBlock[], step: string) {
  await page.setContent(terminal(blocks));
  const path = join(PART, step, "images", "expected.png");
  await page.locator(".window").screenshot({ path });
}

const thresholdCommand = "uv run python threshold.py";
const curve = runInCopy(join(PART, "02-send-unsure-to-a-person", "solution"), thresholdCommand);
await shoot([{ command: thresholdCommand, output: curve }], "02-send-unsure-to-a-person");

const verify = spawnSync("bun", ["scripts/verify.ts", "prove-the-routing", "solution"], {
  cwd: ROOT,
  encoding: "utf8",
});
const proof = (verify.stdout ?? "").replace("(sample solution)", "(your work)");
await shoot(
  [{ command: "bun run verify prove-the-routing", output: proof }],
  "07-prove-the-routing",
);

await browser.close();
