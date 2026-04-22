#!/usr/bin/env python3
"""Generate a squircle app icon from raw-source.png.

Pipeline (intentionally simple):
  1. Load src-tauri/icons/raw-source.png
  2. Strip bottom + optional right band (去右下/底边水印)
  3. **Re-center the neon subject** in a new square: 只裁边时画框中点会偏，主体看起来「往一边堆」
  4. **Contain** into ``SIZE * INNER_RATIO``, paste on 1024 canvas, squircle + rim

  python3 apps/desktop/scripts/make-app-icon.py
  cd apps/desktop && npx tauri icon src-tauri/icons/source.png
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / "src-tauri" / "icons"
RAW = ROOT / "raw-source.png"
OUT = ROOT / "source.png"

SIZE = 1024
# Max side of the artwork after scale = SIZE * INNER_RATIO (larger = logo 更大、边更紧).
INNER_RATIO = 0.91
SUPERELLIPSE_N = 5.0
BG_TOP = (22, 25, 35)
BG_BOTTOM = (8, 10, 15)

# Trim 豆包类水印：常占右下角或底条，只裁一个边不够。
# 0 = 不裁该边
CROP_BOTTOM_PX = 96
CROP_RIGHT_PX = 140

INNER_RIM_PX = 2
INNER_RIM_COLOR = (255, 255, 255, 110)
OUTER_FRINGE_PX = 3
OUTER_FRINGE_COLOR = (220, 222, 228, 55)


def superellipse_mask(size: int, n: float) -> Image.Image:
    ss = size * 2
    ys, xs = np.ogrid[:ss, :ss]
    half = (ss - 1) / 2.0
    nx = (xs - half) / half
    ny = (ys - half) / half
    inside = (np.abs(nx) ** n + np.abs(ny) ** n) <= 1.0
    arr = (inside * 255).astype(np.uint8)
    big = Image.fromarray(arr, mode="L")
    return big.resize((size, size), Image.LANCZOS)


def vertical_gradient(
    size: int, top: tuple[int, int, int], bottom: tuple[int, int, int]
) -> Image.Image:
    ys = np.linspace(0.0, 1.0, size, dtype=np.float32).reshape(-1, 1)
    r = (1 - ys) * top[0] + ys * bottom[0]
    g = (1 - ys) * top[1] + ys * bottom[1]
    b = (1 - ys) * top[2] + ys * bottom[2]
    col = np.stack([r, g, b], axis=-1).astype(np.uint8)
    arr = np.repeat(col, size, axis=1)
    return Image.fromarray(arr, mode="RGB")


def recenter_bright_in_square(
    art: Image.Image, lum_threshold: int = 22, margin_ratio: float = 0.035
) -> Image.Image:
    """Tighten to the lit region, then place it in a black square (centered).
    Only runs after step 2 so asymmetric ``crop(0,0,-R,-B)`` does not shift
    the book left/right in the *frame*."""
    gray = np.asarray(art.convert("L"))
    ys, xs = np.where(gray > lum_threshold)
    if len(xs) < 16:
        return art
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    tight = art.crop((x0, y0, x1, y1))
    wb, hb = x1 - x0, y1 - y0
    side = int(np.ceil(max(wb, hb) * (1.0 + 2.0 * margin_ratio)))
    side = max(side, 1)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 255))
    ox = (side - wb) // 2
    oy = (side - hb) // 2
    out.paste(tight, (ox, oy), tight)
    return out


def scale_contain_max_side(art: Image.Image, max_side: int) -> Image.Image:
    """Uniform scale so the whole image fits in max_side × max_side (same as
    ``object-fit: contain`` with a square box)."""
    w, h = art.size
    if w <= 0 or h <= 0:
        return art
    scale = max_side / max(w, h)
    nw = max(1, round(w * scale))
    nh = max(1, round(h * scale))
    return art.resize((nw, nh), Image.LANCZOS)


def sample_edge_color(art: Image.Image, band_px: int = 6) -> tuple[int, int, int]:
    rgb = art.convert("RGB")
    arr = np.asarray(rgb)
    band = arr[: min(band_px, arr.shape[0])]
    return tuple(int(v) for v in band.reshape(-1, 3).mean(axis=0))


def erode_l(mask: Image.Image, iters: int) -> Image.Image:
    m = mask
    for _ in range(iters):
        m = m.filter(ImageFilter.MinFilter(3))
    return m


def dilate_l(mask: Image.Image, iters: int) -> Image.Image:
    m = mask
    for _ in range(iters):
        m = m.filter(ImageFilter.MaxFilter(3))
    return m


def solid_rgba_layer(
    size: int, rgba: tuple[int, int, int, int], mask: Image.Image
) -> Image.Image:
    r, g, b, a = rgba
    m = np.asarray(mask, dtype=np.float32) / 255.0
    al = (m * float(a)).astype(np.uint8)
    rr = np.full((size, size), r, dtype=np.uint8)
    gg = np.full((size, size), g, dtype=np.uint8)
    bb = np.full((size, size), b, dtype=np.uint8)
    return Image.merge(
        "RGBA",
        (
            Image.fromarray(rr, "L"),
            Image.fromarray(gg, "L"),
            Image.fromarray(bb, "L"),
            Image.fromarray(al, "L"),
        ),
    )


def main() -> int:
    if not RAW.exists():
        print(f"[icon] ERROR: {RAW} not found")
        return 1

    art = Image.open(RAW).convert("RGBA")
    w, h = art.size
    r = w - CROP_RIGHT_PX if CROP_RIGHT_PX > 0 else w
    btm = h - CROP_BOTTOM_PX if CROP_BOTTOM_PX > 0 else h
    if r - 0 < 8 or btm - 0 < 8:
        pass  # 裁剪过狠则保留原图，避免崩
    else:
        art = art.crop((0, 0, r, btm))

    art = recenter_bright_in_square(art)

    inner_px = int(SIZE * INNER_RATIO)
    art_fit = scale_contain_max_side(art, inner_px)

    try:
        top_rgb = sample_edge_color(art_fit, band_px=6)
        bg_top = top_rgb
        bg_bottom = tuple(max(0, int(c * 0.5)) for c in top_rgb)
    except Exception:
        bg_top, bg_bottom = BG_TOP, BG_BOTTOM
    bg = vertical_gradient(SIZE, bg_top, bg_bottom).convert("RGBA")

    ax = (SIZE - art_fit.size[0]) // 2
    ay = (SIZE - art_fit.size[1]) // 2
    bg.paste(art_fit, (ax, ay), art_fit)

    outer_mask = superellipse_mask(SIZE, SUPERELLIPSE_N)
    b = (np.asarray(outer_mask) > 127).astype(np.uint8) * 255
    b = Image.fromarray(b, mode="L")
    b_er = erode_l(b, INNER_RIM_PX)
    b_dil = dilate_l(b, OUTER_FRINGE_PX)
    inner_rim = ImageChops.subtract(b, b_er)
    outer_fringe = ImageChops.subtract(b_dil, b)
    if INNER_RIM_COLOR[3] > 0:
        bg = Image.alpha_composite(bg, solid_rgba_layer(SIZE, INNER_RIM_COLOR, inner_rim))
    if OUTER_FRINGE_COLOR[3] > 0:
        bg = Image.alpha_composite(
            bg, solid_rgba_layer(SIZE, OUTER_FRINGE_COLOR, outer_fringe)
        )

    om = np.asarray(outer_mask, dtype=np.int16)
    of = np.asarray(outer_fringe) > 0
    fr_al = int(OUTER_FRINGE_COLOR[3])
    a = np.where(of, np.maximum(om, fr_al), om)
    a = np.clip(a, 0, 255).astype(np.uint8)
    rch, gch, bch, _ = bg.split()
    bg = Image.merge("RGBA", (rch, gch, bch, Image.fromarray(a, "L")))

    r, g, b, a2 = bg.split()
    a2 = a2.filter(ImageFilter.GaussianBlur(radius=0.6))
    bg = Image.merge("RGBA", (r, g, b, a2))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    bg.save(OUT, format="PNG", optimize=True)
    print(f"[icon] wrote {OUT} ({OUT.stat().st_size} bytes)")
    print(
        f"       max_side={inner_px}  crop_b={CROP_BOTTOM_PX}  crop_r={CROP_RIGHT_PX}  recenter=on"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
