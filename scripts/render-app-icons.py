"""Render original pixel village/star icons; requires Pillow, not used at runtime."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
icon = Image.new("RGB", (64, 64), "#224f48")
draw = ImageDraw.Draw(icon)

# A solid background also fills the rounded corners supplied by iOS.
draw.rectangle((0, 32, 63, 63), fill="#2d6650")
draw.polygon([(0, 42), (15, 36), (27, 39), (45, 34), (63, 41), (63, 63), (0, 63)], fill="#3f8258")
draw.polygon([(0, 53), (18, 45), (36, 47), (51, 42), (63, 48), (63, 63), (0, 63)], fill="#60975a")
draw.polygon([(30, 46), (36, 46), (44, 63), (24, 63)], fill="#ccb77c")
draw.polygon([(32, 48), (34, 48), (39, 63), (29, 63)], fill="#e5d79c")

# Four-point fallen star, with a stepped outline and bright inner face.
draw.polygon([(32, 7), (39, 19), (52, 25), (39, 31), (32, 43), (25, 31), (12, 25), (25, 19)], fill="#1b433e")
draw.polygon([(32, 6), (38, 18), (50, 24), (38, 30), (32, 40), (26, 30), (14, 24), (26, 18)], fill="#ba8741")
draw.polygon([(32, 9), (36, 20), (46, 24), (36, 28), (32, 36), (28, 28), (18, 24), (28, 20)], fill="#f0c85b")
draw.polygon([(32, 9), (32, 24), (18, 24), (28, 20)], fill="#fff0a5")
draw.polygon([(32, 24), (46, 24), (36, 28), (32, 36)], fill="#e4ac45")
draw.rectangle((30, 22, 33, 25), fill="#fff4bd")
for x, y in [(11, 12), (48, 11), (53, 35)]:
    draw.line((x - 1, y, x + 1, y), fill="#d7e5b4")
    draw.line((x, y - 1, x, y + 1), fill="#d7e5b4")

# A little cottage and two cypress trees complete the valley silhouette.
draw.rectangle((24, 43, 40, 53), fill="#24473e")
draw.rectangle((25, 43, 39, 52), fill="#ead99c")
draw.polygon([(22, 43), (32, 35), (42, 43), (42, 45), (22, 45)], fill="#234e4a")
draw.polygon([(24, 42), (32, 36), (40, 42), (40, 43), (24, 43)], fill="#438c81")
draw.line((25, 41, 32, 36), fill="#7ab89a", width=1)
draw.rectangle((31, 47, 35, 52), fill="#80593d")
draw.rectangle((32, 48, 34, 52), fill="#ad8151")
draw.rectangle((27, 47, 29, 49), fill="#468c8d")
draw.point((28, 47), fill="#bfdcce")
for x, y in [(15, 45), (49, 47)]:
    draw.rectangle((x, y, x + 1, y + 7), fill="#725d38")
    draw.polygon([(x, y - 11), (x + 5, y - 3), (x + 3, y - 3), (x + 6, y + 2), (x - 5, y + 2), (x - 2, y - 3), (x - 4, y - 3)], fill="#2b674a")
    draw.line((x, y - 8, x - 2, y - 1), fill="#79a665", width=1)
draw.rectangle((10, 57, 12, 57), fill="#b5c37d")
draw.rectangle((49, 58, 52, 58), fill="#b5c37d")

for filename, size in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
    # The standard sizes preserve crisp integer pixel scaling.
    resample = Image.Resampling.NEAREST if size % 64 == 0 else Image.Resampling.LANCZOS
    icon.resize((size, size), resample).save(ROOT / filename, optimize=True)
