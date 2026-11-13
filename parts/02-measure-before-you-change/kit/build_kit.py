"""Builds this part's judge cases and the judge's replay answers.

    python3 parts/02-measure-before-you-change/kit/build_kit.py

The output is committed. Run this only to change the cases, then commit what it writes.

The judge answers one question about a record: did the reader take the field from the email,
or did it guess? A person labelled every case. Replay stands in for a judge model. For each
case it holds four answers, one for each kind of judge prompt a learner tends to write:

    score    the prompt asks for a score from 1 to 5, so the model answers with a number
    lenient  the prompt asks for pass or fail with no examples, so the model passes most cases
    strict   the prompt says to fail when unsure, so the model fails anything not written exactly
    aligned  the prompt shows labelled examples, so the model agrees with the person most times
"""

import hashlib
import json
from pathlib import Path

KIT = Path(__file__).resolve().parent
ROOT = KIT.parents[2]
WORLD_DIR = ROOT / "worlds" / "tallgrass_bend"

GROWER_EMAILS = {
    "G01": ("dale.okafor@ridgemail.example", "Dale"),
    "G02": ("marta@lindqvistfarms.example", "Marta"),
    "G03": ("hollis.brandt@prairienet.example", "Hollis"),
    "G04": ("ama.mensah@fieldpost.example", "Ama"),
    "G05": ("ross@tamblynbros.example", "Ross"),
    "G06": ("ines.carvalho@ridgemail.example", "Ines"),
    "G07": ("pete.varga@prairienet.example", "Pete"),
    "G08": ("june@whitcombefarm.example", "June"),
}

# Kinds of case. In the first group the email names the field, so a person passes the record.
NAMED_KINDS = ("exact", "lower", "typo", "short", "abbreviated")
# In the second group the reader had to guess, so a person fails the record.
GUESSED_KINDS = ("two-fields", "vague", "no-field", "last-time")

