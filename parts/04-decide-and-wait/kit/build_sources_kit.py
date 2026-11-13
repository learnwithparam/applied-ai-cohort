"""Builds the documents, labelled questions and the answer role's replay, copied from part three.

    python3 parts/04-decide-and-wait/kit/build_sources_kit.py

The output is committed. Run this only to change the documents or questions, then commit.

The documents are the co-op's six product labels and four of its own guides. A label's second
page never repeats the product's name, as on many real labels. That is the planted trap for
search: a question about "Pulsepath" finds Pulsepath's first page, not the page that answers it.
"""

import hashlib
import json
from pathlib import Path

KIT = Path(__file__).resolve().parent

# name, code, use, crops, highest rate, water, timing,
# then the second page: rainfast, re-entry, days before harvest, buffer metres.
PRODUCTS = [
    {
        "name": "Glyfallow 540",
        "code": "P100",
        "use": "a herbicide that clears weeds before the crop comes up",
        "crops": "wheat, barley, canola, lentils and peas",
        "highest": "3.0",
        "water": "100",
        "timing": "Spray before seeding or after harvest, on weeds that are growing well.",
        "rainfast": "6 hours",
        "reentry": "12 hours",
        "harvest": "7",
        "buffer": "10",
    },
    {
        "name": "Brasslock",
        "code": "P110",
        "use": "a herbicide for grass weeds in canola",
        "crops": "canola",
        "highest": "1.0",
        "water": "80",
        "timing": "Spray from the two-leaf stage until the canola starts to bolt.",
        "rainfast": "1 hour",
        "reentry": "24 hours",
        "harvest": "60",
        "buffer": "5",
    },
    {
        "name": "Tillerguard",
        "code": "P120",
        "use": "a fungicide for leaf disease in cereals",
        "crops": "wheat and barley",
        "highest": "0.8",
        "water": "120",
        "timing": "Spray at the first sign of disease, from the three-leaf stage.",
        "rainfast": "2 hours",
        "reentry": "18 hours",
        "harvest": "45",
        "buffer": "15",
    },
    {
        "name": "Pulsepath",
        "code": "P130",
        "use": "a herbicide for broadleaf weeds in pulse crops",
        "crops": "lentils and peas",
        "highest": "1.2",
        "water": "60",
        "timing": "Spray when the weeds are small and before the crop flowers.",
        "rainfast": "4 hours",
        "reentry": "48 hours",
        "harvest": "30",
        "buffer": "20",
    },
    {
        "name": "Stemsure",
        "code": "P140",
        "use": "a growth regulator that keeps stems short and strong",
        "crops": "wheat, barley and canola",
        "highest": "0.75",
        "water": "90",
        "timing": "Spray once, before the crop reaches the flag leaf stage.",
        "rainfast": "3 hours",
        "reentry": "36 hours",
        "harvest": "50",
        "buffer": "3",
    },
    {
        "name": "Podshield",
        "code": "P150",
        "use": "a fungicide that protects pods from disease",
        "crops": "lentils and peas",
        "highest": "0.5",
        "water": "150",
        "timing": "Spray at early flowering, and again 14 days later if the weather stays wet.",
        "rainfast": "30 minutes",
        "reentry": "8 hours",
        "harvest": "21",
        "buffer": "25",
    },
]

STORAGE = "Storage. Keep the container closed, upright and above 5 degrees. Never reuse it."

