// Runs assignment/openfga/check.py against a throwaway OpenFGA server and turns its three rules
// into this step's rules. Each folder gets its own server on a free port, stopped and deleted when
// the check ends. The check reads only what the server answers, never a model's reply.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";

const COMPOSE_FILE = join(ROOT, "assignment", "openfga", "compose.yml");
const CHECK_SCRIPT = join(ROOT, "assignment", "openfga", "check.py");

// The same three sentences that assignment/openfga/check.py prints.
const STACK_RULE = "OpenFGA is running and accepts your model";
const DEV_RULE = "Every dev request gets the answer the roster gives";
const NEW_FIELD_RULE = "A new field inherits its farm's access with no new grant";

type Lines = Record<string, string>;
const answers = new Map<string, Promise<Lines>>();

function runQuietly(command: string[], environment: Record<string, string> = {}) {
  return spawnSync(command[0], command.slice(1), {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
}

// A port the operating system says is free right now. The server gets it for this check only.
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address() as AddressInfo;
      probe.close(() => resolve(address.port));
    });
  });
}

async function linesFor(folder: string): Promise<Lines> {
  const port = await freePort();
  const project = `openfga-check-${port}`;
  // biome-ignore lint/style/useNamingConvention: environment variable names are upper case
  const environment = { OPENFGA_PORT: String(port) };
  const compose = ["docker", "compose", "-p", project, "-f", COMPOSE_FILE];
  const resultDir = mkdtempSync(join(tmpdir(), "openfga-result-"));
  const resultFile = join(resultDir, "result.json");
  try {
    runQuietly([...compose, "up", "-d", "--wait", "--wait-timeout", "120"], environment);
    runQuietly([
      "uv",
      "run",
      "python",
      CHECK_SCRIPT,
      "--url",
      `http://127.0.0.1:${port}`,
      "--folder",
      folder,
      "--out",
      resultFile,
    ]);
    if (!existsSync(resultFile)) return {};
    return JSON.parse(readFileSync(resultFile, "utf8")).lines;
  } finally {
    runQuietly([...compose, "down", "-v"], environment);
    rmSync(resultDir, { recursive: true, force: true });
  }
}

function answerFor(folder: string): Promise<Lines> {
  if (!answers.has(folder)) answers.set(folder, linesFor(folder));
  return answers.get(folder) as Promise<Lines>;
}

const line = (says: string, tryNext: string): Rule => ({
  says,
  test: async (folder) => (await answerFor(folder))[says] === "pass",
  tryNext,
});

export default [
  line(STACK_RULE, "start Docker, then define every relation in model.fga above its first use"),
  line(DEV_RULE, "let crew leads and farm managers approve; the auditor may only view"),
  line(
    NEW_FIELD_RULE,
    "let access reach a field through its farm, so a new field needs no grant of its own",
  ),
] satisfies Rule[];
