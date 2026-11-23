"""Turn a grid of Loopy poses into motion sheets of 256x256 frames, sized like the reference Loopy.

    python scripts/import_sprites.py <grid.png> <motion> [<motion> ...] [--cols 4] [--rows 2] [--scale S]
    python scripts/import_sprites.py <grid.png> <motion> --cols 4 --rows 2 --template
    python scripts/hitmaps.py

* One motion name per row: every row becomes its own sheet (4 frames for a 4-column grid).
* One motion name for a multi-row grid: all cells, read left to right then top to bottom, become
  the frames of that one motion (a 4x2 grid gives an 8-frame sheet).

Faint alpha noise and specks are removed. Every motion is scaled so Loopy's head is as wide as in
assets/motions/idle.png, then placed with the feet on the shared baseline, so a new sheet never
makes Loopy grow or shrink. Pass --scale to override the measured factor for poses whose head is
turned away (profile walks, lying down).

--template is for grids drawn on docs/design/reference/frame-template-4x2.png: each cell is only
shrunk to 256x256, keeping the size and position the artist drew, so every motion made on the
template shares one scale and airborne poses stay in the air.
"""
import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

FRAME, BASELINE, CENTER = 256, 241, 128
motions = Path(__file__).resolve().parents[1] / "assets" / "motions"


def components(mask):
    h, w = mask.shape
    label = np.zeros((h, w), np.int32)
    found = []
    for y, x in zip(*np.nonzero(mask)):
        if label[y, x]:
            continue
        label[y, x] = len(found) + 1
        queue, points = deque([(y, x)]), []
        while queue:
            cy, cx = queue.popleft()
            points.append((cy, cx))
            for ny in (cy - 1, cy, cy + 1):
                for nx in (cx - 1, cx, cx + 1):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not label[ny, nx]:
                        label[ny, nx] = label[y, x]
                        queue.append((ny, nx))
        found.append(points)
    return found


def dehalo(pixels):
    """Clear a half-transparent white backdrop: whitish, not fully opaque pixels connected to the cell edge."""
    alpha = pixels[..., 3]
    rgb = pixels[..., :3].astype(int)
    # near-pure white only, so cream paper, white fur and the belly stay
    wash = (rgb.min(-1) > 232) & (rgb[..., 0] - rgb[..., 2] < 14) & (alpha > 0) & (alpha < 250)
    h, w = wash.shape
    for points in components(wash):
        ys, xs = np.array(points).T
        if ys.min() == 0 or xs.min() == 0 or ys.max() == h - 1 or xs.max() == w - 1:
            pixels[ys, xs] = 0


def clean(cell, halo=False):
    pixels = cell.copy()
    if halo:
        dehalo(pixels)
    alpha = pixels[..., 3]
    alpha[alpha < 48] = 0
    keep = np.zeros(alpha.shape, bool)
    for points in components(alpha > 0):
        ys, xs = np.array(points).T
        if len(points) >= 60 and alpha[ys, xs].mean() >= 140:
            keep[ys, xs] = True
    pixels[~keep] = 0
    return pixels


def head_width(frame, unit=1.0):
    """Widest run of pink fur in the band just under the top of Loopy's head (ears excluded)."""
    r, g, b, a = (frame[..., i].astype(int) for i in range(4))
    fur = (a > 128) & (r > 200) & (g > 100) & (g < 200) & (b > 110) & (b < 210) & (r - g > 40)
    rows = np.nonzero(fur.sum(1) >= 8 * unit)[0]
    if not len(rows):
        return None
    top, best = rows[0], 0
    for y in range(top + round(30 * unit), min(top + round(71 * unit), fur.shape[0])):
        xs = np.nonzero(fur[y])[0]
        if len(xs):
            best = max(best, xs[-1] - xs[0])
    return best or None


def sheet_head(frames, unit=1.0):
    widths = [w for w in (head_width(f, unit) for f in frames) if w]
    return min(widths) if widths else None


def bbox(mask):
    ys, xs = np.nonzero(mask)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def reference_head():
    idle = np.array(Image.open(motions / "idle.png").convert("RGBA"))
    return sheet_head([idle[:, FRAME * i:FRAME * (i + 1)] for i in range(idle.shape[1] // FRAME)])


def save(name, frames):
    sheet = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        pixels = np.array(frame)
        pixels[pixels[..., 3] < 20] = 0
        sheet.paste(Image.fromarray(pixels), (FRAME * i, 0))
    sheet.save(motions / f"{name}.png", optimize=True)


def build_template(name, cells):
    frames = [Image.fromarray(c).resize((FRAME, FRAME), Image.Resampling.LANCZOS) for c in cells]
    save(name, frames)
    print(f"{name}.png  {len(cells)} frames  template scale {FRAME / cells[0].shape[0]:.3f}")


def build(name, cells, scale):
    cw, ch = min(c.shape[1] for c in cells), min(c.shape[0] for c in cells)
    cells = [c[:ch, :cw] for c in cells]
    if scale is None:
        measured = sheet_head(cells, unit=ch / FRAME)
        if not measured:
            raise SystemExit(f"{name}: Loopy's head was not found; pass --scale")
        scale = reference_head() / measured
    boxes = [bbox(c[..., 3] > 0) for c in cells]
    ux0, ux1 = min(b[0] for b in boxes), max(b[2] for b in boxes)
    uy0, uy1 = min(b[1] for b in boxes), max(b[3] for b in boxes)
    scale = min(scale, (FRAME - 6) / (ux1 - ux0), (BASELINE - 2) / (uy1 - uy0))
    ox, oy = round(CENTER - (ux0 + ux1) / 2 * scale), round(BASELINE - uy1 * scale)
    frames = []
    for cell in cells:
        pose = Image.fromarray(cell).resize((round(cw * scale), round(ch * scale)), Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
        frame.alpha_composite(pose, dest=(max(ox, 0), max(oy, 0)), source=(max(-ox, 0), max(-oy, 0)))
        frames.append(frame)
    save(name, frames)
    print(f"{name}.png  {len(cells)} frames  scale {scale:.3f}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("grid")
    parser.add_argument("names", nargs="+")
    parser.add_argument("--cols", type=int, default=4)
    parser.add_argument("--rows", type=int)
    parser.add_argument("--scale", type=float)
    parser.add_argument("--template", action="store_true")
    parser.add_argument("--dehalo", action="store_true", help="remove a half-transparent white backdrop left by the generator")
    args = parser.parse_args()
    rows = args.rows or len(args.names)
    if len(args.names) not in (1, rows):
        raise SystemExit("Give one motion name per row, or one name for the whole grid.")
    source = np.array(Image.open(args.grid).convert("RGBA"))
    height, width = source.shape[:2]
    cells = [[clean(source[round(r * height / rows):round((r + 1) * height / rows),
                           round(c * width / args.cols):round((c + 1) * width / args.cols)], args.dehalo)
              for c in range(args.cols)] for r in range(rows)]
    make = (lambda n, c: build_template(n, c)) if args.template else (lambda n, c: build(n, c, args.scale))
    if len(args.names) == 1 and rows > 1:
        make(args.names[0], [cell for row in cells for cell in row])
    else:
        for name, row in zip(args.names, cells):
            make(name, row)


if __name__ == "__main__":
    main()
