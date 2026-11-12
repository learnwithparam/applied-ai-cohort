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
    "above_label": (
        "The grower asks for more than the label allows. The model copies it faithfully."
    ),
    "ambiguous_field": (
        "The grower says 'the north block' and owns two north fields. The model guesses one."
    ),
    "misspelled_product": "The grower misspells the product. The model copies the misspelling.",
    "wrong_crop": (
        "The product is not labelled for the crop in that field. The model copies it faithfully."
    ),
}

# The desk sends these to a person. Every other kind of email it books.
DESK_REVIEWS = ("above_label", "wrong_crop")

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


def write_email(randomizer, grower, request, crop):
    """The email a grower sends. The request holds the field, product and rate as written."""
    field_words = request["field"]
    product_words = request["product"]
    rate_words = request["rate"]
    # Draw all three timings first, then pick a sentence, so the random sequence stays fixed.
    first_timing = randomizer.choice(TIMINGS)
    second_timing = randomizer.choice(TIMINGS)
    third_timing = randomizer.choice(TIMINGS)
    sentences = [
        f"Please book {product_words} on {field_words} at {rate_words} {first_timing}.",
        f"Can you put {product_words} down on {field_words}, {rate_words}, {second_timing}?",
        f"We need {field_words} sprayed with {product_words} at {rate_words} {third_timing}.",
    ]
    sentence = randomizer.choice(sentences)
    first_name = grower["name"].split()[0]
    subject = f"Spray request, {field_words[0].upper() + field_words[1:]}"
    opening = randomizer.choice(OPENINGS)
    return (
        f"From: {grower['email']}\nSubject: {subject}\n\n{opening}\n\n"
        f"{sentence} {STAGES[crop]}\n\nThanks,\n{first_name}\n"
    )


def fields_growing(crops):
    return [field for field in FIELDS if field[4] in crops]


def pick_field(randomizer, kind, ambiguous_turn):
    """The field the email is about, and the field name the model guesses for it."""
    if kind == "ambiguous_field":
        # Ambiguous emails take turns between the grower's two north fields.
        field_id = "F06" if ambiguous_turn % 2 == 0 else "F05"
        return field_by_id(field_id), "North Forty"
    if kind == "wrong_crop":
        field = randomizer.choice(fields_growing(("wheat", "barley")))
    elif kind == "misspelled_product":
        field = randomizer.choice(fields_growing(("canola", "wheat", "lentils")))
    else:
        unambiguous_fields = [field for field in FIELDS if field[0] not in ("F05", "F06")]
        field = randomizer.choice(unambiguous_fields)
    return field, field[2]


def pick_product(randomizer, kind, crop):
    if kind == "wrong_crop":
        return product_by_code("P130")
    if kind == "misspelled_product":
        misspellable = [
            product for product in labelled_products(crop) if product[1] in MISSPELLINGS
        ]
        return randomizer.choice(misspellable)
    return randomizer.choice(labelled_products(crop))


def pick_rate(randomizer, kind, max_rate):
    """The rate per hectare the grower asks for, as a share of the label's highest rate."""
    if kind == "above_label":
        share_of_label = randomizer.choice([1.5, 2.0, 1.25])
    else:
        share_of_label = randomizer.choice([0.5, 0.6, 0.75, 0.8, 1.0])
    return round(max_rate * share_of_label, 2)


def rate_as_written(kind, rate_per_hectare):
    """How the grower writes the rate, the number the model reads, and the true rate per hectare."""
    if kind != "acre":
        return f"{rate_per_hectare} L/ha", rate_per_hectare, rate_per_hectare
    rate_per_acre = round(rate_per_hectare / LITRES_PER_ACRE_TO_PER_HECTARE, 2)
    rate_per_hectare = round(rate_per_acre * LITRES_PER_ACRE_TO_PER_HECTARE, 2)
    # The planted model mistake: the acre number, labelled L/ha.
    return f"{rate_per_acre} L per acre", rate_per_acre, rate_per_hectare


def desk_truth(kind, field, product, rate_per_hectare):
    """What the desk itself did with the email: the job it booked, or a person's review."""
    trap = None if kind == "clean" else kind
    if kind in DESK_REVIEWS:
        empty_job = {"grower_id": None, "field_id": None, "product_code": None}
        return {"outcome": "review", **empty_job, "rate_l_per_ha": None, "trap": trap}
    return {
        "outcome": "booked",
        "grower_id": field[1],
        "field_id": field[0],
        "product_code": product[0],
        "rate_l_per_ha": rate_per_hectare,
        "trap": trap,
    }