GUIDES = {
    "spray-guide": (
        "Tallgrass Bend spray guide",
        [
            [
                "Rates per acre and per hectare. One hectare is 2.471 acres. Some growers write "
                "rates per acre.",
                "To turn L per acre into L/ha, multiply by 2.471. For example, 0.97 L per acre "
                "is 2.4 L/ha. The desk always books rates in L/ha.",
            ],
            [
                "Wind and drift. Do not spray when the wind is above 15 km/h. Fine drops drift "
                "onto the next field.",
                "Do not spray when the wind is below 3 km/h either. Still air can hold a cloud of "
                "spray that moves later. Brasslock and Glyfallow 540 harm canola and pulses "
                "next door if they drift.",
            ],
            [
                "Rain and dew. Rain soon after spraying washes product off the leaf. Check the "
                "rainfast time on each label before you spray.",
                "Heavy dew can also dilute a spray. Glyfallow 540 and Pulsepath need a longer dry "
                "spell than Podshield. Tillerguard and Stemsure fall in between.",
            ],
        ],
    ),
    "desk-notes": (
        "Spray desk notes on common questions",
        [
            [
                "Glyfallow 540 and Brasslock questions. Growers often ask how long Glyfallow 540 "
                "and Brasslock must stay dry, how close to harvest they can go on, and the buffer "
                "zone near water. Read the second page of each label.",
                "Growers also ask when people can walk back into a field after Glyfallow 540 or "
                "Brasslock, and how much water each needs per hectare.",
            ],
            [
                "Tillerguard and Stemsure questions. Growers often ask how long Tillerguard and "
                "Stemsure must stay dry after spraying, the buffer zone near a creek, and how many "
                "days before harvest the last spray can be.",
                "Growers also ask when people can go back into a field after Tillerguard or "
                "Stemsure, and the highest rate on wheat.",
            ],
            [
                "Pulsepath and Podshield questions. Growers often ask how long Pulsepath and "
                "Podshield must stay dry, how close to harvest they can go on, and the buffer zone "
                "near a wetland or water.",
                "Growers also ask when people can walk into a field sprayed with Pulsepath or "
                "Podshield, and how much water per hectare to use.",
            ],
        ],
    ),
    "tank-mix-guide": (
        "Tallgrass Bend tank mix guide",
        [
            [
                "Which products mix. Glyfallow 540 mixes with Tillerguard and with Stemsure in "
                "one tank.",
                "Pulsepath mixes with Podshield. Brasslock must go on alone, with no other "
                "product in the tank.",
            ],
            [
                "Order of mixing. Fill the tank half full of water first. Add each product with "
                "the agitator running.",
                "Cleaning the tank. Rinse the tank three times after Brasslock or Pulsepath, "
                "before the sprayer goes onto another crop.",
            ],
        ],
    ),
    "crop-stage-guide": (
        "Tallgrass Bend crop stage guide",
        [
            [
                "Cereals. Tillerguard goes on wheat and barley from the three-leaf stage. "
                "Stemsure goes on before the flag leaf.",
                "Glyfallow 540 never goes on a cereal crop that has come up. Use it before "
                "seeding or after harvest.",
            ],
            [
                "Pulses and canola. Pulsepath and Podshield go on lentils and peas. Pulsepath "
                "goes on before flowering, Podshield at early flowering.",
                "Brasslock goes on canola before bolting. Stemsure also suits canola.",
            ],
        ],
    ),
}

# id, question, the document and page that answer it, the passage text that supports the
# answer, the answer, and the answer a model gives when it guesses.
# The model cites the wrong passage on these questions, even when the right one is there.
WRONG_CITATIONS = {"Q-D04", "Q-D13", "Q-T04"}

