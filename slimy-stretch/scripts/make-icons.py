"""Draw the Slimy Stretch app icons (the slime on a dark background).

Run from slimy-stretch/:  python3 scripts/make-icons.py
Writes PNGs into public/, which Vite copies into the built site.
"""

from PIL import Image, ImageDraw, ImageFilter

BG_TOP = (20, 26, 51)
BG_BOTTOM = (42, 106, 58)
BODY = (85, 224, 90)
OUTLINE = (31, 143, 53)


def draw_icon(size, padding=0.0):
    """`padding` shrinks the slime toward the middle (for maskable icons)."""
    s = 4 * size  # draw big, then shrink, for smooth edges
    img = Image.new('RGB', (s, s))
    d = ImageDraw.Draw(img)
    for y in range(s):
        t = y / s
        d.line(
            [(0, y), (s, y)],
            fill=tuple(int(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)),
        )

    k = 1 - padding
    cx, cy = s / 2, s * 0.56
    rx, ry = s * 0.38 * k, s * 0.28 * k

    # Soft glow, then the see-through body over the background.
    glow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse(
        [cx - rx * 1.1, cy - ry * 1.1, cx + rx * 1.1, cy + ry * 1.1], fill=BODY + (90,)
    )
    img.paste(glow.filter(ImageFilter.GaussianBlur(s * 0.03)), (0, 0), glow.filter(ImageFilter.GaussianBlur(s * 0.03)))
    body = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(body).ellipse(
        [cx - rx, cy - ry, cx + rx, cy + ry],
        fill=BODY + (215,),
        outline=OUTLINE + (255,),
        width=int(s * 0.025 * k),
    )
    # Shine and bubbles go on their own layer so they blend with the body.
    shine = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shine)
    sd.ellipse([cx - rx * 0.7, cy - ry * 0.75, cx - rx * 0.2, cy - ry * 0.45], fill=(255, 255, 255, 120))
    for bx, by, br in [(0.45, 0.35, 0.05), (0.3, 0.55, 0.035), (-0.5, 0.45, 0.03)]:
        r = s * br * k
        sd.ellipse([cx + rx * bx - r, cy + ry * by - r, cx + rx * bx + r, cy + ry * by + r], fill=(255, 255, 255, 70))
    img = Image.alpha_composite(Image.alpha_composite(img.convert('RGBA'), body), shine).convert('RGB')

    # Cute eyes
    d = ImageDraw.Draw(img)
    for side in (-1, 1):
        ex, ey = cx + side * rx * 0.32, cy - ry * 0.12
        ew, eh = s * 0.075 * k, s * 0.09 * k
        d.ellipse([ex - ew, ey - eh, ex + ew, ey + eh], fill=(255, 255, 255))
        pr = s * 0.042 * k
        px, py = ex + s * 0.015 * k, ey + s * 0.02 * k
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(16, 32, 16))
        hr = s * 0.014 * k
        d.ellipse([px - pr * 0.4 - hr, py - pr * 0.45 - hr, px - pr * 0.4 + hr, py - pr * 0.45 + hr], fill=(255, 255, 255))
    # Smile
    mw = rx * 0.22
    d.arc([cx - mw, cy + ry * 0.05, cx + mw, cy + ry * 0.45], 20, 160, fill=(16, 60, 24), width=int(s * 0.014 * k))

    return img.resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    for size in (180, 192, 512):
        draw_icon(size).save(f'public/icon-{size}.png', optimize=True)
    # Android and some browsers crop "maskable" icons to a circle, so keep the slime well inside.
    draw_icon(512, padding=0.2).save('public/icon-maskable-512.png', optimize=True)
    draw_icon(32).save('public/favicon-32.png', optimize=True)
