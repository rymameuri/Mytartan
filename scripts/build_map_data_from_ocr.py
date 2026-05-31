#!/usr/bin/env python3
"""
Rebuild mapData.json from embedded PDF map images + Tesseract OCR + color detection.
Saves clean per-floor PNGs (native resolution, no PDF margins).
"""
import fitz
import io
import json
import os
import re
from collections import defaultdict

from PIL import Image, ImageOps
import pytesseract

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT_DATA = os.path.join(ROOT, "src", "data", "mapData.json")
OUT_SIZES = os.path.join(ROOT, "src", "data", "mapSizes.json")
OUT_MAPS = os.path.join(ROOT, "src", "assets", "maps")
PDF = "/Users/rymameuri/Desktop/DATA/Map.pdf"

TESS = "/opt/homebrew/bin/tesseract"
if os.path.exists(TESS):
    pytesseract.pytesseract.tesseract_cmd = TESS

MAP_XREFS = {0: 7, 1: 15, 2: 20}

LINK_IDS = {
    "elevator_north_center": "elevator_north_center",
    "elevator_north_east": "elevator_north_east",
    "elevator_center": "elevator_center",
    "elevator_south": "elevator_south",
    "stairs_nw": "stairs_nw",
    "stairs_north_center": "stairs_north_center",
    "stairs_ne": "stairs_ne",
    "stairs_south": "stairs_south",
    "stairs_west_lower": "stairs_west_lower",
    "stairs_east": "stairs_east",
    "stairs_center": "stairs_center",
}

CLASSROOMS = {
    1: {
        "1030", "1031", "1032", "1051", "1064", "1131",
        "1213", "1202", "1199", "1190", "1185",
    },
    2: {"2198", "2196", "2147", "2152", "2163"},
    3: {
        "3110", "3117", "3025", "3035", "3178", "3069", "3044", "3204", "3048", "3046",
    },
}
CONFERENCE = {
    1: {"1066", "1106"},
    2: {"2033", "2035", "2052", "2051", "2049", "2062", "2161"},
    3: {"3094", "3129", "3161", "3176", "3177", "3203", "3205", "3206", "3210"},
}
DEPARTMENTS = {1: {"1010"}, 2: {"2060", "2115"}, 3: {"3154"}}


def entry(x, y, label, floor, typ, **extra):
    d = {"x": int(x), "y": int(y), "label": label, "floor": floor, "type": typ}
    d.update(extra)
    return d


def building_bbox(im):
    px = im.convert("RGB").load()
    w, h = im.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r > 248 and g > 248 and b > 248:
                continue
            if r < 60 and g < 60 and b < 90:
                continue
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
    pad = 8
    return (
        max(0, min_x - pad),
        max(0, min_y - pad),
        min(w, max_x + pad),
        min(h, max_y + pad),
    )


def ocr_tokens(im, scale=4):
    big = im.resize((im.width * scale, im.height * scale), Image.Resampling.LANCZOS)
    gray = ImageOps.autocontrast(ImageOps.grayscale(big))
    tokens = []
    for psm in (11, 12, 6):
        data = pytesseract.image_to_data(
            gray, config=f"--psm {psm}", output_type=pytesseract.Output.DICT
        )
        for i, raw in enumerate(data["text"]):
            text = (raw or "").strip()
            conf = int(data["conf"][i]) if str(data["conf"][i]) != "-1" else 0
            if conf < 25 or not text:
                continue
            x = int((data["left"][i] + data["width"][i] / 2) / scale)
            y = int((data["top"][i] + data["height"][i] / 2) / scale)
            tokens.append((text, x, y, conf))
    return tokens