# case id, grower, the sentence the grower wrote, the field the record names, kind,
# and whether the aligned judge still gets this case wrong (no judge is perfect).
CASES = {
    "dev": [
        (
            "J-D01",
            "G01",
            "Please spray Creek Paddock with Glyfallow 540 at 2 L/ha.",
            "Creek Paddock",
            "exact",
            False,
        ),
        (
            "J-D02",
            "G02",
            "Can you do the long meadow with Pulsepath at 0.9 L/ha?",
            "Long Meadow",
            "lower",
            False,
        ),
        (
            "J-D03",
            "G05",
            "Sandhil needs Tillerguard at 0.5 L/ha this round.",
            "Sandhill",
            "typo",
            False,
        ),
        (
            "J-D04",
            "G02",
            "Book Schoolhouse Qtr for Glyfallow 540 at 2.4 L/ha.",
            "Schoolhouse Quarter",
            "abbreviated",
            False,
        ),
        (
            "J-D05",
            "G08",
            "Put Podshield on the pond field at 0.4 L/ha.",
            "Pond Field",
            "lower",
            False,
        ),
        (
            "J-D06",
            "G07",
            "South Section is ready for Brasslock at 0.8 L/ha.",
            "South Section",
            "exact",
            False,
        ),
        (
            "J-D07",
            "G04",
            "Railway strip, Pulsepath, 1 L/ha please.",
            "Railway Strip",
            "lower",
            False,
        ),
        ("J-D08", "G06", "Windbreak needs Stemsure at 0.6 L/ha.", "Windbreak Field", "short", True),
        (
            "J-D09",
            "G03",
            "We need the north block sprayed with Stemsure at 0.6 L/ha.",
            "North Forty",
            "two-fields",
            False,
        ),
        (
            "J-D10",
            "G03",
            "Do the usual spot with Glyfallow 540 at 1.8 L/ha.",
            "Home Block",
            "vague",
            False,
        ),
        (
            "J-D11",
            "G01",
            "Please book Glyfallow 540 at 2 L/ha when you can.",
            "Creek Paddock",
            "no-field",
            False,
        ),
        (
            "J-D12",
            "G03",
            "The canola needs Brasslock at 0.8 L/ha.",
            "North Flats",
            "two-fields",
            False,
        ),
        (
            "J-D13",
            "G06",
            "Same field as last time, Pulsepath at 1 L/ha.",
            "Coulee Bottom",
            "last-time",
            False,
        ),
        (
            "J-D14",
            "G01",
            "The back paddock needs Tillerguard at 0.6 L/ha.",
            "Creek Paddock",
            "vague",
            False,
        ),
        (
            "J-D15",
            "G08",
            "Our big block needs Tillerguard at 0.5 L/ha.",
            "Butte View",
            "vague",
            False,
        ),
        (
            "J-D16",
            "G07",
            "Put Brasslock on the top paddock at 0.8 L/ha.",
            "Old Yard",
            "vague",
            False,
        ),
    ],
    "held-out": [
        (
            "J-H01",
            "G04",
            "Dugout Field needs Glyfallow 540 at 1.5 L/ha.",
            "Dugout Field",
            "exact",
            False,
        ),
        ("J-H02", "G05", "east slough, Stemsure 0.45 L/ha.", "East Slough", "lower", False),
        (
            "J-H03",
            "G06",
            "Coulee Botom is ready for Pulsepath at 0.9 L/ha.",
            "Coulee Bottom",
            "typo",
            False,
        ),
        (
            "J-H04",
            "G03",
            "Home Blk please, Tillerguard at 0.6 L/ha.",
            "Home Block",
            "abbreviated",
            False,
        ),
        ("J-H05", "G07", "Old yard needs Podshield at 0.3 L/ha.", "Old Yard", "lower", False),
        ("J-H06", "G08", "Butte View: Tillerguard at 0.4 L/ha.", "Butte View", "exact", False),
        (
            "J-H07",
            "G01",
            "Top 40 is ready for Brasslock at 0.8 L/ha.",
            "Top Forty",
            "abbreviated",
            True,
        ),
        ("J-H08", "G02", "Long Meadow needs Podshield at 0.4 L/ha.", "Long Meadow", "exact", False),
        (
            "J-H09",
            "G03",
            "Please do the north paddock with Brasslock at 0.75 L/ha.",
            "North Flats",
            "two-fields",
            False,
        ),
        (
            "J-H10",
            "G03",
            "Our canola is ready for Stemsure at 0.5 L/ha.",
            "North Forty",
            "two-fields",
            False,
        ),
        ("J-H11", "G05", "Book Tillerguard at 0.6 L/ha, thanks.", "Sandhill", "no-field", False),
        (
            "J-H12",
            "G02",
            "Same as last spring, Glyfallow 540 at 2 L/ha.",
            "Schoolhouse Quarter",
            "last-time",
            False,
        ),
        (
            "J-H13",
            "G08",
            "The bottom field needs Podshield at 0.4 L/ha.",
            "Pond Field",
            "vague",
            False,
        ),
        (
            "J-H14",
            "G07",
            "The far block needs Brasslock at 0.9 L/ha.",
            "South Section",
            "vague",
            False,
        ),
        (
            "J-H15",
            "G01",
            "Do the paddock by the road with Glyfallow 540 at 2 L/ha.",
            "Top Forty",
            "vague",
            False,
        ),
        ("J-H16", "G06", "The lower field, Pulsepath at 1.1 L/ha.", "Coulee Bottom", "vague", True),
    ],
    "grader": [
        ("J-G01", "G05", "Sandhill needs Glyfallow 540 at 1.5 L/ha.", "Sandhill", "exact", False),
        (
            "J-G02",
            "G06",
            "windbreak field, Tillerguard 0.6 L/ha.",
            "Windbreak Field",
            "lower",
            False,
        ),
        ("J-G03", "G08", "Pond Feild needs Pulsepath at 1 L/ha.", "Pond Field", "typo", False),
        (
            "J-G04",
            "G02",
            "Schoolhouse needs Stemsure at 0.6 L/ha.",
            "Schoolhouse Quarter",
            "short",
            True,
        ),
        ("J-G05", "G04", "Dugout needs Tillerguard at 0.5 L/ha.", "Dugout Field", "short", False),
        (
            "J-G06",
            "G07",
            "South Sect. is ready for Brasslock at 0.8 L/ha.",
            "South Section",
            "abbreviated",
            False,
        ),
        (
            "J-G07",
            "G03",
            "The north field needs Glyfallow 540 at 2 L/ha.",
            "North Forty",
            "two-fields",
            False,
        ),
        ("J-G08", "G01", "Please book Brasslock at 0.8 L/ha.", "Top Forty", "no-field", False),
        (
            "J-G09",
            "G04",
            "The usual paddock, Pulsepath at 1 L/ha.",
            "Railway Strip",
            "vague",
            False,
        ),
        (
            "J-G10",
            "G05",
            "Same as last time, Stemsure 0.6 L/ha.",
            "East Slough",
            "last-time",
            False,
        ),
        (
            "J-G11",
            "G08",
            "The home field needs Tillerguard at 0.5 L/ha.",
            "Butte View",
            "vague",
            False,
        ),
        (
            "J-G12",
            "G06",
            "The new block, Glyfallow 540 at 2 L/ha.",
            "Windbreak Field",
            "vague",
            False,
        ),
    ],
}


