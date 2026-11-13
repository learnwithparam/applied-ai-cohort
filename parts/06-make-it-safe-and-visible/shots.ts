// bun parts/06-make-it-safe-and-visible/shots.ts: captures the pictures this part's steps show.
// Set CHROMIUM_PATH to use a Chromium that is already installed instead of Playwright's own.
// Terminal output is rendered as HTML in a dark terminal style about 800 pixels wide.
// The trace is a real one, written by the sample agent and drawn as a tree.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { worldEnv } from "../../checks/lib/contract";
import { REPLAY_ENV, startWorld } from "../../checks/lib/world";
import { ROOT } from "../../scripts/structure";
import { devTasks, runVerbAsync, startApprovalDesk } from "./agent-checks";

const PART = join(ROOT, "parts", "06-make-it-safe-and-visible");

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

type TraceSpan = { name: string; attributes: Record<string, unknown> };
type OtlpAttribute = { key: string; value: Record<string, unknown> };
type OtlpPayload = {
  resourceSpans: { scopeSpans: { spans: { name: string; attributes: OtlpAttribute[] }[] }[] }[];
};

function spansIn(payload: OtlpPayload): TraceSpan[] {
  const spans = payload.resourceSpans[0].scopeSpans[0].spans;
  return spans.map((span) => {
    const attributes: Record<string, unknown> = {};
    for (const attribute of span.attributes) {
      attributes[attribute.key] = Object.values(attribute.value)[0];
    }
    return { name: span.name, attributes };
  });
}

// One line per span: the act span first, then each model and tool call under it.
function treeLine(span: TraceSpan): string {
  const attributes = span.attributes;
  if (span.name === "act") return `act  run ${String(attributes.run_id).slice(0, 8)}...`;
  if (!span.name.startsWith("chat")) return `  ${span.name}`;
  const tokensIn = attributes["gen_ai.usage.input_tokens"];
  const tokensOut = attributes["gen_ai.usage.output_tokens"];
  const cost = Number(attributes["gen_ai.usage.cost"]).toFixed(7);
  return `  ${span.name.padEnd(28)} in ${tokensIn}  out ${tokensOut}  $${cost}`;
}

// 1. One trace from the sample agent, on TB-1008.
const traceFolder = join(PART, "01-trace-every-run", "solution");
const world = await startWorld("dev");
const desk = startApprovalDesk();
// biome-ignore lint/style/useNamingConvention: environment variable names are upper case.
const env = { ...worldEnv(world), APPROVALS_URL: desk.url };
const task = devTasks().find((candidate) => candidate.email_id === "TB-1008");
await runVerbAsync(traceFolder, "act", task, env);
const traceLine = readFileSync(join(world.runsDir, "traces.jsonl"), "utf8").trim();
const tree = spansIn(JSON.parse(traceLine)).map(treeLine).join("\n");
await shootTerminal("01-trace-every-run", "a trace for TB-1008, from runs/traces.jsonl", tree);
desk.stop();
world.stop();

// 2. The milestone check on the sample solution.
const proveCommand = "bun run verify prove-the-guards solution";
await shootTerminal("07-prove-the-guards", proveCommand, run(proveCommand, ROOT));

await browser.close();
console.log("Wrote the make-it-safe-and-visible pictures.");