# The model cites the wrong passage on these questions, even when the right one is there.
WRONG_CITATIONS = {"Q-D04", "Q-D13", "Q-T04"}
DEV_QUESTIONS = [
    (
        "Q-D01",
        "What is the highest rate of Pulsepath on lentils?",
        "pulsepath-label",
        1,
        "Highest rate: 1.2 L/ha",
        "The highest rate of Pulsepath on lentils is 1.2 L/ha.",
        "Pulsepath goes on lentils at up to 1.5 L/ha.",
    ),
    (
        "Q-D02",
        "How much Glyfallow 540 can I put on barley at most?",
        "glyfallow-540-label",
        1,
        "Highest rate: 3.0 L/ha",
        "Glyfallow 540 goes on barley at up to 3.0 L/ha.",
        "Glyfallow 540 goes on barley at up to 2.0 L/ha.",
    ),
    (
        "Q-D03",
        "How long must Glyfallow 540 stay dry after spraying?",
        "glyfallow-540-label",
        2,
        "Rainfast after 6 hours",
        "It must stay dry for 6 hours after spraying.",
        "It must stay dry for 1 hour after spraying.",
    ),
    (
        "Q-D04",
        "How long after spraying Brasslock can people walk into the field?",
        "brasslock-label",
        2,
        "for 24 hours",
        "People must stay out for 24 hours.",
        "People can walk in after 4 hours.",
    ),
    (
        "Q-D05",
        "How many days before harvest must the last Tillerguard spray be?",
        "tillerguard-label",
        2,
        "within 45 days",
        "The last spray must be 45 days before harvest.",
        "The last spray must be 14 days before harvest.",
    ),
    (
        "Q-D06",
        "What buffer zone does Stemsure need near water?",
        "stemsure-label",
        2,
        "Leave 3 metres",
        "Leave 3 metres unsprayed next to water.",
        "Leave 30 metres unsprayed next to water.",
    ),
    (
        "Q-D07",
        "How much water per hectare should I use with Podshield?",
        "podshield-label",
        1,
        "Use 150 L of water",
        "Use 150 L of water per hectare.",
        "Use 200 L of water per hectare.",
    ),
    (
        "Q-D08",
        "How do I turn a rate in litres per acre into L/ha?",
        "spray-guide",
        1,
        "multiply by 2.471",
        "Multiply the rate per acre by 2.471.",
        "Multiply the rate per acre by 0.4.",
    ),
    (
        "Q-D09",
        "Can I mix Brasslock with other products in one tank?",
        "tank-mix-guide",
        1,
        "Brasslock must go on alone",
        "No. Brasslock must go on alone.",
        "Yes, Brasslock mixes with 2 other products.",
    ),
    (
        "Q-D10",
        "What is the top wind speed for spraying?",
        "spray-guide",
        2,
        "above 15 km/h",
        "Do not spray when the wind is above 15 km/h.",
        "Do not spray when the wind is above 25 km/h.",
    ),
    (
        "Q-D11",
        "How long must Pulsepath stay dry after spraying?",
        "pulsepath-label",
        2,
        "Rainfast after 4 hours",
        "It must stay dry for 4 hours.",
        "It must stay dry for 8 hours.",
    ),
    (
        "Q-D12",
        "How long after a Stemsure spray must people stay out of the field?",
        "stemsure-label",
        2,
        "for 36 hours",
        "People must stay out for 36 hours.",
        "People must stay out for 6 hours.",
    ),
    (
        "Q-D13",
        "How close to harvest can I spray Podshield?",
        "podshield-label",
        2,
        "within 21 days",
        "The last Podshield spray must be 21 days before harvest.",
        "The last Podshield spray must be 10 days before harvest.",
    ),
    (
        "Q-D14",
        "What buffer zone does Glyfallow 540 need next to a creek?",
        "glyfallow-540-label",
        2,
        "Leave 10 metres",
        "Leave 10 metres unsprayed next to the creek.",
        "Leave 50 metres unsprayed next to the creek.",
    ),
    (
        "Q-D15",
        "What is the highest rate of Tillerguard on wheat?",
        "tillerguard-label",
        1,
        "Highest rate: 0.8 L/ha",
        "The highest rate of Tillerguard on wheat is 0.8 L/ha.",
        "The highest rate of Tillerguard on wheat is 1.25 L/ha.",
    ),
    (
        "Q-D16",
        "How much water per hectare does Brasslock need?",
        "brasslock-label",
        1,
        "Use 80 L of water",
        "Use 80 L of water per hectare.",
        "Use 110 L of water per hectare.",
    ),
    (
        "Q-D17",
        "When is Brasslock rainfast?",
        "brasslock-label",
        2,
        "Rainfast after 1 hour",
        "Brasslock is rainfast after 1 hour.",
        "Brasslock is rainfast after 5 hours.",
    ),
    (
        "Q-D18",
        "How many days before harvest is the last Pulsepath spray allowed?",
        "pulsepath-label",
        2,
        "within 30 days",
        "The last spray must be 30 days before harvest.",
        "The last spray must be 9 days before harvest.",
    ),
    (
        "Q-D19",
        "What buffer zone does Podshield need near a wetland?",
        "podshield-label",
        2,
        "Leave 25 metres",
        "Leave 25 metres unsprayed next to the wetland.",
        "Leave 40 metres unsprayed next to the wetland.",
    ),
    (
        "Q-D20",
        "How long must Tillerguard stay dry after spraying?",
        "tillerguard-label",
        2,
        "Rainfast after 2 hours",
        "It must stay dry for 2 hours.",
        "It must stay dry for 7 hours.",
    ),
]

