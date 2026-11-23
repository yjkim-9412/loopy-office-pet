"""Regenerate the 128px sprite hit masks after changing an atlas (requires Pillow)."""
import base64
import json
from pathlib import Path
from PIL import Image

assets = Path(__file__).resolve().parents[1] / "assets"
masks = {}
for sheet in sorted((assets / "motions").glob("*.png")):
    masks[sheet.stem] = []
    with Image.open(sheet) as atlas:
        for i in range(atlas.width // 256):
            alpha = atlas.getchannel("A").crop((256*i, 0, 256*i+256, 256))
            alpha = alpha.resize((128, 128), Image.Resampling.LANCZOS)
            bits = alpha.point(lambda a: 255 if a > 35 else 0).convert("1", dither=Image.Dither.NONE)
            masks[sheet.stem].append(base64.b64encode(bits.tobytes()).decode("ascii"))
(assets / "hit.json").write_text(json.dumps(masks, separators=(",", ":")) + "\n", encoding="utf-8")