def email_for(grower_id: str, sentence: str) -> str:
    address, first_name = GROWER_EMAILS[grower_id]
    header = f"From: {address}\nSubject: Spray request\n\n"
    return f"{header}Hi desk,\n\n{sentence}\n\nThanks,\n{first_name}\n"


def person_passes(kind: str) -> bool:
    return kind in NAMED_KINDS


def verdict(passes: bool, field_name: str) -> str:
    """The judge's reply: PASS or FAIL first, then one short reason."""
    if passes:
        return f"PASS: the email names {field_name}."
    return f"FAIL: the email does not name {field_name}, so the reader guessed."


def answers_for(kind: str, field_name: str, aligned_is_wrong: bool) -> dict:
    """The four recorded answers for one case, one per kind of judge prompt."""
    right = person_passes(kind)
    aligned = right
    if aligned_is_wrong:
        aligned = not right
    lenient = kind not in ("no-field", "last-time")
    strict = kind == "exact"
    score = "3" if kind in ("no-field", "two-fields") else "4"
    return {
        "score": score,
        "lenient": verdict(lenient, field_name),
        "strict": verdict(strict, field_name),
        "aligned": verdict(aligned, field_name),
    }


def label_hash(case_id: str, passes: bool) -> str:
    """The grader keeps only this hash, so its labels can be scored without being read."""
    key = f"{case_id}|{'pass' if passes else 'fail'}"
    return hashlib.sha256(key.encode()).hexdigest()


def case_rows(split: str) -> tuple[list[dict], list[dict]]:
    """The cases a learner's judge reads, and the replay answers for them."""
    rows = []
    recordings = []
    for case_id, grower_id, sentence, field_name, kind, aligned_is_wrong in CASES[split]:
        email = email_for(grower_id, sentence)
        row = {"case_id": case_id, "email": email, "field_name": field_name}
        passes = person_passes(kind)
        if split == "grader":
            row["label_hash"] = label_hash(case_id, passes)
        else:
            row["pass"] = passes
        rows.append(row)
        answers = answers_for(kind, field_name, aligned_is_wrong)
        recordings.append({"case_id": case_id, "email": email, **answers})
    return rows, recordings


def inbox_recordings() -> list[dict]:
    """Answers for every dev inbox email, so the eval can judge the golden set on replay."""
    recordings = []
    for path in sorted((WORLD_DIR / "replay").glob("TB-1*.json")):
        replay = json.loads(path.read_text())
        email_id = replay["email_id"]
        email = (WORLD_DIR / "inbox" / "dev" / f"{email_id}.txt").read_text()
        field_name = replay["json_reply"]["field_name"]
        named = field_name.lower() in email.lower()
        kind = "exact" if named else "two-fields"
        answers = answers_for(kind, field_name, aligned_is_wrong=False)
        answers["lenient"] = verdict(True, field_name)
        recordings.append({"case_id": email_id, "email": email, **answers})
    return recordings


def write_lines(path: Path, rows: list[dict]) -> None:
    lines = [json.dumps(row) for row in rows]
    path.write_text("\n".join(lines) + "\n")


def main() -> None:
    all_recordings = []
    for split in CASES:
        rows, recordings = case_rows(split)
        write_lines(KIT / "judge-cases" / f"{split}.jsonl", rows)
        all_recordings.extend(recordings)
    all_recordings.extend(inbox_recordings())
    write_lines(KIT / "judge-replay.jsonl", all_recordings)
    print("Wrote judge-cases/ and judge-replay.jsonl.")


if __name__ == "__main__":
    main()