TEST_QUESTIONS = [
    (
        "Q-T01",
        "What is the highest rate of Stemsure on canola?",
        "stemsure-label",
        1,
        "Highest rate: 0.75 L/ha",
        "The highest rate of Stemsure on canola is 0.75 L/ha.",
        "The highest rate of Stemsure on canola is 1.75 L/ha.",
    ),
    (
        "Q-T02",
        "How long must people stay out of a field after a Glyfallow 540 spray?",
        "glyfallow-540-label",
        2,
        "for 12 hours",
        "Workers must stay out for 12 hours.",
        "Workers can go back after 2 hours.",
    ),
    (
        "Q-T03",
        "How many days before harvest must the last Brasslock spray be?",
        "brasslock-label",
        2,
        "within 60 days",
        "The last spray must be 60 days before harvest.",
        "The last spray must be 20 days before harvest.",
    ),
    (
        "Q-T04",
        "What buffer zone does Pulsepath need next to water?",
        "pulsepath-label",
        2,
        "Leave 20 metres",
        "Leave 20 metres unsprayed next to water.",
        "Leave 2 metres unsprayed next to water.",
    ),
    (
        "Q-T05",
        "How much water per hectare should I use with Tillerguard?",
        "tillerguard-label",
        1,
        "Use 120 L of water",
        "Use 120 L of water per hectare.",
        "Use 70 L of water per hectare.",
    ),
    (
        "Q-T06",
        "Below what wind speed should I not spray?",
        "spray-guide",
        2,
        "below 3 km/h",
        "Do not spray when the wind is below 3 km/h.",
        "Do not spray when the wind is below 8 km/h.",
    ),
    (
        "Q-T07",
        "How long must people stay out of a field sprayed with Podshield?",
        "podshield-label",
        2,
        "for 8 hours",
        "People must stay out for 8 hours.",
        "People must stay out for 3 hours.",
    ),
    (
        "Q-T08",
        "When is Podshield rainfast?",
        "podshield-label",
        2,
        "Rainfast after 30 minutes",
        "Podshield is rainfast after 30 minutes.",
        "Podshield is rainfast after 90 minutes.",
    ),
    (
        "Q-T09",
        "How long must Stemsure stay dry after spraying?",
        "stemsure-label",
        2,
        "Rainfast after 3 hours",
        "It must stay dry for 3 hours.",
        "It must stay dry for 12 hours.",
    ),
    (
        "Q-T10",
        "How much water per hectare does Glyfallow 540 need?",
        "glyfallow-540-label",
        1,
        "Use 100 L of water",
        "Use 100 L of water per hectare.",
        "Use 40 L of water per hectare.",
    ),
]

# Questions the documents do not answer, and the answer a model gives when it guesses.
OUT_OF_SCOPE = {
    "dev": [
        (
            "Q-O01",
            "What does Brasslock cost per litre?",
            "Brasslock costs about the same as other canola products.",
        ),
        (
            "Q-O02",
            "Can the co-op deliver Stemsure to my farm?",
            "Yes, the co-op delivers Stemsure to members.",
        ),
        ("Q-O03", "Will it rain in Tallgrass Bend tomorrow?", "No, the forecast is dry."),
        (
            "Q-O04",
            "Who is the co-op's agronomist?",
            "The agronomist is the person who signs the labels.",
        ),
        (
            "Q-O05",
            "What time does the spray desk open?",
            "The spray desk opens early in the morning.",
        ),
        ("Q-O06", "Is Glyfallow 540 safe for my dog?", "Yes, it is safe once it is dry."),
        (
            "Q-O07",
            "How do I fix a blocked nozzle on my sprayer?",
            "Take the nozzle off and soak it in warm water.",
        ),
        (
            "Q-O08",
            "What price will wheat fetch this season?",
            "Wheat prices look strong this season.",
        ),
        (
            "Q-O09",
            "Can I get a discount on Podshield?",
            "Yes, members get a discount on Podshield.",
        ),
        ("Q-O10", "Which bank does the co-op use?", "The co-op banks with a local credit union."),
    ],
    "test": [
        (
            "Q-O11",
            "How much does Tillerguard cost?",
            "Tillerguard costs less than most fungicides.",
        ),
        ("Q-O12", "Does the co-op sell seed?", "Yes, the co-op sells seed for every crop."),
        (
            "Q-O13",
            "What is the phone number of the spray desk?",
            "Call the main office and ask for the desk.",
        ),
        ("Q-O14", "Can I pay for spraying by card?", "Yes, the co-op takes every card."),
        (
            "Q-O15",
            "Which company makes Pulsepath?",
            "Pulsepath is made by a large chemical company.",
        ),
    ],
}


def slug(name: str) -> str:
    return name.lower().replace(" ", "-")


