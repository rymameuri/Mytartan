#!/usr/bin/env python3
"""Add legacy room entries (scaled via walkway alignment) where OCR missed labels."""
import json
import os
import runpy

ROOT = os.path.join(os.path.dirname(__file__), "..")
OCR_DATA = os.path.join(ROOT, "src", "data", "mapData.json")
SIZES = os.path.join(ROOT, "src", "data", "mapSizes.json")
GEN = os.path.join(ROOT, "scripts", "generate_map_data.py")

OLD_W, OLD_H = 1158, 1095


def load_legacy():
    """Load legacy coords without overwriting mapData.json."""
    ns = runpy.run_path(GEN, run_name="__not_main__")
    return ns["data"]


def main():
    with open(OCR_DATA) as f:
        ocr = json.load(f)
    with open(SIZES) as f:
        sizes = json.load(f)
    legacy = load_legacy()

    for fk, locs in ocr.items():
        nw, nh = sizes[fk]["width"], sizes[fk]["height"]
        leg = legacy.get(fk, {})
        nwx = locs.get("west_entrance", locs.get("west_walkway", {})).get("x")
        nex = locs.get("east_entrance", locs.get("east_walkway", {})).get("x")
        nwy = locs.get("west_entrance", locs.get("west_walkway", {})).get("y")
        if nwx is None or nex is None or nwy is None:
            continue
        if "west_entrance" not in leg or "east_entrance" not in leg:
            continue
        lwx = leg["west_entrance"]["x"]
        lwy = leg["west_entrance"]["y"]
        lex = leg["east_entrance"]["x"]
        lw = lex - lwx
        nw_span = nex - nwx
        if lw < 1 or nw_span < 1:
            continue

        def xform(x, y):
            nx = nwx + (x - lwx) * (nw_span / lw)
            ny = nwy + (y - lwy) * (nh / OLD_H)
            return int(nx), int(ny)

        existing = [(v["x"], v["y"]) for v in locs.values()]

        def occupied(x, y):
            return any((x - ex) ** 2 + (y - ey) ** 2 < 625 for ex, ey in existing)

        added = 0
        for rid, loc in leg.items():
            if not rid.startswith("room_") or rid in locs:
                continue
            x, y = xform(loc["x"], loc["y"])
            if x < 15 or y < 95 or x > nw - 15 or y > nh - 70:
                continue
            if occupied(x, y):
                continue
            locs[rid] = {**loc, "x": x, "y": y}
            existing.append((x, y))
            added += 1
        print(f"{fk}: +{added} rooms (total {len(locs)})")

    with open(OCR_DATA, "w") as f:
        json.dump(ocr, f, indent=2)


if __name__ == "__main__":
    main()