def ocr_grid_rooms(im, bbox, grid=6, scale=4):
    x0, y0, x1, y1 = bbox
    rooms = {}
    cw = max(1, (x1 - x0) // grid)
    ch = max(1, (y1 - y0) // grid)
    for gy in range(grid):
        for gx in range(grid):
            box = (
                x0 + gx * cw,
                y0 + gy * ch,
                min(x0 + (gx + 1) * cw + 30, x1),
                min(y0 + (gy + 1) * ch + 30, y1),
            )
            crop = im.crop(box)
            if crop.width < 20 or crop.height < 20:
                continue
            big = crop.resize(
                (crop.width * scale, crop.height * scale), Image.Resampling.LANCZOS
            )
            gray = ImageOps.autocontrast(ImageOps.grayscale(big))
            data = pytesseract.image_to_data(
                gray, config="--psm 11", output_type=pytesseract.Output.DICT
            )
            for i, raw in enumerate(data["text"]):
                text = (raw or "").strip()
                if not re.match(r"^\d{4}$", text):
                    continue
                conf = int(data["conf"][i]) if str(data["conf"][i]) != "-1" else 0
                if conf < 20:
                    continue
                x = box[0] + int((data["left"][i] + data["width"][i] / 2) / scale)
                y = box[1] + int((data["top"][i] + data["height"][i] / 2) / scale)
                prev = rooms.get(text)
                if not prev or conf > prev[2]:
                    rooms[text] = (x, y, conf)
    return rooms


def valid_room(num, floor_num):
    if floor_num == 1:
        return num.startswith("1")
    if floor_num == 2:
        return num.startswith("2")
    if floor_num == 3:
        return num[0] in ("3", "2", "0")
    return False


def room_type(floor_num, num):
    if num in CLASSROOMS.get(floor_num, set()):
        return "classroom"
    if num in CONFERENCE.get(floor_num, set()):
        return "conference"
    if num in DEPARTMENTS.get(floor_num, set()):
        return "department"
    if num == "1156":
        return "library"
    return "office"


def parse_labels(tokens):
    """Merge tokens into multi-word labels."""
    joined = defaultdict(list)
    for text, x, y, conf in tokens:
        u = re.sub(r"[^A-Z0-9 ]", "", text.upper())
        if len(u) < 3:
            continue
        joined[u].append((x, y, conf))

    out = {}
    for text, pts in joined.items():
        x = int(sum(p[0] for p in pts) / len(pts))
        y = int(sum(p[1] for p in pts) / len(pts))
        if "WEST" in text and "ENTRANCE" in text:
            out["west_entrance"] = (x, y, "West Entrance", "entrance")
        elif "EAST" in text and "ENTRANCE" in text:
            out["east_entrance"] = (x, y, "East Entrance", "entrance")
        elif "SOUTH" in text and "ENTRANCE" in text:
            out["south_entrance"] = (x, y, "South Entrance (TAMUQ)", "entrance")
        elif "WEST" in text and "WALK" in text:
            out["west_walkway"] = (x, y, "West Walkway", "waypoint")
        elif "EAST" in text and "WALK" in text:
            out["east_walkway"] = (x, y, "East Walkway", "waypoint")
        elif "FOOD" in text and "MAJLIS" in text:
            out["food_court_majlis"] = (x, y, "Food Court Majlis", "dining")
        elif "FOOD" in text and "COURT" in text:
            out["food_court"] = (x, y, "Food Court", "dining")
        elif "ASSEMBLY" in text:
            out["assembly_area"] = (x, y, "Assembly Area", "common")
        elif "LIBRARY" in text:
            out["library"] = (x, y, "Library (Room 1156)", "library")
        elif "MOOT" in text:
            out["room_1131"] = (x, y, "Room 1131 (MOOT)", "classroom")
    return out


def cluster_color(im, target, tol=42, step=3, min_pts=12, merge=30):
    px = im.convert("RGB").load()
    w, h = im.size
    pts = []
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b = px[x, y]
            dist = abs(r - target[0]) + abs(g - target[1]) + abs(b - target[2])
            if dist < tol:
                pts.append((x, y))
    if not pts:
        return []
    used = [False] * len(pts)
    centers = []
    for i, (px0, py0) in enumerate(pts):
        if used[i]:
            continue
        group = [(px0, py0)]
        used[i] = True
        for j in range(i + 1, len(pts)):
            if used[j]:
                continue
            qx, qy = pts[j]
            if abs(qx - px0) <= merge and abs(qy - py0) <= merge:
                group.append((qx, qy))
                used[j] = True
        if len(group) >= min_pts:
            cx = int(sum(p[0] for p in group) / len(group))
            cy = int(sum(p[1] for p in group) / len(group))
            centers.append((cx, cy))
    return sorted(centers, key=lambda p: (p[1], p[0]))


def assign_vertical_icons(centers, prefix, floor_num, locations):
    names_by_floor = {
        1: {
            "elevator": [
                "elevator_north_center",
                "elevator_north_east",
                "elevator_center",
                "elevator_south",
            ],
            "stairwell": [
                "stairs_nw",
                "stairs_north_center",
                "stairs_ne",
                "stairs_west_lower",
                "stairs_east",
                "stairs_south",
            ],
        },
        2: {
            "elevator": [
                "elevator_north_center",
                "elevator_north_east",
                "elevator_center",
                "elevator_south",
            ],
            "stairwell": [
                "stairs_nw",
                "stairs_north_center",
                "stairs_ne",
                "stairs_center",
                "stairs_east",
                "stairs_south",
            ],
        },
        3: {
            "elevator": [
                "elevator_north_center",
                "elevator_north_east",
                "elevator_center",
                "elevator_south",
            ],
            "stairwell": [
                "stairs_nw",
                "stairs_north_center",
                "stairs_ne",
                "stairs_center",
                "stairs_east",
                "stairs_south",
            ],
        },
    }
    typ = "elevator" if prefix == "elevator" else "stairwell"
    ids = names_by_floor.get(floor_num, {}).get(typ, [])
    for i, (x, y) in enumerate(centers):
        if i >= len(ids):
            break
        loc_id = ids[i]
        label = loc_id.replace("_", " ").title()
        extra = {}
        if loc_id in LINK_IDS:
            extra["linkId"] = LINK_IDS[loc_id]
        locations[loc_id] = entry(x, y, label, floor_num, typ, **extra)


def detect_walkway(im):
    px = im.convert("RGB").load()
    w, h = im.size

    def is_tan(r, g, b):
        return 170 < r < 240 and 140 < g < 210 and 90 < b < 170

    best_y, best_c = 0, 0
    for y in range(int(h * 0.2), int(h * 0.55)):
        c = sum(1 for x in range(w) if is_tan(*px[x, y]))
        if c > best_c:
            best_c = c
            best_y = y
    tan_xs = [x for x in range(w) if is_tan(*px[x, best_y])]
    if not tan_xs:
        return None
    return {
        "y": best_y,
        "west_x": tan_xs[0],
        "east_x": tan_xs[-1],
        "center_x": (tan_xs[0] + tan_xs[-1]) // 2,
    }


def build_floor(page_num, xref, doc):
    floor_num = page_num + 1
    floor_key = f"floor{floor_num}"

    info = doc.extract_image(xref)
    im = Image.open(io.BytesIO(info["image"]))
    im.save(os.path.join(OUT_MAPS, f"{floor_key}.png"))

    bbox = building_bbox(im)
    tokens = ocr_tokens(im)
    rooms = ocr_grid_rooms(im, bbox)

    # merge inline OCR room numbers
    for text, x, y, conf in tokens:
        if re.match(r"^\d{4}$", text) and valid_room(text, floor_num):
            if text not in rooms or conf > rooms[text][2]:
                rooms[text] = (x, y, conf)

    locations = {}
    x0, y0, x1, y1 = bbox

    for num, (x, y, _c) in rooms.items():
        if not valid_room(num, floor_num):
            continue
        if not (x0 <= x <= x1 and y0 + 80 <= y <= y1 - 60):
            continue
        rid = f"room_{num}"
        label = f"Room {num}"
        if num == "1131":
            label = "Room 1131 (MOOT)"
        if num == "3154":
            label = "Room 3154 (Marketing & PR)"
        locations[rid] = entry(x, y, label, floor_num, room_type(floor_num, num))

    for loc_id, (x, y, label, typ) in parse_labels(tokens).items():
        locations[loc_id] = entry(x, y, label, floor_num, typ)

    walk = detect_walkway(im)
    if walk:
        y = walk["y"]
        locations["west_walkway"] = entry(
            (walk["west_x"] + walk["center_x"]) // 2, y, "West Walkway", floor_num, "waypoint"
        )
        locations["east_walkway"] = entry(
            (walk["center_x"] + walk["east_x"]) // 2, y, "East Walkway", floor_num, "waypoint"
        )
        locations["west_entrance"] = entry(
            walk["west_x"] + 15, y, "West Entrance", floor_num, "entrance"
        )
        locations["east_entrance"] = entry(
            walk["east_x"] - 15, y, "East Entrance", floor_num, "entrance"
        )
        locations["info_desk"] = entry(
            walk["center_x"], y, "Information Desk", floor_num, "office"
        )

    if floor_num == 1 and "library" not in locations:
        locations["library"] = entry(int(im.width * 0.78), int(im.height * 0.58), "Library (Room 1156)", 1, "library")
    if floor_num == 1 and "food_court" not in locations:
        locations["food_court"] = entry(int(im.width * 0.35), int(im.height * 0.55), "Food Court", 1, "dining")
    if floor_num == 1 and "assembly_area" not in locations:
        locations["assembly_area"] = entry(int(im.width * 0.52), int(im.height * 0.55), "Assembly Area", 1, "common")
    if floor_num == 1 and "south_entrance" not in locations:
        locations["south_entrance"] = entry(
            int(im.width * 0.52), int(im.height * 0.82), "South Entrance (TAMUQ)", 1, "entrance"
        )

    elev = cluster_color(im, (70, 130, 200), tol=50)
    stair = cluster_color(im, (60, 140, 80), tol=45)
    assign_vertical_icons(elev, "elevator", floor_num, locations)
    assign_vertical_icons(stair, "stairwell", floor_num, locations)

    if walk and "central_spine" not in locations:
        locations["central_spine"] = entry(
            walk["center_x"], int(im.height * 0.52), "Central Spine", floor_num, "waypoint"
        )

    return floor_key, locations, {"width": im.width, "height": im.height}


def main():
    doc = fitz.open(PDF)
    data = {}
    sizes = {}
    for page_num, xref in MAP_XREFS.items():
        fk, locs, size = build_floor(page_num, xref, doc)
        data[fk] = locs
        sizes[fk] = size
        print(f"{fk}: {len(locs)} POIs, {size['width']}x{size['height']}")
    doc.close()

    with open(OUT_DATA, "w") as f:
        json.dump(data, f, indent=2)
    with open(OUT_SIZES, "w") as f:
        json.dump(sizes, f, indent=2)
    print("Wrote", OUT_DATA)


if __name__ == "__main__":
    main()
