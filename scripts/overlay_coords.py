#!/usr/bin/env python3
"""Draw mapData points on floor images for calibration review."""
import json
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..")
DATA = os.path.join(ROOT, "src", "data", "mapData.json")
OUT = os.path.join(ROOT, "src", "assets", "maps")

with open(DATA) as f:
    data = json.load(f)

for floor_key in ("floor1", "floor2", "floor3"):
    path = os.path.join(OUT, f"{floor_key}.png")
    im = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(im)
    for loc_id, loc in data[floor_key].items():
        x, y = loc["x"], loc["y"]
        t = loc.get("type", "")
        color = {
            "entrance": "lime",
            "elevator": "blue",
            "stairwell": "green",
            "classroom": "red",
            "waypoint": "yellow",
        }.get(t, "orange")
        r = 5 if t in ("entrance", "elevator", "stairwell") else 3
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color, outline="black")
    im.save(os.path.join(OUT, f"{floor_key}_overlay.png"))
    print(f"Wrote {floor_key}_overlay.png")
