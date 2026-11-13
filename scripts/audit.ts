// biome-ignore-all lint/style/useNamingConvention: environment variable names are upper case
// bun run audit: the text audit on the jobs board, once with an empty store and once with
// the seed work in it. Each run gets a throwaway store and its own board, which Playwright stops.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./structure";

// A fresh checkout has no packages and no browser yet, and CI runs only `bun run check`.
const setup = (command: string[]) =>
  Bun.spawnSync(command, { cwd: ROOT, stdio: ["inherit", "inherit", "inherit"] });
if (!existsSync(join(ROOT, "node_modules", "@playwright", "test"))) {
  setup(["bun", "install", "--frozen-lockfile"]);
}
if (process.env.CI) setup(["bunx", "playwright", "install", "--with-deps", "chromium"]);

const PORT = "8187";
const RUNS = ["empty store", "with the seed"];

function auditRun(pattern: string): number {
  const folder = mkdtempSync(join(tmpdir(), "spray-desk-"));
  const env = {
    ...process.env,
    WORLD_DB: join(folder, "coop.db"),
    AUDIT_URL: `http://127.0.0.1:${PORT}`,
    AUDIT_SERVER: `uv run world serve --port ${PORT}`,
  };
  const command = ["bunx", "playwright", "test", "--config", "e2e/playwright.config.ts"];
  const result = Bun.spawnSync([...command, "--grep", pattern], {
    cwd: ROOT,
    env,
    stdio: ["inherit", "inherit", "inherit"],
  });
  rmSync(folder, { recursive: true, force: true });
  return result.exitCode;
}

const failed = RUNS.map(auditRun).some((code) => code !== 0);
process.exit(failed ? 1 : 0);
