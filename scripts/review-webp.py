#!/usr/bin/env python3
"""Build a reviewable WebP optimization report, never overwrite original assets."""
from __future__ import annotations

import argparse
import csv
import io
from pathlib import Path
from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
MIN_SAVINGS = 0.15


def collect(quality: int, output: Path) -> tuple[int, int]:
    output.mkdir(parents=True, exist_ok=True)
    rows = []
    original_total = candidate_total = 0
    for path in sorted(PUBLIC.rglob("*.webp")):
        original_size = path.stat().st_size
        original_total += original_size
        relative = path.relative_to(PUBLIC)
        row = dict(file=str(relative), original_bytes=original_size,
                   proposed_bytes="", saving_percent="", action="unchanged")
        try:
            with Image.open(path) as img:
                if getattr(img, "n_frames", 1) > 1:
                    row["action"] = "skip_animated"
                else:
                    # Keep pixel dimensions and the alpha channel unchanged.
                    im = img.convert("RGBA" if "A" in img.getbands() or "transparency" in img.info else "RGB")
                    buf = io.BytesIO()
                    im.save(buf, format="WEBP", quality=quality, method=6)
                    proposed = buf.getvalue()
                    row["proposed_bytes"] = len(proposed)
                    row["saving_percent"] = round(100 * (1 - len(proposed) / original_size), 1)
                    if len(proposed) <= original_size * (1 - MIN_SAVINGS):
                        target = output / "candidates" / relative
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_bytes(proposed)
                        candidate_total += len(proposed)
                        row["action"] = "candidate_review"
        except (OSError, ValueError, UnidentifiedImageError):
            row["action"] = "unreadable"
        rows.append(row)
    with (output / "image-report.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["file", "original_bytes", "proposed_bytes", "saving_percent", "action"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Scanned {len(rows)} WebP images, original total {original_total:,} bytes.")
    print(f"Created {sum(r['action'] == 'candidate_review' for r in rows)} review candidates ({candidate_total:,} bytes).")
    return len(rows), candidate_total


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--quality", type=int, default=84)
    parser.add_argument("--output", type=Path, default=ROOT / "image-optimization-review")
    args = parser.parse_args()
    if not 1 <= args.quality <= 100:
        parser.error("quality must be between 1 and 100")
    collect(args.quality, args.output)
