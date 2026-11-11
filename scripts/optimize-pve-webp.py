#!/usr/bin/env python3
"""Conservative PvE WebP re-encode; preserve dimensions and alpha channel."""
from pathlib import Path
from PIL import Image, ImageChops
import io
ROOT=Path(__file__).resolve().parents[1]
files=sorted((ROOT/'public/pve').rglob('*.webp'))
changed=[]
total_before=total_after=0
for path in files:
    source_bytes=path.read_bytes()
    total_before+=len(source_bytes)
    with Image.open(io.BytesIO(source_bytes)) as source:
        if getattr(source,'n_frames',1)!=1:
            total_after+=len(source_bytes)
            continue
        bands=source.getbands()
        mode='RGBA' if 'A' in bands or 'transparency' in source.info else 'RGB'
        before=source.convert(mode)
        dimensions=before.size
        alpha=before.getchannel('A') if mode=='RGBA' else None
        data=io.BytesIO()
        before.save(data,'WEBP',quality=88,method=3)
        proposed=data.getvalue()
    if len(proposed) >= len(source_bytes)*0.80:
        total_after+=len(source_bytes)
        continue
    print('candidate',path.relative_to(ROOT),len(source_bytes),'->',len(proposed),flush=True)
    with Image.open(io.BytesIO(proposed)) as verify:
        after=verify.convert(mode)
        assert after.size==dimensions,(path,'dimensions')
        if alpha is not None:
            # Exact transparency mask, not only alpha extrema.
            assert ImageChops.difference(alpha,after.getchannel('A')).getbbox() is None,(path,'alpha mismatch')
    path.write_bytes(proposed)
    total_after+=len(proposed)
    changed.append(str(path.relative_to(ROOT)))
print('PvE files',len(files),'optimized',len(changed),'bytes',total_before,'->',total_after,'saved',total_before-total_after)
(ROOT/'pve-webp-changes.txt').write_text('\n'.join(changed)+'\n',encoding='utf-8')
