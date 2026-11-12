# Troubleshooting

Every message the course's own commands can print, what it means and what to do.

| What you see | What it means | Fix |
|---|---|---|
| `uv: command not found` | uv is not installed | Install it from https://docs.astral.sh/uv/ and open a new terminal |
| `bun: command not found` | Bun is not installed | Install it from https://bun.sh and open a new terminal |
| `Replay has no recorded reply for this prompt` | Replay mode answers only prompts that contain one whole inbox email | Put the full email text in your prompt, or set `LLM_PROVIDER` and a key in `.env` |
| `LLM_PROVIDER is "x". Use one of: ...` | The provider name in `.env` or your shell is misspelled | Use `replay`, `anthropic`, `openrouter`, `openai` or `ollama` |
| `LLM_PROVIDER is anthropic but ANTHROPIC_API_KEY is empty` (or the OpenRouter or OpenAI key) | You chose a live provider without its key | Copy `.env.example` to `.env` and fill in that one key. Never type a key on the command line |
| `LLM_PROVIDER is ollama but OLLAMA_MODEL is empty` | Ollama needs to know which local model to use | Set `OLLAMA_MODEL` in `.env` to a model you pulled |
| `There is no role "x"` | Code asked for a role that does not exist | Ask for `fast`, `smart` or `judge` |
| `FAIL  fast ...` from `uv run models` | That role's call failed on your provider | Read the sentence after it; a key, network or provider problem is named there |
| `The application system is not running at http://127.0.0.1:8100` | Your code called the world and nothing answered | Run `uv run world serve` in a second terminal and leave it open |
| `OSError: [Errno 98] Address already in use` | Another `world serve` is already on that port | Use the one that is running, or stop it, or pass `--port 8101` and set `WORLD_URL` to match |
| `The application system has no data yet. Run: uv run world reset` | The SQLite file does not exist yet | Run `uv run world reset` |
| `Not booked: product_code "x" does not exist.` (or `grower_id`, `field_id`) | You tried to book a job with an id the system does not hold | Look the id up in `/api/products`, `/api/growers` or `/api/fields` before booking |
| `The body is not JSON.` | A POST to the world was not JSON | Send a JSON object with `Content-Type: application/json`, as `worlds/client.py` does |
| `No route /x` | The path is not part of the world's API | Use a route from `worlds/tallgrass_bend/brief.md` |
| `Name an inbox email, such as: uv run world email TB-1001` | `uv run world email` needs an email id | Pick an id from `worlds/tallgrass_bend/inbox/dev/` |
| `extract is not written yet` or `cost is not written yet` | You ran a starter file | Open the file and follow its TODO |
| `The finished system could not run: ...` | The reference system hit an error | Read the sentence after it; most often a live provider with no key |
| `There is no step called "x". Steps:` | `bun run verify` needs a step name | Copy a name from the list it prints |
| `ERROR  the check for x could not load` | The check file has a problem, not your work | Run `bun install` and `git pull`; if it stays, report it |
| `FAIL  <rule>` then `Try next: ...` | Your work does not meet that rule yet | Do what the Try next line says, then run the same command again |
| `contract.toml has no x verb` | The check needs a verb your contract does not name | Add the verb under `[verbs]` in `contract.toml` |
