#!/usr/bin/env python3
"""Apply a deliberately small, reviewed batch of WebP badges on the performance branch."""
from pathlib import Path
import io
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "badges/level-team-1.webp",
    "badges/eggs-2.webp",
    "badges/variety-1.webp",
    "badges/challenges-2.webp",
    "badges/eggs-3.webp",
    "badges/watch-global-4.webp",
]
for relative in FILES:
    path = ROOT / "public" / relative
    with Image.open(path) as source:
        if getattr(source, "n_frames", 1) != 1:
            raise ValueError(f"Animated image not eligible: {relative}")
        original_size = source.size
        original_alpha = source.convert("RGBA").getchannel("A").getextrema()
        img = source.convert("RGBA" if "A" in source.getbands() or "transparency" in source.info else "RGB")
        result = io.BytesIO()
        img.save(result, format="WEBP", quality=84, method=4)
        compressed = result.getvalue()
    if len(compressed) >= path.stat().st_size * 0.85:
        raise ValueError(f"Unexpected savings below 15%: {relative}")
    with Image.open(io.BytesIO(compressed)) as verify:
        if verify.size != original_size or verify.convert("RGBA").getchannel("A").getextrema() != original_alpha:
            raise ValueError(f"Image dimensions/alpha changed: {relative}")
    old = path.stat().st_size
    path.write_bytes(compressed)
    print(f"{relative}: {old} -> {len(compressed)} bytes")
