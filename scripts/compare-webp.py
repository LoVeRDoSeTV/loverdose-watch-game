#!/usr/bin/env python3
"""Create a compact before/after comparison of largest WebP savings."""
from pathlib import Path
import csv
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "image-optimization-review"
PUBLIC = ROOT / "public"
rows = list(csv.DictReader((OUT / "image-report.csv").open(encoding="utf-8")))
eligible = [r for r in rows if r["action"] == "candidate_review"]
eligible.sort(key=lambda r: int(r["original_bytes"]) - int(r["proposed_bytes"]), reverse=True)
eligible = eligible[:36]
W, CELL_H, THUMB_W, THUMB_H = 720, 176, 270, 140
canvas = Image.new("RGB", (W, max(1, len(eligible)) * CELL_H + 44), "#1b2133")
draw = ImageDraw.Draw(canvas)
draw.text((12, 10), "Comparatif WebP - original (gauche) / candidat (droite)", fill="white")
for idx, row in enumerate(eligible):
    top = 44 + idx * CELL_H
    draw.text((12, top), f"{row['file'][:68]} | gain {row['saving_percent']}%", fill="#eae4ff")
    for x, source in [(12, PUBLIC / row["file"]), (366, OUT / "candidates" / row["file"])]:
        with Image.open(source) as im:
            im = im.convert("RGBA")
            im.thumbnail((THUMB_W, THUMB_H), Image.Resampling.LANCZOS)
            tile = Image.new("RGB", (THUMB_W, THUMB_H), "#373c4b")
            # Checkerboard to reveal transparency differences.
            p = ImageDraw.Draw(tile)
            for py in range(0, THUMB_H, 16):
                for px in range(0, THUMB_W, 16):
                    if (px // 16 + py // 16) % 2 == 0:
                        p.rectangle((px, py, px + 15, py + 15), fill="#596070")
            tile.paste(im, ((THUMB_W - im.width)//2, (THUMB_H - im.height)//2), im)
            canvas.paste(tile, (x, top + 20))
    draw.line((12, top + CELL_H - 5, W - 12, top + CELL_H - 5), fill="#626779")
canvas.save(OUT / "comparatif-avant-apres.jpg", quality=88, optimize=True)
print(f"Generated visual review of {len(eligible)} largest-savings candidates.")
