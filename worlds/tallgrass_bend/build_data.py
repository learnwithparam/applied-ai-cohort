"""Builds the Tallgrass Bend world's data: seed records, inbox, truth and replay replies.

    python3 -m worlds.tallgrass_bend.build_data

The output is committed. Run this only to change the world, then commit what it writes.
Every planted trap is listed in TRAPS and in brief.md.
"""

import hashlib
import json
import random
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
LITRES_PER_ACRE_TO_PER_HECTARE = 1 / 0.404686

GROWERS = [
    {"grower_id": "G01", "name": "Dale Okafor", "email": "dale.okafor@ridgemail.example"},
    {"grower_id": "G02", "name": "Marta Lindqvist", "email": "marta@lindqvistfarms.example"},
    {"grower_id": "G03", "name": "Hollis Brandt", "email": "hollis.brandt@prairienet.example"},
    {"grower_id": "G04", "name": "Ama Mensah", "email": "ama.mensah@fieldpost.example"},
    {"grower_id": "G05", "name": "Ross Tamblyn", "email": "ross@tamblynbros.example"},
    {"grower_id": "G06", "name": "Ines Carvalho", "email": "ines.carvalho@ridgemail.example"},
    {"grower_id": "G07", "name": "Pete Varga", "email": "pete.varga@prairienet.example"},
    {"grower_id": "G08", "name": "June Whitcombe", "email": "june@whitcombefarm.example"},
]

FIELDS = [
    ("F01", "G01", "Creek Paddock", 42.0, "wheat"),
    ("F02", "G01", "Top Forty", 16.5, "canola"),
    ("F03", "G02", "Schoolhouse Quarter", 64.0, "barley"),
    ("F04", "G02", "Long Meadow", 28.0, "lentils"),
    ("F05", "G03", "North Forty", 16.2, "canola"),
    ("F06", "G03", "North Flats", 31.0, "canola"),
    ("F07", "G03", "Home Block", 22.5, "wheat"),
    ("F08", "G04", "Railway Strip", 12.0, "peas"),
    ("F09", "G04", "Dugout Field", 37.5, "wheat"),
    ("F10", "G05", "Sandhill", 48.0, "barley"),
    ("F11", "G05", "East Slough", 19.0, "canola"),
    ("F12", "G06", "Coulee Bottom", 26.0, "lentils"),
    ("F13", "G06", "Windbreak Field", 33.0, "wheat"),
    ("F14", "G07", "Old Yard", 9.5, "peas"),
    ("F15", "G07", "South Section", 64.0, "canola"),
    ("F16", "G08", "Butte View", 40.0, "barley"),
    ("F17", "G08", "Pond Field", 21.0, "lentils"),
]

PRODUCTS = [
    ("P100", "Glyfallow 540", 3.0, ["wheat", "barley", "canola", "lentils", "peas"]),
    ("P110", "Brasslock", 1.0, ["canola"]),
    ("P120", "Tillerguard", 0.8, ["wheat", "barley"]),
    ("P130", "Pulsepath", 1.2, ["lentils", "peas"]),
    ("P140", "Stemsure", 0.75, ["wheat", "barley", "canola"]),
    ("P150", "Podshield", 0.5, ["lentils", "peas"]),
]

# How many emails of each kind each split holds.
MIX = {
    "dev": {
        "clean": 26,
        "acre": 4,
        "above_label": 3,
        "ambiguous_field": 3,
        "misspelled_product": 2,
        "wrong_crop": 2,
    },
    "test": {
        "clean": 13,
        "acre": 2,
        "above_label": 2,
        "ambiguous_field": 1,
        "misspelled_product": 1,
        "wrong_crop": 1,
    },
}

TRAPS = {
    "acre": "The grower gives the rate per acre. The model copies the number and calls it L/ha.",
    "above_label": "The grower asks for more than the label allows. The model copies it faithfully.",
    "ambiguous_field": "The grower says 'the north block' and owns two north fields. The model guesses one.",
    "misspelled_product": "The grower misspells the product. The model copies the misspelling.",
    "wrong_crop": "The product is not labelled for the crop in that field. The model copies it faithfully.",
}

