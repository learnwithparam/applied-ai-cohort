"""Finds this part's kit/ folder and loads the helpers in it.

The kit holds the data and replay answers this part adds to the world. It sits in the part
folder, above every step, so code in any step folder can find it.
"""

import importlib.util
from pathlib import Path


def kit_folder() -> Path:
    for folder in Path(__file__).resolve().parents:
        if (folder / "kit").is_dir():
            return folder / "kit"
    raise FileNotFoundError("There is no kit/ folder above this one. Work inside the part folder.")


KIT = kit_folder()


def load_kit_module(module_name: str):
    """Load one Python file from the kit, such as judge_replay.py."""
    location = KIT / f"{module_name}.py"
    spec = importlib.util.spec_from_file_location(module_name, location)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ask_judge = load_kit_module("judge_replay").ask_judge
ask_model = load_kit_module("answer_replay").ask_model
approvals = load_kit_module("approvals")
