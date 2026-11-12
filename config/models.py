"""The only file that names a model.

Code asks for a role (fast, smart, judge), never an id. The provider comes from one
setting, LLM_PROVIDER, read from the environment or from .env at the repo root.
"""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PROVIDERS = ("replay", "anthropic", "openrouter", "openai", "ollama")
ROLES = ("fast", "smart", "judge")

# Ids as LiteLLM spells them: "<provider>/<model>". Read from briefs/MODELS.md.
MODEL_IDS = {
    "anthropic": {
        "fast": "anthropic/claude-haiku-5-5",
        "smart": "anthropic/claude-sonnet-5-5",
        "judge": "anthropic/claude-haiku-5-5",
    },
    "openrouter": {
        "fast": "openrouter/nvidia/nemotron-3.5-lightning",
        "smart": "openrouter/anthropic/claude-sonnet-5.5",
        "judge": "openrouter/anthropic/claude-haiku-5.5",
    },
    "openai": {
        "fast": "openai/gpt-6-luna",
        "smart": "openai/gpt-6-luna-pro",
        "judge": "openai/gpt-6-luna",
    },
}

KEY_NAMES = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "openai": "OPENAI_API_KEY",
}

# Replay has no bill, so it prices its recorded tokens at the OpenRouter fast model's
# list price (USD per million tokens, in and out). Cost lessons then have real-sized
# numbers. Live providers use the price LiteLLM reports for the call.
REPLAY_PRICE_PER_MILLION = {"input": 0.07, "output": 0.20}


def load_env_file() -> None:
    """Read KEY=value lines from .env without overriding the real environment."""
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if value.strip() and name.strip() not in os.environ:
            os.environ[name.strip()] = value.strip()


def provider() -> str:
    load_env_file()
    chosen = os.environ.get("LLM_PROVIDER", "replay").strip() or "replay"
    if chosen not in PROVIDERS:
        raise ValueError(f'LLM_PROVIDER is "{chosen}". Use one of: {", ".join(PROVIDERS)}.')
    return chosen


def model_for(role: str) -> str:
    """The LiteLLM id for a role on the chosen provider. Replay has no id."""
    if role not in ROLES:
        raise ValueError(f'There is no role "{role}". Use one of: {", ".join(ROLES)}.')
    chosen = provider()
    if chosen == "replay":
        return "replay"
    if chosen == "ollama":
        local_model = os.environ.get("OLLAMA_MODEL", "").strip()
        if not local_model:
            raise ValueError(
                "LLM_PROVIDER is ollama but OLLAMA_MODEL is empty. Name a model you pulled."
            )
        return f"ollama/{local_model}"
    return MODEL_IDS[chosen][role]


def key_problem() -> str | None:
    """A sentence saying which key is missing, or None when the provider is ready."""
    chosen = provider()
    key_name = KEY_NAMES.get(chosen)
    if key_name and not os.environ.get(key_name, "").strip():
        missing = f"LLM_PROVIDER is {chosen} but {key_name} is empty."
        return f"{missing} Put it in .env, never on the command line."
    return None