def label_pages(product: dict) -> list[list[str]]:
    """A product label: the first page names the product, the second page does not."""
    name = product["name"]
    first_page = [
        f"{name} product label. {name} is {product['use']}. Co-op code {product['code']}.",
        f"Crops and rate. Apply {name} on {product['crops']}. "
        f"Highest rate: {product['highest']} L/ha in one season.",
        f"Water. Use {product['water']} L of water per hectare with {name}.",
        f"Timing. {product['timing']}",
    ]
    second_page = [
        f"Rain. The spray must stay dry on the leaf. Rainfast after {product['rainfast']}. "
        "Do not spray if rain is likely sooner.",
        f"Re-entry. Keep people out of the treated field for {product['reentry']} after spraying.",
        f"Harvest. Do not spray within {product['harvest']} days of harvest.",
        f"Buffer zone. Leave {product['buffer']} metres unsprayed next to water and wetlands.",
        STORAGE,
    ]
    return [first_page, second_page]


def document_text(title: str, pages: list[list[str]]) -> str:
    """A document as text: a title line, then each page after a page marker."""
    lines = [f"Title: {title}"]
    for number, paragraphs in enumerate(pages, start=1):
        lines.append(f"--- page {number} ---")
        lines.append("\n\n".join(paragraphs))
    return "\n".join(lines) + "\n"


def all_documents() -> dict[str, tuple[str, list[list[str]]]]:
    documents = {}
    for product in PRODUCTS:
        documents[f"{slug(product['name'])}-label"] = (
            f"{product['name']} product label",
            label_pages(product),
        )
    documents.update(GUIDES)
    return documents


def check_support(documents: dict, doc_id: str, page: int, support: str) -> None:
    """Every support text must sit on exactly one page, the one the question names."""
    pages_with_it = []
    for other_id, (_title, pages) in documents.items():
        for number, paragraphs in enumerate(pages, start=1):
            if support in "\n\n".join(paragraphs):
                pages_with_it.append((other_id, number))
    if pages_with_it != [(doc_id, page)]:
        raise ValueError(f'"{support}" is on {pages_with_it}, not only on {doc_id} page {page}')


def page_hash(question_id: str, doc_id: str, page: int) -> str:
    """The test split keeps only this hash of each answer page, so it can be scored unread."""
    return hashlib.sha256(f"{question_id}|{doc_id}|{page}".encode()).hexdigest()


def question_rows(questions, documents, split: str) -> tuple[list[dict], list[dict]]:
    """The questions a learner's system reads, and the replay answers for them."""
    rows = []
    recordings = []
    for question_id, question, doc_id, page, support, answer, guess in questions:
        check_support(documents, doc_id, page, support)
        row = {"question_id": question_id, "question": question}
        if split == "dev":
            row["pages"] = [{"doc_id": doc_id, "page": page}]
        else:
            row["page_hashes"] = [page_hash(question_id, doc_id, page)]
        rows.append(row)
        recording = {"question": question, "support": support, "answer": answer, "guess": guess}
        recording["cites_wrong_passage"] = question_id in WRONG_CITATIONS
        recordings.append(recording)
    return rows, recordings


def write_lines(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(row) for row in rows]
    path.write_text("\n".join(lines) + "\n")


def write_documents(documents: dict) -> None:
    folder = KIT / "documents"
    folder.mkdir(exist_ok=True)
    for doc_id, (title, pages) in documents.items():
        (folder / f"{doc_id}.txt").write_text(document_text(title, pages))


def main() -> None:
    documents = all_documents()
    write_documents(documents)
    all_recordings = []
    for split, questions in (("dev", DEV_QUESTIONS), ("test", TEST_QUESTIONS)):
        rows, recordings = question_rows(questions, documents, split)
        write_lines(KIT / "questions" / f"{split}.jsonl", rows)
        all_recordings.extend(recordings)
    for split, questions in OUT_OF_SCOPE.items():
        rows = []
        for question_id, question, guess in questions:
            rows.append({"question_id": question_id, "question": question})
            all_recordings.append({"question": question, "support": None, "guess": guess})
        write_lines(KIT / "questions" / f"out-of-scope-{split}.jsonl", rows)
    write_lines(KIT / "answer-replay.jsonl", all_recordings)
    print("Wrote documents/, questions/ and answer-replay.jsonl.")


if __name__ == "__main__":
    main()
