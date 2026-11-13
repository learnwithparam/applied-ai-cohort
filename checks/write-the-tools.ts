import { type McpSession, mcpSession } from "../parts/05-let-it-act/agent-checks";
import type { Rule } from "../scripts/verify";
import { hasVerb } from "./lib/contract";
import { startWorld } from "./lib/world";

type Tool = { name?: string; description?: string; inputSchema?: Schema };
type Schema = {
  type?: string;
  properties?: Record<string, { type?: string }>;
  required?: string[];
};

// The learner's server, started once and asked for its tool list. Kept for every rule.
const savedSessions = new Map<string, Promise<McpSession>>();

function listedTools(folder: string): Promise<McpSession> {
  let session = savedSessions.get(folder);
  if (!session) {
    session = (async () => {
      const world = await startWorld("dev");
      try {
        return mcpSession(folder, world, []);
      } finally {
        world.stop();
      }
    })();
    savedSessions.set(folder, session);
  }
  return session;
}

async function everyTool(folder: string, passes: (tool: Tool) => boolean): Promise<boolean> {
  const tools = (await listedTools(folder)).tools as Tool[];
  return tools.length > 0 && tools.every(passes);
}

const wordCount = (text: string | undefined) => (text ?? "").split(/\s+/).filter(Boolean).length;

function hasTypedInput(tool: Tool): boolean {
  const schema = tool.inputSchema;
  const properties = Object.values(schema?.properties ?? {});
  if (schema?.type !== "object" || properties.length === 0) return false;
  const everyPropertyTyped = properties.every((property) => typeof property.type === "string");
  return everyPropertyTyped && (schema.required ?? []).length > 0;
}

async function hasToolNamed(folder: string, word: string): Promise<boolean> {
  const tools = (await listedTools(folder)).tools as Tool[];
  return tools.some((tool) => (tool.name ?? "").includes(word));
}

export default [
  {
    says: "contract.toml names a tools verb that starts your MCP server",
    test: (folder) => hasVerb(folder, "tools"),
    tryNext: 'add tools = "uv run python server.py" under [verbs] in contract.toml',
  },
  {
    says: "the server answers an MCP client's tools/list with 3 to 6 tools",
    test: async (folder) => {
      const count = (await listedTools(folder)).tools.length;
      return count >= 3 && count <= 6;
    },
    tryNext: "run uv run python server.py, paste a tools/list request, and read what comes back",
  },
  {
    says: "every tool has a description of at least 12 words: what it does and what it returns",
    test: (folder) => everyTool(folder, (tool) => wordCount(tool.description) >= 12),
    tryNext: "write each description for a new colleague: what the tool does and what it returns",
  },
  {
    says: "every tool has typed input: each argument has a type, and the required ones are listed",
    test: (folder) => everyTool(folder, hasTypedInput),
    tryNext: 'give inputSchema "properties" with a "type" for each argument, and a "required" list',
  },
  {
    says: "the tools can book a job and hand an email to a person",
    test: async (folder) =>
      (await hasToolNamed(folder, "book")) && (await hasToolNamed(folder, "review")),
    tryNext:
      "keep book_job and send_to_review in TOOLS: the agent needs both to reach an end state",
  },
] satisfies Rule[];