OPENINGS = ["Hi desk,", "Morning all,", "Hello,", "Hi team,", "Good afternoon,"]
TIMINGS = [
    "when the crew can get to it",
    "as soon as the wind drops",
    "before the next rain if you can",
    "whenever the sprayer is free",
    "at the next calm spell",
]
STAGES = {
    "wheat": "The wheat is at the three-leaf stage.",
    "barley": "The barley is coming on well.",
    "canola": "The canola is just past rosette.",
    "lentils": "The lentils are about ten centimetres tall.",
    "peas": "The peas are looking even.",
}
MISSPELLINGS = {
    "Brasslock": "Brasslok",
    "Tillerguard": "Tilerguard",
    "Pulsepath": "Pulse Path",
    "Stemsure": "Stemshure",
}


def field_by_id(field_id):
    return next(field for field in FIELDS if field[0] == field_id)


def product_by_code(product_code):
    return next(product for product in PRODUCTS if product[0] == product_code)


def grower_by_id(grower_id):
    return next(grower for grower in GROWERS if grower["grower_id"] == grower_id)


def labelled_products(crop):
    return [product for product in PRODUCTS if crop in product[3]]


def write_email(randomizer, grower, field_words, product_words, rate_words, crop):
    first_name = grower["name"].split()[0]
    sentence = randomizer.choice(
        [
            f"Please book {product_words} on {field_words} at {rate_words} {randomizer.choice(TIMINGS)}.",
            f"Can you put {product_words} down on {field_words}, {rate_words}, {randomizer.choice(TIMINGS)}?",
            f"We need {field_words} sprayed with {product_words} at {rate_words} {randomizer.choice(TIMINGS)}.",
        ]
    )
    subject = f"Spray request, {field_words[0].upper() + field_words[1:]}"
    return (
        f"From: {grower['email']}\nSubject: {subject}\n\n{randomizer.choice(OPENINGS)}\n\n"
        f"{sentence} {STAGES[crop]}\n\nThanks,\n{first_name}\n"
    )


def make_case(randomizer, kind, ambiguous_turn):
    """One email, its truth and the model's recorded reading of it."""
    if kind == "ambiguous_field":
        field = field_by_id("F06" if ambiguous_turn % 2 == 0 else "F05")
        guessed_field_name = "North Forty"
    elif kind == "wrong_crop":
        field = randomizer.choice([field for field in FIELDS if field[4] in ("wheat", "barley")])
    elif kind == "misspelled_product":
        field = randomizer.choice(
            [field for field in FIELDS if field[4] in ("canola", "wheat", "lentils")]
        )
    else:
        field = randomizer.choice([field for field in FIELDS if field[0] not in ("F05", "F06")])
    field_id, grower_id, field_name, _area, crop = field
    grower = grower_by_id(grower_id)

    if kind == "wrong_crop":
        product = product_by_code("P130")
    elif kind == "misspelled_product":
        product = randomizer.choice([p for p in labelled_products(crop) if p[1] in MISSPELLINGS])
    else:
        product = randomizer.choice(labelled_products(crop))
    product_code, product_name, max_rate, _crops = product

    if kind == "above_label":
        rate_per_hectare = round(max_rate * randomizer.choice([1.5, 2.0, 1.25]), 2)
    else:
        rate_per_hectare = round(max_rate * randomizer.choice([0.5, 0.6, 0.75, 0.8, 1.0]), 2)

    product_words = (
        MISSPELLINGS.get(product_name, product_name)
        if kind == "misspelled_product"
        else product_name
    )
    field_words = "the north block" if kind == "ambiguous_field" else field_name
    if kind == "acre":
        rate_per_acre = round(rate_per_hectare / LITRES_PER_ACRE_TO_PER_HECTARE, 2)
        rate_per_hectare = round(rate_per_acre * LITRES_PER_ACRE_TO_PER_HECTARE, 2)
        rate_words = f"{rate_per_acre} L per acre"
        read_rate = rate_per_acre  # the planted model mistake: the acre number, labelled L/ha
    else:
        rate_words = f"{rate_per_hectare} L/ha"
        read_rate = rate_per_hectare

    email_text = write_email(randomizer, grower, field_words, product_words, rate_words, crop)
    desk_booked = kind not in ("above_label", "wrong_crop")
    truth = {
        "outcome": "booked" if desk_booked else "review",
        "grower_id": grower_id if desk_booked else None,
        "field_id": field_id if desk_booked else None,
        "product_code": product_code if desk_booked else None,
        "rate_l_per_ha": rate_per_hectare if desk_booked else None,
        "trap": None if kind == "clean" else kind,
    }
    json_reply = {
        "sender": grower["email"],
        "field_name": guessed_field_name if kind == "ambiguous_field" else field_name,
        "product_name": product_words,
        "rate": read_rate,
        "rate_unit": "L/ha",
    }
    prose_json = {
        "grower": grower["name"],
        "field": json_reply["field_name"],
        "product": product_words,
        "rate": f"{read_rate} L/ha",
    }
    prose_reply = (
        "Here is what I found in the email:\n\n```json\n"
        + json.dumps(prose_json, indent=2)
        + "\n```\n\nLet me know if you need anything else."
    )
    return email_text, truth, json_reply, prose_reply


