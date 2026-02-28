#!/usr/bin/env python3
"""Generate all 25 sprite WebP files for japan-pokedex.

Downloads source sprites from PokeAPI/Showdown where possible,
creates custom pixel art for the rest, exports all as WebP.
"""

import io
import os
import math
from pathlib import Path
from urllib.request import urlopen, Request

from PIL import Image, ImageDraw

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SPRITE_DIR = Path(__file__).parent
HEADERS = {"User-Agent": "japan-pokedex-sprite-gen/1.0"}

PALETTE = {
    "white": (255, 255, 255),
    "black": (0, 0, 0),
    "red": (220, 50, 50),
    "dark_red": (180, 30, 30),
    "blue": (60, 120, 220),
    "dark_blue": (30, 60, 140),
    "green": (60, 180, 80),
    "dark_green": (30, 120, 50),
    "yellow": (255, 220, 50),
    "gold": (218, 165, 32),
    "orange": (240, 150, 30),
    "pink": (255, 100, 150),
    "cyan": (0, 220, 220),
    "purple": (150, 80, 200),
    "grey": (160, 160, 160),
    "dark_grey": (80, 80, 80),
    "light_grey": (210, 210, 210),
    "brown": (139, 90, 43),
    "dark_brown": (100, 60, 20),
    "skin": (240, 200, 160),
    "vermillion": (200, 50, 30),
    "teal": (0, 150, 136),
    # Bulbasaur greens
    "bulba_body": (80, 190, 120),
    "bulba_dark": (50, 140, 80),
    "bulba_bulb": (40, 160, 90),
    "bulba_eye": (200, 40, 40),
    # Oak colors
    "oak_hair": (220, 220, 220),
    "oak_coat": (240, 240, 240),
    "oak_shirt": (180, 60, 60),
}

