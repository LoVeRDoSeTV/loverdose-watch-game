#!/usr/bin/env python3
"""Compare WebP originals and candidates; flag transparency and dimension changes."""
from pathlib import Path
import csv
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "image-optimization-review"
PUBLIC = ROOT / "public"

rows = list(csv.DictReader((OUT / "image-report.csv").open(encoding="utf-8")))
issues = []
checked = 0
for row in rows:
    if row["action"] != "candidate_review":
        continue
    original = PUBLIC / row["file"]
    candidate = OUT / "candidates" / row["file"]
    with Image.open(original) as src, Image.open(candidate) as dst:
        checked += 1
        if src.size != dst.size:
            issues.append(f"{row['file']}: dimensions differ")
        a = src.convert("RGBA").getchannel("A")
        b = dst.convert("RGBA").getchannel("A")
        if a.getextrema() != b.getextrema():
            issues.append(f"{row['file']}: alpha range differs")
        if (a.getbbox() is None) != (b.getbbox() is None):
            issues.append(f"{row['file']}: alpha coverage differs")

report = OUT / "technical-validation.txt"
report.write_text(
    f"Checked: {checked} WebP candidates\n"
    + ("\n".join(issues) if issues else "All candidates retain image dimensions and compatible alpha ranges.")
    + "\nManual visual approval is still required.\n",
    encoding="utf-8",
)
print(report.read_text(encoding="utf-8"))
if issues:
    raise SystemExit(f"{len(issues)} structural image differences require review")
