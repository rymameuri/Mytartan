#!/usr/bin/env python3
"""Crop exported floor PNGs to building footprint + legend (matches Campus Guide framing)."""
from PIL import Image
import os

# left, top, right, bottom — same box for all floors at 150 DPI
CROP_BOX = (12, 265, 1170, 1360)

def main():
    base = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "maps")
    for n in (1, 2, 3):
        path = os.path.join(base, f"floor{n}.png")
        im = Image.open(path)
        im.crop(CROP_BOX).save(path)
        print(f"Cropped {path} -> {CROP_BOX[2] - CROP_BOX[0]}x{CROP_BOX[3] - CROP_BOX[1]}")

if __name__ == "__main__":
    main()