def job_hash(email_id, truth):
    if truth["outcome"] == "review":
        key = f"{email_id}|review"
    else:
        key = f"{email_id}|booked|{truth['grower_id']}|{truth['field_id']}|{truth['product_code']}|{truth['rate_l_per_ha']:.2f}"
    return hashlib.sha256(key.encode()).hexdigest()


def main():
    randomizer = random.Random(20261112)
    seed = {
        "growers": GROWERS,
        "fields": [
            {"field_id": f[0], "grower_id": f[1], "name": f[2], "area_ha": f[3], "crop": f[4]}
            for f in FIELDS
        ],
        "products": [
            {"product_code": p[0], "name": p[1], "max_rate_l_per_ha": p[2], "crops": p[3]}
            for p in PRODUCTS
        ],
    }
    (HERE / "seed.json").write_text(json.dumps(seed, indent=2) + "\n")
    for folder in ("inbox", "truth", "replay"):
        shutil.rmtree(HERE / folder, ignore_errors=True)
        (HERE / folder).mkdir()

    for split, first_number in (("dev", 1001), ("test", 2001)):
        kinds = [kind for kind, count in MIX[split].items() for _ in range(count)]
        randomizer.shuffle(kinds)
        (HERE / "inbox" / split).mkdir()
        truth_rows = []
        ambiguous_turn = 0
        for offset, kind in enumerate(kinds):
            email_id = f"TB-{first_number + offset}"
            email_text, truth, json_reply, prose_reply = make_case(randomizer, kind, ambiguous_turn)
            ambiguous_turn += kind == "ambiguous_field"
            (HERE / "inbox" / split / f"{email_id}.txt").write_text(email_text)
            word_count = len(email_text.split())
            recording = {
                "email_id": email_id,
                "json_reply": json_reply,
                "prose_reply": prose_reply,
                "input_tokens": int(word_count * 1.4),
                "output_tokens": 48,
            }
            (HERE / "replay" / f"{email_id}.json").write_text(
                json.dumps(recording, indent=2) + "\n"
            )
            truth_rows.append({"email_id": email_id, **truth})
        if split == "dev":
            lines = [json.dumps(row) for row in truth_rows]
            (HERE / "truth" / "dev.jsonl").write_text("\n".join(lines) + "\n")
        else:
            lines = [
                json.dumps({"email_id": row["email_id"], "hash": job_hash(row["email_id"], row)})
                for row in truth_rows
            ]
            (HERE / "truth" / "test.hashes.jsonl").write_text("\n".join(lines) + "\n")
    print("Wrote seed.json, inbox/, truth/ and replay/.")


if __name__ == "__main__":
    main()
