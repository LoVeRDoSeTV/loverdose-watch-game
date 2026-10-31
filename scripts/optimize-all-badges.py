#!/usr/bin/env python3
"""Optimize remaining badge WebPs on the isolated performance branch only."""
from pathlib import Path
import io
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/"public/badges"
changed=[]
before=after=0
for path in sorted(folder.glob("*.webp")):
    with Image.open(path) as source:
        if getattr(source,"n_frames",1)!=1:
            continue
        dims=source.size
        alpha=source.convert("RGBA").getchannel("A").getextrema()
        original=path.read_bytes()
        im=source.convert("RGBA" if "A" in source.getbands() or "transparency" in source.info else "RGB")
        output=io.BytesIO()
        im.save(output,format="WEBP",quality=84,method=4)
        proposal=output.getvalue()
    if len(proposal)>len(original)*0.85:
        continue
    with Image.open(io.BytesIO(proposal)) as candidate:
        if candidate.size!=dims or candidate.convert("RGBA").getchannel("A").getextrema()!=alpha:
            raise ValueError("Dimensions/transparence changées: "+path.name)
    path.write_bytes(proposal)
    changed.append(str(path.relative_to(ROOT)))
    before+=len(original)
    after+=len(proposal)
print(f"Changed {len(changed)} badges: {before:,} -> {after:,} bytes; saved {before-after:,} bytes")
(ROOT/"badge-changes.txt").write_text("\n".join(changed)+"\n",encoding="utf-8")