# 3x5 pixel font for digits and symbols
PIXEL_FONT = {
    "0": ["111", "101", "101", "101", "111"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["111", "001", "111", "100", "111"],
    "3": ["111", "001", "111", "001", "111"],
    "4": ["101", "101", "111", "001", "001"],
    "5": ["111", "100", "111", "001", "111"],
    "6": ["111", "100", "111", "101", "111"],
    "7": ["111", "001", "010", "010", "010"],
    "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"],
    "!": ["010", "010", "010", "000", "010"],
    "?": ["111", "001", "011", "000", "010"],
    "Z": ["111", "001", "010", "100", "111"],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def save_webp(img: Image.Image, name: str) -> Path:
    path = SPRITE_DIR / f"{name}.webp"
    img.save(path, "WEBP", quality=90)
    print(f"  -> {path.name} ({img.width}x{img.height})")
    return path


def download_png(url: str) -> Image.Image:
    print(f"  Downloading {url.split('/')[-1]} ...")
    req = Request(url, headers=HEADERS)
    data = urlopen(req, timeout=15).read()
    return Image.open(io.BytesIO(data)).convert("RGBA")


def crop_to_content(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if bbox:
        return img.crop(bbox)
    return img


def tiny_text(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, color):
    """Draw text using the 3x5 pixel font."""
    cx = x
    for ch in text:
        glyph = PIXEL_FONT.get(ch)
        if glyph:
            for row_i, row in enumerate(glyph):
                for col_i, bit in enumerate(row):
                    if bit == "1":
                        draw.point((cx + col_i, y + row_i), fill=color)
            cx += len(glyph[0]) + 1


def draw_mini_pokeball(draw: ImageDraw.ImageDraw, x: int, y: int, size: int):
    """Draw a tiny pokeball at (x,y) with given size."""
    half = size // 2
    # Top half - red
    for py in range(half):
        for px in range(size):
            dx, dy = px - half, py - half
            if dx * dx + dy * dy <= half * half:
                draw.point((x + px, y + py), fill=PALETTE["red"])
    # Bottom half - white
    for py in range(half, size):
        for px in range(size):
            dx, dy = px - half, py - half
            if dx * dx + dy * dy <= half * half:
                draw.point((x + px, y + py), fill=PALETTE["white"])
    # Center line
    for px in range(size):
        dx = px - half
        if dx * dx <= half * half:
            draw.point((x + px, y + half), fill=PALETTE["black"])
    # Center button
    draw.point((x + half, y + half), fill=PALETTE["white"])
    if half > 2:
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            draw.point((x + half + dx, y + half + dy), fill=PALETTE["dark_grey"])


def draw_sparkle(draw: ImageDraw.ImageDraw, cx: int, cy: int, color):
    """Draw a 5x5 sparkle/star at center (cx, cy)."""
    draw.point((cx, cy), fill=color)
    for d in range(1, 3):
        draw.point((cx + d, cy), fill=color)
        draw.point((cx - d, cy), fill=color)
        draw.point((cx, cy + d), fill=color)
        draw.point((cx, cy - d), fill=color)
    # Diagonal accents
    draw.point((cx + 1, cy + 1), fill=color)
    draw.point((cx - 1, cy - 1), fill=color)
    draw.point((cx + 1, cy - 1), fill=color)
    draw.point((cx - 1, cy + 1), fill=color)


def draw_flame(draw: ImageDraw.ImageDraw, x: int, y: int, size: int):
    """Draw a tiny flame shape."""
    # Simple flame: orange body with yellow tip
    for i in range(size):
        w = max(1, size // 2 - abs(i - size // 2))
        for dx in range(-w, w + 1):
            c = PALETTE["yellow"] if i < size // 3 else PALETTE["orange"]
            draw.point((x + dx, y + size - 1 - i), fill=c)


def draw_mini_bulbasaur(draw: ImageDraw.ImageDraw, x: int, y: int):
    """Draw a ~10x8 mini Bulbasaur at (x,y)."""
    body = PALETTE["bulba_body"]
    dark = PALETTE["bulba_dark"]
    bulb = PALETTE["bulba_bulb"]
    eye = PALETTE["bulba_eye"]
    # Body (6x4 rectangle)
    for dy in range(3, 7):
        for dx in range(1, 9):
            draw.point((x + dx, y + dy), fill=body)
    # Darker underside
    for dx in range(2, 8):
        draw.point((x + dx, y + 7), fill=dark)
    # Bulb on back (centered)
    for dy in range(0, 3):
        for dx in range(3, 7):
            draw.point((x + dx, y + dy), fill=bulb)
    # Eyes
    draw.point((x + 2, y + 4), fill=eye)
    draw.point((x + 3, y + 4), fill=eye)
    # Legs (4 tiny dots)
    draw.point((x + 2, y + 7), fill=dark)
    draw.point((x + 3, y + 7), fill=dark)
    draw.point((x + 6, y + 7), fill=dark)
    draw.point((x + 7, y + 7), fill=dark)


# ---------------------------------------------------------------------------
# Character sprites (Phase 2)
# ---------------------------------------------------------------------------
def _find_eyes(img: Image.Image):
    """Find eye pixel coordinates by scanning for red/white clusters in top half."""
    eyes = []
    w, h = img.size
    for y in range(h // 3, h * 2 // 3):
        for x in range(w // 2):
            r, g, b, a = img.getpixel((x, y))
            # Look for white shine pixels (eye highlights) next to red pixels
            if r > 200 and g > 200 and b > 200 and a > 200:
                # Check if red pixel is nearby (below or adjacent)
                for dy in range(0, 3):
                    for dx in range(-1, 2):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h:
                            nr, ng, nb, na = img.getpixel((nx, ny))
                            if nr > 150 and ng < 80 and nb < 80 and na > 200:
                                eyes.append((x, y))
    # Deduplicate to 2 clusters
    if len(eyes) >= 2:
        left = eyes[0]
        right = None
        for e in eyes[1:]:
            if abs(e[0] - left[0]) > 3:
                right = e
                break
        if right:
            return left, right
    return None


def _tint_image(img: Image.Image, tint_color, strength=0.3):
    """Apply a color tint to non-transparent pixels."""
    result = img.copy()
    w, h = result.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = result.getpixel((x, y))
            if a > 50:
                r = int(r * (1 - strength) + tint_color[0] * strength)
                g = int(g * (1 - strength) + tint_color[1] * strength)
                b = int(b * (1 - strength) + tint_color[2] * strength)
                result.putpixel((x, y), (min(255, r), min(255, g), min(255, b), a))
    return result


def generate_bulbasaur_variants():
    """Download Bulbasaur from PokeAPI and create 5 mood variants."""
    print("\n[Bulbasaur variants]")
    url = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/firered-leafgreen/1.png"
    try:
        src = download_png(url)
    except Exception as e:
        print(f"  Download failed ({e}), creating from scratch")
        src = None

    if src:
        src = crop_to_content(src)
        base = src.resize((32, 32), Image.NEAREST)
    else:
        base = _draw_bulbasaur_scratch()

    # Detect eye positions for accurate overlays
    eye_info = _find_eyes(base)
    if eye_info:
        left_eye, right_eye = eye_info
        print(f"  Eyes detected at {left_eye} and {right_eye}")
    else:
        # Fallback coordinates from pixel analysis
        left_eye, right_eye = (2, 15), (11, 15)
        print(f"  Using fallback eye positions {left_eye} and {right_eye}")

    # The bulb sits roughly in top-right quadrant (x: 20-28, y: 0-8)
    bulb_cx, bulb_cy = 24, 5

    # 1. Happy (base — unmodified)
    save_webp(base, "bulbasaur-happy")

    # 2. Sleepy: blue tint + closed eyes (horizontal bars) + floating Z's
    sleepy = _tint_image(base, (80, 80, 180), 0.2)
    d = ImageDraw.Draw(sleepy)
    # Close eyes: 3px horizontal bars over each eye
    for eye_x, eye_y in [left_eye, right_eye]:
        for dx in range(-1, 3):
            for dy in range(0, 2):
                px, py = eye_x + dx, eye_y + dy + 1
                if 0 <= px < 32 and 0 <= py < 32:
                    d.point((px, py), fill=PALETTE["black"])
    # Floating "Z z Z" — large and visible in top-right corner
    # Big Z
    tiny_text(d, 26, 0, "Z", PALETTE["blue"])
    # Medium Z offset
    tiny_text(d, 22, 4, "Z", (100, 140, 255))
    # Small Z
    d.point((20, 8), fill=(140, 170, 255))
    d.point((21, 7), fill=(140, 170, 255))
    d.point((19, 7), fill=(140, 170, 255))
    save_webp(sleepy, "bulbasaur-sleepy")

    # 3. Excited: bright tint + sparkles + "!" + bouncy motion lines below
    excited = _tint_image(base, (255, 255, 200), 0.1)
    d = ImageDraw.Draw(excited)
    # Bold "!" above head
    tiny_text(d, 13, 0, "!", PALETTE["yellow"])
    # Larger "!" to the right
    for y in range(0, 5):
        d.point((17, y), fill=PALETTE["yellow"])
        d.point((18, y), fill=PALETTE["yellow"])
    d.point((17, 7), fill=PALETTE["yellow"])
    d.point((18, 7), fill=PALETTE["yellow"])
    # Sparkles in corners
    draw_sparkle(d, 28, 2, PALETTE["yellow"])
    draw_sparkle(d, 4, 2, (255, 200, 50))
    # Bounce lines below feet
    for x in [8, 12, 16, 20]:
        d.point((x, 30), fill=PALETTE["yellow"])
        d.point((x, 31), fill=(255, 220, 50, 150))
    save_webp(excited, "bulbasaur-excited")

    # 4. Confused: purple tint + X eyes + "?" + swirl above head
    confused = _tint_image(base, (180, 100, 220), 0.15)
    d = ImageDraw.Draw(confused)
    # X over each eye (3x3 X pattern)
    for eye_x, eye_y in [left_eye, right_eye]:
        center_x, center_y = eye_x + 1, eye_y + 1
        for delta in range(-1, 2):
            px1, py1 = center_x + delta, center_y + delta
            px2, py2 = center_x + delta, center_y - delta
            for px, py in [(px1, py1), (px2, py2)]:
                if 0 <= px < 32 and 0 <= py < 32:
                    d.point((px, py), fill=PALETTE["purple"])
    # Big "?" above head
    tiny_text(d, 12, 0, "?", PALETTE["yellow"])
    # Larger "?" to the right
    for px, py in [(17, 0), (18, 0), (19, 0), (19, 1), (18, 2), (17, 2), (18, 4)]:
        d.point((px, py), fill=PALETTE["yellow"])
    # Swirl marks
    swirl = [(27, 3), (28, 2), (29, 3), (28, 4), (27, 5), (29, 5), (30, 4)]
    for sx, sy in swirl:
        if 0 <= sx < 32 and 0 <= sy < 32:
            d.point((sx, sy), fill=PALETTE["purple"])
    save_webp(confused, "bulbasaur-confused")

    # 5. Vine Whip: thick green vines from bulb area curving outward
    vinewhip = base.copy()
    d = ImageDraw.Draw(vinewhip)
    vine = (40, 200, 80)
    vine_dk = (20, 150, 50)
    vine_lt = (80, 230, 100)
    # Left vine — curves from bulb down-left (2px wide)
    left_vine_path = []
    for i in range(10):
        vx = bulb_cx - 4 - i * 2
        vy = bulb_cy + i
        left_vine_path.append((vx, vy))
    for vx, vy in left_vine_path:
        for dx in range(2):
            px, py = vx + dx, vy
            if 0 <= px < 32 and 0 <= py < 32:
                d.point((px, py), fill=vine)
        # Dark edge below
        if 0 <= vx < 32 and 0 <= vy + 1 < 32:
            d.point((vx, vy + 1), fill=vine_dk)
    # Left vine tip (leaf)
    tip = left_vine_path[-1] if left_vine_path else (0, 14)
    tx, ty = tip
    for dx, dy in [(-2, -1), (-1, -1), (-3, 0), (-2, 0), (-1, 0), (-2, 1)]:
        px, py = tx + dx, ty + dy
        if 0 <= px < 32 and 0 <= py < 32:
            d.point((px, py), fill=vine_lt)

    # Right vine — curves from bulb up-right
    right_vine_path = []
    for i in range(8):
        vx = bulb_cx + 2 + i
        vy = bulb_cy - 2 + i
        right_vine_path.append((vx, vy))
    for vx, vy in right_vine_path:
        for dx in range(2):
            px, py = vx + dx, vy
            if 0 <= px < 32 and 0 <= py < 32:
                d.point((px, py), fill=vine)
        if 0 <= vx + 1 < 32 and 0 <= vy + 1 < 32:
            d.point((vx + 1, vy + 1), fill=vine_dk)
    # Right vine tip
    tip = right_vine_path[-1] if right_vine_path else (31, 12)
    tx, ty = tip
    for dx, dy in [(1, -2), (2, -1), (2, 0), (1, 0), (2, 1), (1, 1)]:
        px, py = tx + dx, ty + dy
        if 0 <= px < 32 and 0 <= py < 32:
            d.point((px, py), fill=vine_lt)
    save_webp(vinewhip, "bulbasaur-vinewhip")


def _draw_bulbasaur_scratch() -> Image.Image:
    """Fallback: draw Bulbasaur entirely from scratch as 32x32 pixel art."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    body = PALETTE["bulba_body"]
    dark = PALETTE["bulba_dark"]
    bulb = PALETTE["bulba_bulb"]

    # Body ellipse
    for y in range(16, 26):
        for x in range(6, 26):
            dx, dy = x - 16, y - 21
            if (dx * dx) / 100 + (dy * dy) / 25 < 1:
                c = dark if y > 23 else body
                d.point((x, y), fill=c)

    # Bulb
    for y in range(6, 16):
        for x in range(10, 22):
            dx, dy = x - 16, y - 11
            if dx * dx + dy * dy < 36:
                d.point((x, y), fill=bulb)
    # Bulb tip
    for y in range(4, 8):
        for x in range(14, 19):
            dx, dy = x - 16, y - 5
            if dx * dx + dy * dy < 6:
                d.point((x, y), fill=PALETTE["dark_green"])

    # Head
    for y in range(14, 21):
        for x in range(4, 18):
            dx, dy = x - 11, y - 17
            if (dx * dx) / 49 + (dy * dy) / 12 < 1:
                d.point((x, y), fill=body)

    # Eyes
    d.point((8, 16), fill=PALETTE["bulba_eye"])
    d.point((9, 16), fill=PALETTE["bulba_eye"])
    d.point((13, 16), fill=PALETTE["bulba_eye"])
    d.point((14, 16), fill=PALETTE["bulba_eye"])
    # Eye shine
    d.point((8, 15), fill=PALETTE["white"])
    d.point((13, 15), fill=PALETTE["white"])

    # Mouth
    d.point((10, 19), fill=PALETTE["dark_green"])
    d.point((11, 19), fill=PALETTE["dark_green"])

    # Legs
    for lx in [7, 10, 18, 21]:
        for ly in range(25, 29):
            d.point((lx, ly), fill=dark)
            d.point((lx + 1, ly), fill=dark)

    return img


def generate_oak():
    """Download Professor Oak gen3 from Pokemon Showdown and resize."""
    print("\n[Professor Oak]")
    # Gen3 Emerald sprite — much more detailed than gen1rb
    url = "https://play.pokemonshowdown.com/sprites/trainers/oak-gen3.png"
    try:
        src = download_png(url)
        src = crop_to_content(src)
        oak = src.resize((32, 32), Image.NEAREST)
    except Exception as e:
        print(f"  Gen3 download failed ({e}), trying gen1rb fallback...")
        try:
            url2 = "https://play.pokemonshowdown.com/sprites/trainers/oak-gen1rb.png"
            src = download_png(url2)
            src = crop_to_content(src)
            oak = src.resize((32, 32), Image.NEAREST)
        except Exception as e2:
            print(f"  All downloads failed ({e2}), creating from scratch")
            oak = _draw_oak_scratch()
    save_webp(oak, "oak")


def _draw_oak_scratch() -> Image.Image:
    """Fallback: draw Professor Oak from scratch."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Lab coat body
    for y in range(14, 30):
        w = 6 if y < 20 else 7
        for x in range(16 - w, 16 + w):
            d.point((x, y), fill=PALETTE["oak_coat"])
    # Shirt collar
    for y in range(14, 18):
        for x in range(13, 19):
            d.point((x, y), fill=PALETTE["oak_shirt"])

    # Head
    for y in range(4, 14):
        for x in range(10, 22):
            dx, dy = x - 16, y - 9
            if (dx * dx) / 36 + (dy * dy) / 25 < 1:
                d.point((x, y), fill=PALETTE["skin"])

    # Hair (white/grey, spiky on top)
    for y in range(2, 7):
        for x in range(10, 22):
            dx, dy = x - 16, y - 4
            if (dx * dx) / 36 + (dy * dy) / 6 < 1:
                d.point((x, y), fill=PALETTE["oak_hair"])
    # Side hair
    for y in range(5, 10):
        d.point((9, y), fill=PALETTE["oak_hair"])
        d.point((22, y), fill=PALETTE["oak_hair"])

    # Eyes
    d.point((13, 9), fill=PALETTE["black"])
    d.point((14, 9), fill=PALETTE["black"])
    d.point((18, 9), fill=PALETTE["black"])
    d.point((19, 9), fill=PALETTE["black"])

    # Mouth
    d.point((15, 12), fill=PALETTE["dark_brown"])
    d.point((16, 12), fill=PALETTE["dark_brown"])
    d.point((17, 12), fill=PALETTE["dark_brown"])

    # Legs
    for y in range(28, 32):
        for x in range(12, 15):
            d.point((x, y), fill=PALETTE["dark_grey"])
        for x in range(17, 20):
            d.point((x, y), fill=PALETTE["dark_grey"])

    return img


# ---------------------------------------------------------------------------
# Badge sprites (Phase 3)
# ---------------------------------------------------------------------------
POKEAPI_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/"


def _download_or_fallback(url: str, fallback_color) -> Image.Image:
    """Try to download a sprite, fall back to a colored circle."""
    try:
        return download_png(url)
    except Exception as e:
        print(f"  Download failed ({e}), using fallback")
        img = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        for y in range(20):
            for x in range(20):
                dx, dy = x - 10, y - 10
                if dx * dx + dy * dy < 81:
                    d.point((x, y), fill=fallback_color)
        return img


def generate_badge_first_catch():
    """Pokeball with sparkles - the first badge users earn."""
    print("\n[badge-first-catch]")
    src = _download_or_fallback(POKEAPI_BASE + "sprites/items/poke-ball.png", PALETTE["red"])
    src = crop_to_content(src)
    img = src.resize((16, 16), Image.NEAREST)
    # Place on 20x20 canvas with sparkles at corners
    canvas = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    canvas.paste(img, (2, 2), img)
    d = ImageDraw.Draw(canvas)
    # Yellow sparkle pixels at corners
    for sx, sy in [(1, 1), (18, 1), (1, 18), (18, 18)]:
        d.point((sx, sy), fill=PALETTE["yellow"])
    for sx, sy in [(0, 0), (19, 0), (0, 19), (19, 19)]:
        d.point((sx, sy), fill=(255, 220, 50, 128))
    # Extra sparkle highlights
    d.point((10, 0), fill=PALETTE["yellow"])
    d.point((0, 10), fill=PALETTE["yellow"])
    d.point((19, 10), fill=PALETTE["yellow"])
    d.point((10, 19), fill=PALETTE["yellow"])
    save_webp(canvas, "badge-first-catch")


def generate_badge_collector_10():
    """2x2 grid of mini pokeballs."""
    print("\n[badge-collector-10]")
    img = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Draw 4 mini pokeballs in a 2x2 grid
    for gx, gy in [(2, 2), (11, 2), (2, 11), (11, 11)]:
        draw_mini_pokeball(d, gx, gy, 7)
    save_webp(img, "badge-collector-10")


def generate_badge_perfect_quiz():
    """Star piece with '10' overlay."""
    print("\n[badge-perfect-quiz]")
    src = _download_or_fallback(POKEAPI_BASE + "sprites/items/star-piece.png", PALETTE["yellow"])
    src = crop_to_content(src)
    img = src.resize((20, 20), Image.NEAREST)
    canvas = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    canvas.paste(img, (0, 0), img)
    d = ImageDraw.Draw(canvas)
    # "10" in white with black outline at bottom
    tiny_text(d, 6, 13, "1", PALETTE["black"])
    tiny_text(d, 10, 13, "0", PALETTE["black"])
    tiny_text(d, 7, 14, "1", PALETTE["white"])
    tiny_text(d, 11, 14, "0", PALETTE["white"])
    save_webp(canvas, "badge-perfect-quiz")


def generate_badge_combo_king():
    """Electric gem with '7' overlay."""
    print("\n[badge-combo-king]")
    src = _download_or_fallback(POKEAPI_BASE + "sprites/items/electric-gem.png", PALETTE["yellow"])
    src = crop_to_content(src)
    img = src.resize((20, 20), Image.NEAREST)
    canvas = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    canvas.paste(img, (0, 0), img)
    d = ImageDraw.Draw(canvas)
    tiny_text(d, 8, 13, "7", PALETTE["black"])
    tiny_text(d, 9, 14, "7", PALETTE["white"])
    save_webp(canvas, "badge-combo-king")


def _make_fire_gem_base() -> Image.Image:
    """Download fire gem once for streak badges."""
    return _download_or_fallback(POKEAPI_BASE + "sprites/items/fire-gem.png", PALETTE["orange"])


def generate_badge_streak_3(fire_gem: Image.Image):
    """3 fire gems tiled horizontally."""
    print("\n[badge-streak-3]")
    gem = crop_to_content(fire_gem.copy())
    gem = gem.resize((6, 8), Image.NEAREST)
    img = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    img.paste(gem, (1, 6), gem)
    img.paste(gem, (7, 6), gem)
    img.paste(gem, (13, 6), gem)
    save_webp(img, "badge-streak-3")


def generate_badge_streak_5(fire_gem: Image.Image):
    """5 fire gems in 2 rows (3+2)."""
    print("\n[badge-streak-5]")
    gem = crop_to_content(fire_gem.copy())
    gem = gem.resize((6, 7), Image.NEAREST)
    img = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    # Top row: 3
    img.paste(gem, (1, 2), gem)
    img.paste(gem, (7, 2), gem)
    img.paste(gem, (13, 2), gem)
    # Bottom row: 2 centered
    img.paste(gem, (4, 11), gem)
    img.paste(gem, (10, 11), gem)
    save_webp(img, "badge-streak-5")


def generate_badge_streak_7(fire_gem: Image.Image):
    """7 fire gems with glow border."""
    print("\n[badge-streak-7]")
    gem = crop_to_content(fire_gem.copy())
    gem = gem.resize((5, 6), Image.NEAREST)
    img = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Glow border
    for y in range(20):
        for x in range(20):
            dx, dy = x - 10, y - 10
            dist = math.sqrt(dx * dx + dy * dy)
            if 8 < dist < 10:
                alpha = int(180 * (1 - (dist - 8) / 2))
                d.point((x, y), fill=(255, 150, 50, max(0, alpha)))
    # Row 1: 3
    img.paste(gem, (2, 1), gem)
    img.paste(gem, (8, 1), gem)
    img.paste(gem, (14, 1), gem)
    # Row 2: 2
    img.paste(gem, (5, 7), gem)
    img.paste(gem, (11, 7), gem)
    # Row 3: 2
    img.paste(gem, (5, 13), gem)
    img.paste(gem, (11, 13), gem)
    save_webp(img, "badge-streak-7")


def generate_badge_quiz_master():
    """Gym badge base with 4 colored dots."""
    print("\n[badge-quiz-master]")
    src = _download_or_fallback(POKEAPI_BASE + "sprites/badges/1.png", PALETTE["grey"])
    src = crop_to_content(src)
    img = src.resize((20, 16), Image.NEAREST)
    canvas = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    canvas.paste(img, (0, 0), img)
    d = ImageDraw.Draw(canvas)
    # 4 type-colored dots below
    colors = [PALETTE["red"], PALETTE["blue"], PALETTE["green"], PALETTE["yellow"]]
    for i, c in enumerate(colors):
        cx = 3 + i * 5
        d.point((cx, 18), fill=c)
        d.point((cx + 1, 18), fill=c)
        d.point((cx, 19), fill=c)
        d.point((cx + 1, 19), fill=c)
    save_webp(canvas, "badge-quiz-master")


def generate_badge_shutter_bug():
    """Camera with flash burst - drawn from scratch."""
    print("\n[badge-shutter-bug]")
    img = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Camera body
    d.rectangle([3, 7, 16, 16], fill=PALETTE["dark_grey"])
    d.rectangle([4, 8, 15, 15], fill=PALETTE["grey"])
    # Viewfinder bump
    d.rectangle([7, 5, 12, 7], fill=PALETTE["dark_grey"])
    # Lens (circle)
    for y in range(9, 15):
        for x in range(7, 13):
            dx, dy = x - 10, y - 12
            if dx * dx + dy * dy <= 6:
                d.point((x, y), fill=PALETTE["dark_blue"])
            elif dx * dx + dy * dy <= 9:
                d.point((x, y), fill=PALETTE["black"])
    # Lens shine
    d.point((9, 11), fill=PALETTE["white"])
    # Flash burst (top right)
    flash_pts = [(15, 3), (16, 2), (17, 3), (18, 2), (16, 4), (14, 4), (17, 5)]
    for px, py in flash_pts:
        d.point((px, py), fill=PALETTE["yellow"])
    d.point((16, 3), fill=PALETTE["white"])
    save_webp(img, "badge-shutter-bug")


def generate_badge_distance_walker():
    """Single footprint silhouette."""
    print("\n[badge-distance-walker]")
    img = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Foot sole (oval)
    for y in range(8, 18):
        for x in range(6, 14):
            dx, dy = x - 10, y - 13
            if (dx * dx) / 16 + (dy * dy) / 25 < 1:
                d.point((x, y), fill=PALETTE["brown"])
    # Toes (5 dots)
    toe_positions = [(7, 6), (9, 5), (11, 5), (13, 6), (14, 8)]
    for tx, ty in toe_positions:
        d.point((tx, ty), fill=PALETTE["brown"])
        d.point((tx + 1, ty), fill=PALETTE["brown"])
    save_webp(img, "badge-distance-walker")


def generate_badge_distance_runner():
    """Two footprints with motion lines."""
    print("\n[badge-distance-runner]")
    img = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # First footprint (left, lower)
    for y in range(10, 18):
        for x in range(2, 9):
            dx, dy = x - 5, y - 14
            if (dx * dx) / 9 + (dy * dy) / 16 < 1:
                d.point((x, y), fill=PALETTE["brown"])
    # Toes
    for tx, ty in [(3, 9), (5, 8), (7, 9)]:
        d.point((tx, ty), fill=PALETTE["brown"])

    # Second footprint (right, upper)
    for y in range(3, 11):
        for x in range(10, 17):
            dx, dy = x - 13, y - 7
            if (dx * dx) / 9 + (dy * dy) / 16 < 1:
                d.point((x, y), fill=PALETTE["brown"])
    # Toes
    for tx, ty in [(11, 2), (13, 1), (15, 2)]:
        d.point((tx, ty), fill=PALETTE["brown"])

    # Motion lines
    for ly in [5, 10, 15]:
        for lx in range(0, 3):
            d.point((lx, ly), fill=PALETTE["grey"])
    save_webp(img, "badge-distance-runner")


def generate_badge_fact_hunter():
    """Magnifying glass over '!'."""
    print("\n[badge-fact-hunter]")
    img = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Magnifying glass circle
    cx, cy, r = 9, 8, 6
    for y in range(20):
        for x in range(20):
            dx, dy = x - cx, y - cy
            dist_sq = dx * dx + dy * dy
            if r * r - 4 < dist_sq < r * r + 8:
                d.point((x, y), fill=PALETTE["dark_grey"])
            elif dist_sq < r * r - 4:
                d.point((x, y), fill=(200, 220, 255, 100))  # Light blue glass
    # Handle
    for i in range(5):
        d.point((14 + i, 13 + i), fill=PALETTE["brown"])
        d.point((15 + i, 13 + i), fill=PALETTE["brown"])
    # "!" inside lens
    tiny_text(d, 8, 5, "!", PALETTE["yellow"])
    save_webp(img, "badge-fact-hunter")


def generate_badge_diverse_explorer():
    """Compass rose with 4 type-colored quadrants."""
    print("\n[badge-diverse-explorer]")
    img = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = 10, 10
    # Outer circle
    for y in range(20):
        for x in range(20):
            dx, dy = x - cx, y - cy
            dist_sq = dx * dx + dy * dy
            if 64 < dist_sq < 81:
                d.point((x, y), fill=PALETTE["dark_grey"])
    # 4 colored quadrants
    quad_colors = [
        PALETTE["red"],     # top-right (fire)
        PALETTE["blue"],    # bottom-right (water)
        PALETTE["green"],   # bottom-left (grass)
        PALETTE["yellow"],  # top-left (electric)
    ]
    for y in range(20):
        for x in range(20):
            dx, dy = x - cx, y - cy
            dist_sq = dx * dx + dy * dy
            if dist_sq < 64:
                if dx >= 0 and dy < 0:
                    d.point((x, y), fill=quad_colors[0])
                elif dx >= 0 and dy >= 0:
                    d.point((x, y), fill=quad_colors[1])
                elif dx < 0 and dy >= 0:
                    d.point((x, y), fill=quad_colors[2])
                else:
                    d.point((x, y), fill=quad_colors[3])
    # Cross lines
    for i in range(-8, 9):
        d.point((cx + i, cy), fill=PALETTE["white"])
        d.point((cx, cy + i), fill=PALETTE["white"])
    # Cardinal direction arrows
    # N arrow
    d.point((cx, cy - 8), fill=PALETTE["red"])
    d.point((cx - 1, cy - 7), fill=PALETTE["red"])
    d.point((cx + 1, cy - 7), fill=PALETTE["red"])
    # S arrow
    d.point((cx, cy + 8), fill=PALETTE["white"])
    save_webp(img, "badge-diverse-explorer")


# ---------------------------------------------------------------------------
# Scene sprites (Phase 4 + 5)
# ---------------------------------------------------------------------------
def generate_scene_fushimi_inari():
    """Fushimi Inari: vermillion torii gates in perspective with mini Bulbasaur."""
    print("\n[scene-fushimi-inari]")
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Sky background
    d.rectangle([0, 0, 47, 20], fill=(180, 220, 255))
    # Grey path
    for y in range(20, 48):
        w = 4 + (y - 20) * 8 // 28
        for x in range(24 - w, 24 + w):
            d.point((x, y), fill=PALETTE["light_grey"])

    # Torii gates (4, getting smaller toward back)
    torii_specs = [
        (24, 18, 20, 18),  # x_center, y_top, width, height
        (24, 16, 16, 15),
        (24, 14, 12, 12),
        (24, 12, 8, 9),
    ]
    for cx_t, yt, w, h in torii_specs:
        half_w = w // 2
        verm = PALETTE["vermillion"]
        dark_v = PALETTE["dark_red"]
        # Top beam (kasagi)
        d.rectangle([cx_t - half_w, yt, cx_t + half_w, yt + 1], fill=verm)
        # Secondary beam (nuki)
        d.rectangle([cx_t - half_w + 2, yt + 3, cx_t + half_w - 2, yt + 3], fill=verm)
        # Pillars
        pillar_w = max(1, w // 8)
        d.rectangle([cx_t - half_w + 1, yt + 1, cx_t - half_w + 1 + pillar_w, yt + h], fill=dark_v)
        d.rectangle([cx_t + half_w - 1 - pillar_w, yt + 1, cx_t + half_w - 1, yt + h], fill=dark_v)

    # Green foliage on sides
    for y in range(8, 40):
        for x in range(0, 8):
            if (x + y) % 3 != 0:
                d.point((x, y), fill=PALETTE["dark_green"] if (x + y) % 5 == 0 else PALETTE["green"])
        for x in range(40, 48):
            if (x + y) % 3 != 0:
                d.point((x, y), fill=PALETTE["dark_green"] if (x + y) % 5 == 0 else PALETTE["green"])

    # Mini Bulbasaur peeking from right side
    draw_mini_bulbasaur(d, 36, 36)
    save_webp(img, "scene-fushimi-inari")


def generate_scene_dotonbori():
    """Dotonbori: canal, neon signs, Glico Running Man silhouette."""
    print("\n[scene-dotonbori]")
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Night sky
    d.rectangle([0, 0, 47, 15], fill=(20, 20, 50))
    # Buildings silhouettes
    d.rectangle([0, 10, 12, 30], fill=(40, 40, 60))
    d.rectangle([14, 8, 22, 30], fill=(35, 35, 55))
    d.rectangle([25, 12, 35, 30], fill=(40, 40, 60))
    d.rectangle([37, 6, 47, 30], fill=(35, 35, 55))

    # Neon signs (colored rectangles on buildings)
    d.rectangle([1, 12, 11, 16], fill=PALETTE["pink"])
    d.rectangle([15, 10, 21, 13], fill=PALETTE["cyan"])
    d.rectangle([26, 14, 34, 18], fill=PALETTE["yellow"])
    d.rectangle([38, 8, 46, 12], fill=PALETTE["pink"])

    # Glico Running Man (simplified silhouette on center building)
    glico_x, glico_y = 28, 20
    # Head
    d.point((glico_x, glico_y), fill=PALETTE["cyan"])
    d.point((glico_x + 1, glico_y), fill=PALETTE["cyan"])
    # Body
    d.point((glico_x, glico_y + 1), fill=PALETTE["cyan"])
    d.point((glico_x + 1, glico_y + 1), fill=PALETTE["cyan"])
    # Arms out
    d.point((glico_x - 1, glico_y + 1), fill=PALETTE["cyan"])
    d.point((glico_x + 2, glico_y + 2), fill=PALETTE["cyan"])
    # Legs running
    d.point((glico_x - 1, glico_y + 3), fill=PALETTE["cyan"])
    d.point((glico_x + 2, glico_y + 3), fill=PALETTE["cyan"])

    # Canal water (blue, lower third)
    for y in range(30, 48):
        for x in range(48):
            wave = (x + y) % 6
            if wave < 3:
                d.point((x, y), fill=PALETTE["dark_blue"])
            else:
                d.point((x, y), fill=PALETTE["blue"])

    # Neon reflections in water
    for y in range(31, 40):
        alpha = max(40, 200 - (y - 31) * 20)
        for rx, rc in [(5, (255, 100, 150, alpha)), (18, (0, 220, 220, alpha)), (30, (255, 220, 50, alpha))]:
            d.point((rx, y), fill=rc)
            d.point((rx + 1, y), fill=rc)

    save_webp(img, "scene-dotonbori")


def generate_scene_osaka_castle():
    """Osaka Castle: white/gold tiered castle, cherry blossom, mini Bulbasaur."""
    print("\n[scene-osaka-castle]")
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Sky
    d.rectangle([0, 0, 47, 25], fill=(180, 220, 255))
    # Ground
    d.rectangle([0, 35, 47, 47], fill=(120, 180, 80))

    # Castle base (stone wall)
    d.rectangle([12, 28, 36, 40], fill=PALETTE["grey"])
    d.rectangle([14, 30, 34, 38], fill=PALETTE["light_grey"])

    # Castle tiers
    tiers = [
        (14, 22, 34, 28, PALETTE["white"]),      # Bottom tier
        (17, 17, 31, 22, PALETTE["white"]),      # Middle tier
        (20, 12, 28, 17, PALETTE["white"]),      # Top tier
    ]
    for x1, y1, x2, y2, c in tiers:
        d.rectangle([x1, y1, x2, y2], fill=c)
        # Gold roof edge
        d.rectangle([x1 - 1, y1, x2 + 1, y1 + 1], fill=PALETTE["gold"])

    # Top finial
    d.rectangle([23, 9, 25, 12], fill=PALETTE["gold"])
    d.point((24, 8), fill=PALETTE["gold"])

    # Cherry blossom tree (right side)
    # Trunk
    for y in range(30, 40):
        d.point((40, y), fill=PALETTE["brown"])
        d.point((41, y), fill=PALETTE["brown"])
    # Blossoms (pink cluster)
    for y in range(22, 32):
        for x in range(36, 46):
            dx, dy = x - 41, y - 27
            if dx * dx + dy * dy < 20:
                c = PALETTE["pink"] if (x + y) % 2 == 0 else (255, 180, 200)
                d.point((x, y), fill=c)

    # Mini Bulbasaur at base
    draw_mini_bulbasaur(d, 6, 37)
    save_webp(img, "scene-osaka-castle")


def generate_scene_kinkakuji():
    """Kinkakuji: gold pavilion reflected in water, mini Bulbasaur."""
    print("\n[scene-kinkakuji]")
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Sky
    d.rectangle([0, 0, 47, 20], fill=(180, 220, 255))
    # Trees in background
    for y in range(10, 24):
        for x in range(0, 48):
            if (x + y) % 4 != 0:
                d.point((x, y), fill=PALETTE["dark_green"])

    # Gold pavilion
    gold = PALETTE["gold"]
    dark_gold = (180, 140, 20)
    # Bottom tier
    d.rectangle([14, 14, 34, 20], fill=gold)
    d.rectangle([13, 13, 35, 14], fill=dark_gold)  # Roof
    # Top tier
    d.rectangle([18, 8, 30, 13], fill=gold)
    d.rectangle([17, 7, 31, 8], fill=dark_gold)  # Roof
    # Finial
    d.point((24, 5), fill=PALETTE["yellow"])
    d.point((24, 6), fill=gold)
    # Pillars
    for px in [16, 20, 28, 32]:
        for py in range(14, 20):
            d.point((px, py), fill=dark_gold)

    # Water
    for y in range(24, 48):
        for x in range(48):
            wave = (x + y * 2) % 8
            if wave < 4:
                d.point((x, y), fill=(60, 130, 200))
            else:
                d.point((x, y), fill=(80, 150, 220))

    # Reflection (dimmed gold)
    for y in range(26, 38):
        ref_y = y - 26
        for x in range(16, 33):
            if ref_y < 6:
                d.point((x, y), fill=(180, 150, 40, 120))
            elif ref_y < 10:
                if 19 <= x <= 29:
                    d.point((x, y), fill=(180, 150, 40, 80))

    # Mini Bulbasaur at water's edge
    draw_mini_bulbasaur(d, 2, 22)
    save_webp(img, "scene-kinkakuji")


def generate_scene_arashiyama():
    """Arashiyama: bamboo grove with path, mini Bulbasaur."""
    print("\n[scene-arashiyama]")
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Light background (sky peeking through bamboo)
    d.rectangle([0, 0, 47, 47], fill=(200, 230, 200))

    # Bamboo stalks - varying greens
    greens = [(60, 160, 60), (80, 180, 80), (40, 140, 50), (70, 190, 70), (50, 150, 60)]
    stalk_positions = [2, 5, 8, 11, 35, 38, 41, 44]
    for i, sx in enumerate(stalk_positions):
        color = greens[i % len(greens)]
        dark = (color[0] - 20, color[1] - 30, color[2] - 20)
        for y in range(48):
            d.point((sx, y), fill=color)
            d.point((sx + 1, y), fill=color)
            # Node marks every 8 pixels
            if y % 8 == 0:
                d.point((sx, y), fill=dark)
                d.point((sx + 1, y), fill=dark)
                d.point((sx - 1, y), fill=dark) if sx > 0 else None
                d.point((sx + 2, y), fill=dark) if sx + 2 < 48 else None

    # Bamboo leaves (scattered)
    for y in range(0, 48, 3):
        for sx in stalk_positions:
            if (sx + y) % 7 == 0:
                lc = greens[(sx + y) % len(greens)]
                for dx in [-2, -1, 1, 2]:
                    px = sx + dx
                    if 0 <= px < 48:
                        d.point((px, y - 1), fill=lc)

    # Path (gap in center)
    path_color = (180, 160, 130)
    dark_path = (150, 130, 100)
    for y in range(48):
        w = 3 + y // 8
        for x in range(24 - w, 24 + w):
            if 0 <= x < 48:
                d.point((x, y), fill=path_color if (x + y) % 4 != 0 else dark_path)

    # Mini Bulbasaur on path
    draw_mini_bulbasaur(d, 19, 38)
    save_webp(img, "scene-arashiyama")


def generate_scene_wild_fact():
    """Wild fact: scroll/book with '!' and sparkles."""
    print("\n[scene-wild-fact]")
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Book/scroll shape (brown)
    d.rectangle([8, 10, 40, 40], fill=PALETTE["brown"])
    d.rectangle([10, 12, 38, 38], fill=(210, 190, 150))  # Parchment
    # Scroll curls
    d.rectangle([6, 10, 8, 40], fill=PALETTE["dark_brown"])
    d.rectangle([40, 10, 42, 40], fill=PALETTE["dark_brown"])
    # Top/bottom edges
    d.rectangle([8, 8, 40, 10], fill=PALETTE["dark_brown"])
    d.rectangle([8, 40, 40, 42], fill=PALETTE["dark_brown"])

    # Bold "!" in center
    excl_color = PALETTE["yellow"]
    # Exclamation mark (large, ~4x12 pixels)
    for y in range(16, 30):
        for x in range(22, 26):
            d.point((x, y), fill=excl_color)
    # Dot
    for y in range(33, 36):
        for x in range(22, 26):
            d.point((x, y), fill=excl_color)

    # Orange outline for "!"
    for y in range(15, 31):
        d.point((21, y), fill=PALETTE["orange"])
        d.point((26, y), fill=PALETTE["orange"])
    d.rectangle([21, 15, 26, 15], fill=PALETTE["orange"])
    d.rectangle([21, 30, 26, 30], fill=PALETTE["orange"])
    for y in range(32, 37):
        d.point((21, y), fill=PALETTE["orange"])
        d.point((26, y), fill=PALETTE["orange"])
    d.rectangle([21, 32, 26, 32], fill=PALETTE["orange"])
    d.rectangle([21, 36, 26, 36], fill=PALETTE["orange"])

    # Sparkle pixels around
    sparkle_positions = [(14, 14), (34, 14), (14, 36), (34, 36), (12, 25), (36, 25)]
    for sx, sy in sparkle_positions:
        d.point((sx, sy), fill=PALETTE["yellow"])
        d.point((sx + 1, sy), fill=(255, 220, 50, 180))
        d.point((sx, sy + 1), fill=(255, 220, 50, 180))

    save_webp(img, "scene-wild-fact")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=== Japan Pokedex Sprite Generator ===")
    print(f"Output directory: {SPRITE_DIR}")

    # Phase 2: Characters
    generate_bulbasaur_variants()
    generate_oak()

    # Phase 3: Badges
    generate_badge_first_catch()
    generate_badge_collector_10()
    generate_badge_perfect_quiz()
    generate_badge_combo_king()

    fire_gem = _make_fire_gem_base()
    generate_badge_streak_3(fire_gem)
    generate_badge_streak_5(fire_gem)
    generate_badge_streak_7(fire_gem)

    generate_badge_quiz_master()
    generate_badge_shutter_bug()
    generate_badge_distance_walker()
    generate_badge_distance_runner()
    generate_badge_fact_hunter()
    generate_badge_diverse_explorer()

    # Phase 4: Scenes
    generate_scene_fushimi_inari()
    generate_scene_dotonbori()
    generate_scene_osaka_castle()
    generate_scene_kinkakuji()
    generate_scene_arashiyama()

    # Phase 5: Replace wild-fact
    generate_scene_wild_fact()

    # Summary
    expected = [
        "bulbasaur-happy", "bulbasaur-sleepy", "bulbasaur-excited",
        "bulbasaur-confused", "bulbasaur-vinewhip", "oak",
        "badge-first-catch", "badge-collector-10", "badge-perfect-quiz",
        "badge-combo-king", "badge-streak-3", "badge-streak-5",
        "badge-streak-7", "badge-quiz-master", "badge-shutter-bug",
        "badge-distance-walker", "badge-distance-runner",
        "badge-fact-hunter", "badge-diverse-explorer",
        "scene-fushimi-inari", "scene-dotonbori", "scene-osaka-castle",
        "scene-kinkakuji", "scene-arashiyama", "scene-wild-fact",
    ]
    print(f"\n=== Summary ===")
    ok, missing = 0, []
    for name in expected:
        path = SPRITE_DIR / f"{name}.webp"
        if path.exists():
            ok += 1
        else:
            missing.append(name)
    print(f"Generated: {ok}/{len(expected)}")
    if missing:
        print(f"MISSING: {', '.join(missing)}")
    else:
        print("All sprites generated successfully!")


if __name__ == "__main__":
    main()
