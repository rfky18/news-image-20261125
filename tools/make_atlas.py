#!/usr/bin/env python3
"""Build-time font atlas for repo-frontpage.

Renders glyphs from the real OFL TTFs in assets/ into assets/atlas.png
(greyscale alpha) + assets/atlas.json (glyph metrics). Run once at build
time; main.ts is stdlib-only Node and only blits the atlas.
"""
import json
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")

FONTS = {
    "bodoni": "BodoniModa-Bold.ttf",
    "bask": "LibreBaskerville-Bold.ttf",
    "baskit": "LibreBaskerville-Italic.ttf",
    "baskreg": "LibreBaskerville-Regular.ttf",
    "gelb": "Gelasio-Bold.ttf",
    "gel": "Gelasio-Regular.ttf",
    "sansb": "LiberationSans-Bold.ttf",
    "sans": "LiberationSans-Regular.ttf",
}

# (font key, pixel size) pairs actually used by main.ts
SPECS = [
    ("bodoni", 58), ("bodoni", 20),
    ("bask", 30), ("bask", 22), ("bask", 19), ("bask", 17),
    ("baskit", 14),
    ("gelb", 12), ("gelb", 11),
    ("gel", 12), ("gel", 11),
    ("sansb", 13), ("sansb", 12), ("sansb", 11), ("sansb", 10), ("sansb", 9),
    ("sans", 11), ("sans", 10), ("sans", 9),
]

CHARS = "".join(chr(c) for c in range(32, 127))
CHARS += "\u2014\u2019\u2018\u201c\u201d\u00b7\u2212\u00d7\u2026\u2192\u00a3"

PAD = 2
ATLAS_W = 2048

def main():
    glyphs = {}
    # measure pass: collect per-spec glyph boxes
    rows = []  # (spec_key, [(char, img, bbox...)])
    for fname, size in SPECS:
        key = f"{fname}:{size}"
        font = ImageFont.truetype(os.path.join(ASSETS, FONTS[fname]), size)
        fb = ImageFont.truetype(os.path.join(ASSETS, FONTS["sans"]), size)
        items = []
        for ch in CHARS:
            # render on temp tile, crop to ink bbox
            tmp = Image.new("L", (size * 3, size * 3), 0)
            d = ImageDraw.Draw(tmp)
            d.text((size, size), ch, font=font, fill=255)
            bbox = tmp.getbbox()
            use_font = font
            if bbox is None and ch != " ":
                # glyph missing in this face: fall back to Gelasio
                d.text((size, size), ch, font=fb, fill=255)
                bbox = tmp.getbbox()
                use_font = fb
            if bbox is None:
                items.append((ch, None, font.getlength(ch), 0, 0))
                continue
            tile = tmp.crop(bbox)
            items.append((ch, tile, use_font.getlength(ch),
                          bbox[0] - size, bbox[1] - size))
        rows.append((key, items, font))

    # pack pass
    atlas_h = 0
    packed = {}  # spec_key -> {char: [x,y,w,h,adv,xoff,yoff]}
    y = PAD
    atlas = Image.new("L", (ATLAS_W, 4096), 0)
    for key, items, font in rows:
        x = PAD
        row_h = 0
        packed[key] = {}
        # ascent/descent for baseline anchoring
        asc, desc = font.getmetrics()
        for ch, tile, adv, xoff, yoff in items:
            if tile is None:
                packed[key][ch] = [0, 0, 0, 0, int(round(adv)), 0, 0]
                continue
            w, h = tile.size
            if x + w + PAD > ATLAS_W:
                x = PAD
                y += row_h + PAD
                row_h = 0
            atlas.paste(tile, (x, y))
            packed[key][ch] = [x, y, w, h, int(round(adv)), xoff, yoff]
            x += w + PAD
            row_h = max(row_h, h)
        y += row_h + PAD
    atlas_h = y
    atlas = atlas.crop((0, 0, ATLAS_W, atlas_h))
    atlas.save(os.path.join(ASSETS, "atlas.png"))
    # metrics: ascents per spec
    metrics = {}
    for fname, size in SPECS:
        font = ImageFont.truetype(os.path.join(ASSETS, FONTS[fname]), size)
        asc, desc = font.getmetrics()
        metrics[f"{fname}:{size}"] = {"asc": asc, "desc": desc, "size": size}
    out = {"width": ATLAS_W, "height": atlas_h, "glyphs": packed,
           "metrics": metrics}
    with open(os.path.join(ASSETS, "atlas.json"), "w") as f:
        json.dump(out, f)
    print(f"atlas {ATLAS_W}x{atlas_h} specs={len(SPECS)}")

if __name__ == "__main__":
    main()
