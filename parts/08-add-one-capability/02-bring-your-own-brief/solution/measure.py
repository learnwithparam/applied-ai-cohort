"""Read cases.csv and print the three numbers a brief can use. Pass another file name to use it."""

import csv
import json
import sys


def measure(path):
    with open(path, newline="") as lines:
        rows = list(csv.DictReader(lines))
    correct = [row for row in rows if row["correct"].strip().lower() == "yes"]
    total_cost = sum(float(row["cost_usd"]) for row in rows)
    result = {
        "cases": len(rows),
        "share_correct": round(len(correct) / len(rows), 4),
        "total_cost_usd": round(total_cost, 6),
    }
    if correct:
        result["cost_per_correct_usd"] = round(total_cost / len(correct), 6)
    return result


if __name__ == "__main__":
    print(json.dumps(measure(sys.argv[1] if len(sys.argv) > 1 else "cases.csv")))