def prose_reply_for(grower, json_reply):
    """The reply a model gives when no shape is asked for: chatty text around a JSON block."""
    prose_json = {
        "grower": grower["name"],
        "field": json_reply["field_name"],
        "product": json_reply["product_name"],
        "rate": f"{json_reply['rate']} L/ha",
    }
    return (
        "Here is what I found in the email:\n\n```json\n"
        + json.dumps(prose_json, indent=2)
        + "\n```\n\nLet me know if you need anything else."
    )


def make_case(randomizer, kind, ambiguous_turn):
    """One email, its truth and the model's recorded reading of it."""
    field, guessed_field_name = pick_field(randomizer, kind, ambiguous_turn)
    _field_id, grower_id, field_name, _area, crop = field
    grower = grower_by_id(grower_id)
    product = pick_product(randomizer, kind, crop)
    product_name = product[1]
    rate_per_hectare = pick_rate(randomizer, kind, product[2])

    product_words = product_name
    if kind == "misspelled_product":
        product_words = MISSPELLINGS.get(product_name, product_name)
    field_words = "the north block" if kind == "ambiguous_field" else field_name
    rate_words, read_rate, rate_per_hectare = rate_as_written(kind, rate_per_hectare)

    request = {"field": field_words, "product": product_words, "rate": rate_words}
    email_text = write_email(randomizer, grower, request, crop)
    truth = desk_truth(kind, field, product, rate_per_hectare)
    json_reply = {
        "sender": grower["email"],
        "field_name": guessed_field_name,
        "product_name": product_words,
        "rate": read_rate,
        "rate_unit": "L/ha",
    }
    return email_text, truth, json_reply, prose_reply_for(grower, json_reply)


def job_hash(email_id, truth):
    if truth["outcome"] == "review":
        key = f"{email_id}|review"
    else:
        ids = f"{truth['grower_id']}|{truth['field_id']}|{truth['product_code']}"
        key = f"{email_id}|booked|{ids}|{truth['rate_l_per_ha']:.2f}"
    return hashlib.sha256(key.encode()).hexdigest()


def seed_records():
    """The application system's starting records, as seed.json holds them."""
    fields = []
    for field_id, grower_id, name, area, crop in FIELDS:
        field = {"field_id": field_id, "grower_id": grower_id, "name": name}
        fields.append({**field, "area_ha": area, "crop": crop})
    products = []
    for code, name, max_rate, crops in PRODUCTS:
        product = {"product_code": code, "name": name}
        products.append({**product, "max_rate_l_per_ha": max_rate, "crops": crops})
    return {"growers": GROWERS, "fields": fields, "products": products}


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def write_lines(path, rows):
    lines = [json.dumps(row) for row in rows]
    path.write_text("\n".join(lines) + "\n")


def write_split(randomizer, split, first_number):
    """Write one split's inbox and replies. Returns the desk's truth row for each email."""
    kinds = [kind for kind, count in MIX[split].items() for _ in range(count)]
    randomizer.shuffle(kinds)
    (HERE / "inbox" / split).mkdir()
    truth_rows = []
    ambiguous_turn = 0
    for offset, kind in enumerate(kinds):
        email_id = f"TB-{first_number + offset}"
        email_text, truth, json_reply, prose_reply = make_case(randomizer, kind, ambiguous_turn)
        if kind == "ambiguous_field":
            ambiguous_turn += 1
        (HERE / "inbox" / split / f"{email_id}.txt").write_text(email_text)
        word_count = len(email_text.split())
        recording = {
            "email_id": email_id,
            "json_reply": json_reply,
            "prose_reply": prose_reply,
            "input_tokens": int(word_count * 1.4),
            "output_tokens": 48,
        }
        write_json(HERE / "replay" / f"{email_id}.json", recording)
        truth_rows.append({"email_id": email_id, **truth})
    return truth_rows


def main():
    # A fixed seed, so every run writes exactly the same world.
    randomizer = random.Random(20261112)
    write_json(HERE / "seed.json", seed_records())
    for folder in ("inbox", "truth", "replay"):
        shutil.rmtree(HERE / folder, ignore_errors=True)
        (HERE / folder).mkdir()

    dev_rows = write_split(randomizer, "dev", 1001)
    write_lines(HERE / "truth" / "dev.jsonl", dev_rows)

    # The test answers stay hidden: only a hash of each one is written.
    test_rows = write_split(randomizer, "test", 2001)
    hashes = []
    for row in test_rows:
        hashes.append({"email_id": row["email_id"], "hash": job_hash(row["email_id"], row)})
    write_lines(HERE / "truth" / "test.hashes.jsonl", hashes)
    print("Wrote seed.json, inbox/, truth/ and replay/.")


if __name__ == "__main__":
    main()
