"""Convert uipro CSVs to a single data.js bundle (window.UIPRO_DATA).

Runs locally: `python build_data.py` inside this folder.
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_DIR = os.path.abspath(
    os.path.join(HERE, "..", ".claude", "skills", "ui-ux-pro-max", "data")
)

FILES = {
    "products": "products.csv",
    "styles": "styles.csv",
    "colors": "colors.csv",
    "landing": "landing.csv",
    "typography": "typography.csv",
}


def load_csv(name: str):
    path = os.path.join(CSV_DIR, name)
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    bundle = {key: load_csv(fname) for key, fname in FILES.items()}
    out = os.path.join(HERE, "data.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write("window.UIPRO_DATA = ")
        json.dump(bundle, f, ensure_ascii=False)
        f.write(";\n")
    counts = {k: len(v) for k, v in bundle.items()}
    print("Wrote", out)
    print("Counts:", counts)


if __name__ == "__main__":
    main()
