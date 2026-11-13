// bun parts/08-add-one-capability/images/shoot.ts: captures this part's picture from real output.
// It runs intake, then the elective, each on a fresh world, and prints cost.py after each run.
// The terminal is drawn as HTML in a dark style about 800 pixels wide.

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { chromium } from "playwright";
import { worldEnv } from "../../../checks/lib/contract";
import { PYTHON, REPLAY_ENV, startWorld } from "../../../checks/lib/world";

const STEP = join(import.meta.dir, "..", "03-measure-the-elective");
const SOLUTION = join(STEP, "solution");

async function runOnFreshWorld(verb: string): Promise<string> {
  const world = await startWorld("dev");
  const env = { ...process.env, ...REPLAY_ENV, ...worldEnv(world) };
  const options = { cwd: SOLUTION, env, encoding: "utf8" } as const;
  try {
    const counts = spawnSync(PYTHON, [`${verb}.py`], options).stdout;
    const costs = spawnSync(PYTHON, ["cost.py"], options).stdout;
    return counts + costs;
  } finally {
    world.stop();
  }
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const STYLE = `
  body{margin:0;background:#FAFAFA;padding:16px}
  .window{width:800px;background:#1F1F1C;color:#FAFAFA;border-radius:8px;
    padding:16px 18px;box-sizing:border-box}
  .prompt{color:#FAFF69;font:13px/1.5 ui-monospace,Menlo,monospace;margin-top:6px}
  pre{margin:4px 0 10px;font:13px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap}
`;

function block(command: string, output: string): string {
  const prompt = `<div class="prompt">$ ${escapeHtml(command)}</div>`;
  return `${prompt}<pre>${escapeHtml(output.trimEnd())}</pre>`;
}

const reset = "uv run world reset && rm -rf runs";
const before = await runOnFreshWorld("intake");
const after = await runOnFreshWorld("elective");
const body =
  block(`${reset} && uv run python intake.py && uv run python cost.py    # before`, before) +
  block(`${reset} && uv run python elective.py && uv run python cost.py  # after`, after);
const head = `<head><meta charset="utf-8"><style>${STYLE}</style></head>`;
const html = `<!doctype html><html>${head}<body><div class="window">${body}</div></body></html>`;

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 840, height: 300 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.locator(".window").screenshot({ path: join(STEP, "images", "expected.png") });
await browser.close();
console.log("Wrote 03-measure-the-elective/images/expected.png");
