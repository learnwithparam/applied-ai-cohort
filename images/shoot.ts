// bun run shots: captures every picture the READMEs show, from real output and real pages.
// Terminal output is rendered as HTML in a dark terminal style about 800 pixels wide.
// Set CHROMIUM_PATH to use a Chromium that is already installed instead of Playwright's own.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import { PYTHON } from "../checks/lib/world";

const PART_ONE = join(ROOT, "parts", "01-get-records-you-can-trust");
const env = { ...process.env, PYTHONPATH: ROOT, LLM_PROVIDER: "replay" };

function run(command: string, cwd = ROOT): string {
  const result = spawnSync("sh", ["-c", command], { cwd, env, encoding: "utf8" });
  return (result.stdout ?? "") + (result.stderr ?? "");
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function terminal(blocks: { command: string; output: string }[]): string {
  const body = blocks
    .map((block) => `<div class="prompt">$ ${escapeHtml(block.command)}</div><pre>${escapeHtml(block.output.trimEnd())}</pre>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#FAFAFA;padding:16px}
    .window{width:800px;background:#1F1F1C;color:#FAFAFA;border-radius:8px;padding:16px 18px;box-sizing:border-box}
    .prompt{color:#FAFF69;font:13px/1.5 ui-monospace,Menlo,monospace;margin-top:6px}
    pre{margin:4px 0 10px;font:13px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word}
  </style></head><body><div class="window">${body}</div></body></html>`;
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 840, height: 400 }, deviceScaleFactor: 2 });

async function shootHtml(html: string, outputs: string[]) {
  await page.setContent(html);
  for (const output of outputs) await page.locator(".window").screenshot({ path: output });
}

// 1. The finished system's scorecard.
const finished = run(`${PYTHON} -m reference.finished`);
await shootHtml(terminal([{ command: "uv run finished", output: finished }]), [
  join(ROOT, "images", "finished-system.png"),
  join(ROOT, "00-orientation", "images", "finished-system.png"),
  join(ROOT, "00-orientation", "01-run-the-finished-system", "images", "expected.png"),
]);

// 2. Before and after fixing the shape, on the per-acre email.
const email = "uv run world email TB-1006";
const before = run(`${PYTHON} -m worlds email TB-1006 | ${PYTHON} extract.py`, join(PART_ONE, "02-call-the-model", "solution"));
const after = run(`${PYTHON} -m worlds email TB-1006 | ${PYTHON} extract.py`, join(PART_ONE, "03-fix-the-shape", "solution"));
await shootHtml(
  terminal([
    { command: `${email} | uv run python extract.py    # before`, output: before },
    { command: `${email} | uv run python extract.py    # after`, output: after },
  ]),
  [join(PART_ONE, "03-fix-the-shape", "images", "expected.png")],
);

// 3. The milestone check passing on the hidden test inbox.
const proof = run("bun scripts/verify.ts prove-the-records solution");
await shootHtml(terminal([{ command: "bun run verify prove-the-records", output: proof.replace(/\(sample solution\)/, "(your work)") }]), [
  join(PART_ONE, "06-prove-the-records", "images", "expected.png"),
]);

// 4. The jobs board after a good intake run, a real page from the world's server.
const scratch = mkdtempSync(join(tmpdir(), "shots-"));
const db = join(scratch, "coop.db");
run(`${PYTHON} -m worlds reset --db ${db}`);
const server = spawn(PYTHON, ["-m", "worlds", "serve", "--db", db, "--port", "8177"], { cwd: ROOT, env, stdio: "ignore" });
await Bun.sleep(800);
run(`WORLD_URL=http://127.0.0.1:8177 RUNS_DIR=${join(scratch, "runs")} ${PYTHON} intake.py`, join(PART_ONE, "04-check-against-truth", "solution"));
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto("http://127.0.0.1:8177/");
for (const output of [join(ROOT, "images", "jobs-board.png"), join(PART_ONE, "04-check-against-truth", "images", "expected.png")])
  await page.screenshot({ path: output, fullPage: true });
server.kill();
rmSync(scratch, { recursive: true, force: true });

await browser.close();
console.log("Captured 7 pictures.");
