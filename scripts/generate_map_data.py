#!/usr/bin/env python3
"""
Legacy manual coordinates (deprecated for production).

Prefer: scripts/build_map_data_from_ocr.py
  - Extracts embedded map images from the PDF
  - OCR + walkway/elevator detection for accurate x/y positions
"""
import json
import os

# Applied to raw PDF exports — building footprint only (excludes BUILDING MAP header)
CROP_LEFT, CROP_TOP = 12, 265
MAP_WIDTH, MAP_HEIGHT = 1158, 1095

def entry(x, y, label, floor, typ, **extra):
    d = {"x": x, "y": y, "label": label, "floor": floor, "type": typ}
    d.update(extra)
    return d

data = {}

# ========== FLOOR 1 ==========
f1 = {}
f1["west_entrance"] = entry(150, 715, "West Entrance", 1, "entrance")
f1["east_entrance"] = entry(1020, 715, "East Entrance", 1, "entrance")
f1["south_entrance"] = entry(620, 1280, "South Entrance (TAMUQ)", 1, "entrance")
f1["west_walkway"] = entry(320, 715, "West Walkway", 1, "waypoint")
f1["east_walkway"] = entry(750, 715, "East Walkway", 1, "waypoint")
f1["info_desk"] = entry(425, 715, "Information Desk", 1, "office")
f1["central_spine"] = entry(620, 850, "Central Spine", 1, "waypoint")
f1["food_court"] = entry(330, 870, "Food Court", 1, "dining")
f1["food_court_majlis"] = entry(280, 980, "Food Court Majlis", 1, "dining")
f1["assembly_area"] = entry(490, 870, "Assembly Area", 1, "common")
f1["library"] = entry(720, 890, "Library (Room 1156)", 1, "library")
f1["elevator_north_center"] = entry(480, 395, "Elevator (North Center)", 1, "elevator", linkId="elevator_north_center")
f1["elevator_north_east"] = entry(920, 395, "Elevator (North East)", 1, "elevator", linkId="elevator_north_east")
f1["elevator_center"] = entry(580, 620, "Elevator (Center)", 1, "elevator", linkId="elevator_center")
f1["elevator_south"] = entry(620, 1200, "Elevator (South)", 1, "elevator", linkId="elevator_south")
f1["stairs_nw"] = entry(210, 320, "Stairs (Northwest)", 1, "stairwell", linkId="stairs_nw")
f1["stairs_north_1051"] = entry(550, 320, "Stairs (near 1051)", 1, "stairwell", linkId="stairs_north_center")
f1["stairs_north_1064"] = entry(640, 350, "Stairs (near 1064)", 1, "stairwell", linkId="stairs_north_east")
f1["stairs_ne"] = entry(990, 350, "Stairs (Northeast)", 1, "stairwell", linkId="stairs_ne")
f1["stairs_food_court"] = entry(250, 950, "Stairs (Food Court)", 1, "stairwell", linkId="stairs_west_lower")
f1["stairs_south"] = entry(620, 1240, "Stairs (South)", 1, "stairwell", linkId="stairs_south")
f1["stairs_library"] = entry(790, 660, "Stairs (near Library)", 1, "stairwell", linkId="stairs_east")
f1["bathroom_west_walkway"] = entry(205, 750, "Restrooms (West Walkway)", 1, "bathroom")
f1["bathroom_1051"] = entry(485, 665, "Restrooms (near 1051)", 1, "bathroom")
f1["bathroom_1081"] = entry(880, 420, "Restrooms (East Wing)", 1, "bathroom")
f1["bathroom_moot"] = entry(905, 665, "Restrooms (near MOOT)", 1, "bathroom")
f1["bathroom_food_court"] = entry(300, 820, "Restrooms (Food Court)", 1, "bathroom")
f1["bathroom_assembly"] = entry(645, 745, "Restrooms (Assembly)", 1, "bathroom")

for num, x, y in [
    ("1004", 95, 280), ("1005", 95, 310), ("1006", 95, 340), ("1007", 95, 370),
    ("1008", 95, 400), ("1009", 95, 430),
    ("1013", 175, 280), ("1014", 175, 310), ("1015", 175, 340), ("1016", 175, 370),
    ("1017", 175, 400), ("1018", 175, 430), ("1019", 175, 460), ("1020", 175, 490), ("1021", 175, 520),
    ("1024", 220, 540), ("1025", 250, 540), ("1026", 280, 540), ("1027", 310, 540),
]:
    f1[f"room_{num}"] = entry(x, y, f"Room {num}", 1, "office")

f1["room_1010"] = entry(95, 460, "Room 1010 (Computer Science)", 1, "department")
f1["room_1030"] = entry(320, 580, "Room 1030", 1, "classroom")
f1["room_1031"] = entry(360, 580, "Room 1031", 1, "classroom")
f1["room_1032"] = entry(400, 580, "Room 1032", 1, "classroom")
for num, x, y in [("1036", 430, 520), ("1037", 455, 520), ("1038", 480, 520), ("1039", 505, 520), ("1040", 530, 520)]:
    f1[f"room_{num}"] = entry(x, y, f"Room {num}", 1, "office")
f1["room_1051"] = entry(480, 580, "Room 1051", 1, "classroom")
f1["room_1064"] = entry(560, 650, "Room 1064", 1, "classroom")
f1["room_1065"] = entry(600, 620, "Room 1065", 1, "office")
f1["room_1066"] = entry(720, 520, "Room 1066 (Conference)", 1, "conference")
f1["room_1106"] = entry(850, 480, "Room 1106 (Conference)", 1, "conference")
f1["room_1121"] = entry(900, 520, "Room 1121", 1, "office")
f1["room_1131"] = entry(1050, 660, "Room 1131 (MOOT)", 1, "classroom")

for num, x, y in [
    ("1068", 780, 350), ("1069", 800, 350), ("1070", 820, 380), ("1071", 840, 380),
    ("1072", 860, 400), ("1073", 880, 400), ("1074", 900, 420), ("1075", 920, 420),
    ("1076", 940, 440), ("1077", 960, 440), ("1078", 980, 460), ("1079", 1000, 460),
    ("1080", 1020, 480), ("1081", 1040, 480),
    ("1089", 800, 300), ("1090", 820, 300), ("1091", 840, 320), ("1092", 860, 320),
    ("1093", 880, 340), ("1094", 900, 340), ("1095", 920, 360),
    ("1098", 950, 380), ("1099", 970, 380), ("1100", 990, 400), ("1101", 1010, 400),
    ("1102", 1030, 420), ("1103", 1050, 420), ("1104", 1070, 440),
]:
    f1[f"room_{num}"] = entry(x, y, f"Room {num}", 1, "office")

f1["admissions"] = entry(700, 550, "Admissions", 1, "department")
f1["student_affairs"] = entry(650, 500, "Student Affairs", 1, "department")
f1["general_education"] = entry(600, 480, "General Education", 1, "department")
f1["arc"] = entry(750, 500, "Academic Resource Center", 1, "department")

for num, x, y in [
    ("1213", 175, 925), ("1202", 230, 1080), ("1211", 200, 850), ("1210", 220, 880),
    ("1209", 240, 910), ("1208", 260, 940), ("1207", 280, 970), ("1206", 300, 1000),
    ("1205", 320, 1030), ("1204", 340, 1060), ("1203", 360, 1090),
    ("1199", 295, 1125), ("1190", 500, 1135), ("1185", 620, 1140),
    ("1181", 750, 1100), ("1180", 780, 1070), ("1179", 800, 1040), ("1178", 820, 1010),
    ("1177", 840, 980), ("1176", 860, 950), ("1175", 880, 920), ("1174", 900, 890),
    ("1173", 920, 860), ("1172", 940, 830), ("1171", 960, 800), ("1170", 980, 770),
    ("1159", 1000, 740), ("1145", 850, 750), ("1149", 870, 780), ("1150", 890, 810),
    ("1152", 910, 840), ("1153", 930, 870), ("1154", 950, 900), ("1155", 970, 930),
    ("1160", 990, 960), ("1161", 1010, 990),
]:
    typ = "classroom" if num in ("1213", "1202", "1199", "1190", "1185") else "office"
    f1[f"room_{num}"] = entry(x, y, f"Room {num}", 1, typ)

data["floor1"] = f1

# ========== FLOOR 2 ==========
f2 = {}
f2["west_walkway"] = entry(445, 550, "West Walkway", 2, "waypoint")
f2["east_walkway"] = entry(800, 550, "East Walkway", 2, "waypoint")
f2["central_spine"] = entry(445, 750, "Central Spine", 2, "waypoint")
f2["elevator_north_center"] = entry(445, 730, "Elevator (North Center)", 2, "elevator", linkId="elevator_north_center")
f2["elevator_north_east"] = entry(975, 460, "Elevator (North East)", 2, "elevator", linkId="elevator_north_east")
f2["elevator_center"] = entry(445, 730, "Elevator (Center)", 2, "elevator", linkId="elevator_center")
f2["elevator_south"] = entry(445, 1185, "Elevator (South)", 2, "elevator", linkId="elevator_south")
f2["stairs_nw"] = entry(215, 285, "Stairs (Northwest)", 2, "stairwell", linkId="stairs_nw")
f2["stairs_north_center"] = entry(665, 295, "Stairs (North Center)", 2, "stairwell", linkId="stairs_north_center")
f2["stairs_ne"] = entry(1125, 300, "Stairs (Northeast)", 2, "stairwell", linkId="stairs_ne")
f2["stairs_west_lower"] = entry(185, 685, "Stairs (West Lower)", 2, "stairwell", linkId="stairs_west_lower")
f2["stairs_center"] = entry(445, 665, "Stairs (Center)", 2, "stairwell", linkId="stairs_center")
f2["stairs_east"] = entry(875, 805, "Stairs (East Lower)", 2, "stairwell", linkId="stairs_east")
f2["stairs_south"] = entry(475, 1185, "Stairs (South)", 2, "stairwell", linkId="stairs_south")
f2["bathroom_top_center"] = entry(485, 475, "Restrooms (Top Center)", 2, "bathroom")
f2["bathroom_top_east"] = entry(685, 475, "Restrooms (Top East)", 2, "bathroom")
f2["bathroom_far_east"] = entry(1050, 385, "Restrooms (Far East)", 2, "bathroom")
f2["bathroom_west_arc"] = entry(215, 665, "Restrooms (West Arc)", 2, "bathroom")
f2["bathroom_east_arc"] = entry(855, 655, "Restrooms (East Arc)", 2, "bathroom")

for num, x, y in [
    ("2005", 215, 320), ("2006", 215, 350), ("2007", 215, 380), ("2008", 215, 410),
    ("2009", 215, 440), ("2010", 215, 470), ("2011", 215, 500),
    ("2013", 280, 320), ("2014", 280, 350), ("2015", 280, 380), ("2016", 280, 410),
    ("2017", 280, 440), ("2018", 280, 470), ("2019", 280, 500), ("2020", 280, 530), ("2021", 280, 560),
]:
    f2[f"room_{num}"] = entry(x, y, f"Room {num}", 2, "office")

f2["room_2033"] = entry(335, 300, "Room 2033 (Conference)", 2, "conference")
f2["room_2035"] = entry(400, 300, "Room 2035 (Conference)", 2, "conference")
f2["room_2052"] = entry(520, 300, "Room 2052 (Conference)", 2, "conference")
f2["room_2051"] = entry(560, 455, "Room 2051 (Conference)", 2, "conference")
f2["room_2049"] = entry(600, 455, "Room 2049 (Conference)", 2, "conference")
f2["room_2062"] = entry(640, 300, "Room 2062 (Conference)", 2, "conference")
f2["room_2042"] = entry(480, 350, "Room 2042", 2, "office")
f2["room_2044"] = entry(510, 420, "Room 2044", 2, "office")
f2["room_2060"] = entry(820, 430, "Room 2060 (IT)", 2, "department")

for num, x, y in [
    ("2070", 750, 350), ("2071", 770, 350), ("2072", 790, 370), ("2073", 810, 370),
    ("2074", 830, 390), ("2075", 850, 390), ("2076", 870, 410), ("2077", 890, 410),
    ("2078", 910, 430), ("2079", 930, 430), ("2080", 950, 450), ("2081", 970, 450),
    ("2082", 990, 470), ("2083", 1010, 470), ("2084", 1030, 490), ("2085", 1050, 490),
    ("2109", 1080, 400), ("2110", 1100, 420), ("2111", 1120, 440), ("2112", 1100, 460),
    ("2113", 1080, 480), ("2114", 1060, 500),
]:
    f2[f"room_{num}"] = entry(x, y, f"Room {num}", 2, "office")

f2["room_2115"] = entry(1040, 520, "Room 2115 (IT)", 2, "department")
f2["room_2123"] = entry(1100, 380, "Room 2123", 2, "office")

for num, x, y, typ in [
    ("2198", 160, 730, "classroom"), ("2196", 200, 780, "classroom"),
    ("2195", 180, 680, "office"), ("2194", 200, 700, "office"), ("2193", 220, 720, "office"),
    ("2192", 240, 740, "office"), ("2191", 260, 760, "office"), ("2190", 280, 780, "office"),
    ("2189", 300, 800, "office"), ("2188", 320, 820, "office"), ("2187", 340, 840, "office"),
    ("2186", 360, 860, "office"), ("2185", 380, 880, "office"), ("2184", 400, 900, "office"),
    ("2183", 420, 920, "office"), ("2182", 440, 940, "office"),
    ("2179", 500, 1180, "office"), ("2174", 480, 1000, "office"), ("2172", 500, 1020, "office"),
    ("2163", 510, 1150, "classroom"), ("2161", 530, 1080, "conference"), ("2160", 550, 1050, "office"),
    ("2153", 570, 1020, "office"), ("2152", 810, 1100, "classroom"), ("2147", 880, 900, "classroom"),
    ("2145", 900, 880, "office"), ("2144", 920, 860, "office"), ("2143", 940, 840, "office"),
    ("2142", 960, 820, "office"), ("2134", 1000, 700, "office"), ("2135", 1020, 720, "office"),
    ("2136", 1040, 740, "office"),
]:
    f2[f"room_{num}"] = entry(x, y, f"Room {num}", 2, typ)

data["floor2"] = f2

# ========== FLOOR 3 ==========
f3 = {}
f3["west_walkway"] = entry(500, 550, "West Walkway", 3, "waypoint")
f3["east_walkway"] = entry(750, 550, "East Walkway", 3, "waypoint")
f3["central_spine"] = entry(565, 875, "Central Spine", 3, "waypoint")
f3["elevator_north_center"] = entry(510, 640, "Elevator (North Center)", 3, "elevator", linkId="elevator_north_center")
f3["elevator_north_east"] = entry(925, 610, "Elevator (North East)", 3, "elevator", linkId="elevator_north_east")
f3["elevator_center"] = entry(565, 875, "Elevator (Center)", 3, "elevator", linkId="elevator_center")
f3["elevator_south"] = entry(585, 1260, "Elevator (South)", 3, "elevator", linkId="elevator_south")
f3["stairs_nw"] = entry(315, 415, "Stairs (Northwest)", 3, "stairwell", linkId="stairs_nw")
f3["stairs_north_center"] = entry(510, 620, "Stairs (North Center)", 3, "stairwell", linkId="stairs_north_center")
f3["stairs_ne"] = entry(945, 610, "Stairs (Northeast)", 3, "stairwell", linkId="stairs_ne")
f3["stairs_west_lower"] = entry(275, 835, "Stairs (West Lower)", 3, "stairwell", linkId="stairs_west_lower")
f3["stairs_center"] = entry(565, 910, "Stairs (Center)", 3, "stairwell", linkId="stairs_center")
f3["stairs_east"] = entry(815, 1080, "Stairs (East Lower)", 3, "stairwell", linkId="stairs_east")
f3["stairs_south"] = entry(610, 1250, "Stairs (South)", 3, "stairwell", linkId="stairs_south")
f3["bathroom_top_center"] = entry(510, 620, "Restrooms (Top Center)", 3, "bathroom")
f3["bathroom_top_east"] = entry(790, 600, "Restrooms (Top East)", 3, "bathroom")
f3["bathroom_west_arc"] = entry(310, 810, "Restrooms (West Arc)", 3, "bathroom")
f3["bathroom_east_arc"] = entry(795, 825, "Restrooms (East Arc)", 3, "bathroom")

for num, x, y, typ in [
    ("3110", 315, 500, "classroom"), ("3117", 315, 440, "classroom"),
    ("3014", 345, 435, "office"), ("3007", 360, 460, "office"), ("3016", 375, 480, "office"),
    ("3083", 350, 520, "office"), ("3088", 365, 540, "office"), ("3090", 380, 560, "office"),
    ("3091", 395, 575, "office"), ("3094", 350, 595, "conference"), ("3092", 410, 590, "office"),
    ("3223", 420, 450, "office"), ("3224", 435, 470, "office"), ("3010", 450, 490, "office"),
    ("3126", 460, 500, "office"), ("3127", 470, 520, "office"), ("3226", 480, 530, "office"),
    ("3129", 490, 545, "conference"), ("3131", 500, 560, "office"), ("3132", 510, 575, "office"),
    ("3133", 520, 590, "office"), ("3134", 530, 605, "office"), ("3135", 540, 620, "office"),
    ("3137", 550, 500, "office"), ("3138", 560, 515, "office"), ("3139", 570, 530, "office"),
    ("3140", 580, 545, "office"), ("3025", 625, 575, "classroom"), ("3027", 610, 600, "office"),
    ("3035", 700, 610, "classroom"), ("3153", 720, 580, "office"), ("3151", 735, 595, "office"),
    ("3150", 750, 610, "office"), ("3149", 765, 625, "office"), ("3148", 780, 640, "office"),
    ("3154", 790, 610, "department"), ("3156", 805, 625, "office"), ("3155", 820, 640, "office"),
    ("3163", 850, 500, "office"), ("3164", 865, 515, "office"), ("3162", 880, 530, "office"),
    ("3168", 895, 545, "office"), ("3169", 910, 560, "office"), ("3170", 925, 575, "office"),
    ("3167", 940, 590, "office"), ("3161", 870, 630, "conference"), ("3146", 855, 615, "office"),
    ("3174", 900, 600, "office"), ("3175", 915, 615, "office"), ("3177", 870, 630, "conference"),
    ("3176", 930, 620, "conference"),
    ("3178", 250, 865, "classroom"), ("3216", 265, 890, "office"), ("3072", 280, 915, "office"),
    ("3218", 295, 940, "office"), ("3213", 305, 965, "office"), ("3214", 315, 990, "office"),
    ("3211", 275, 915, "office"), ("3069", 345, 1060, "classroom"),
    ("3070", 320, 900, "office"), ("3179", 330, 925, "office"), ("3180", 340, 950, "office"),
    ("3181", 350, 975, "office"), ("3182", 360, 1000, "office"), ("3183", 370, 1025, "office"),
    ("3184", 380, 1050, "office"), ("3185", 390, 1075, "office"), ("3186", 400, 1100, "office"),
    ("3210", 375, 1110, "conference"), ("3044", 850, 845, "classroom"), ("3203", 820, 865, "conference"),
    ("3204", 835, 890, "classroom"), ("3048", 825, 1020, "classroom"), ("3046", 800, 1055, "classroom"),
    ("3205", 760, 1040, "conference"), ("3202", 780, 870, "office"), ("3201", 770, 895, "office"),
    ("3200", 760, 920, "office"), ("3199", 750, 945, "office"), ("3198", 740, 970, "office"),
    ("3197", 730, 995, "office"), ("3196", 720, 1020, "office"), ("3195", 710, 1045, "office"),
    ("3194", 700, 1070, "office"), ("3193", 690, 1095, "office"),
    ("3187", 520, 1150, "office"), ("3188", 535, 1170, "office"), ("3189", 550, 1190, "office"),
    ("3190", 580, 1150, "office"), ("3191", 595, 1170, "office"), ("3192", 610, 1190, "office"),
    ("3207", 600, 1220, "office"), ("3206", 570, 1235, "conference"),
]:
    label = f"Room {num}"
    if num == "3154":
        label = "Room 3154 (Marketing & PR)"
    f3[f"room_{num}"] = entry(x, y, label, 3, typ)

data["floor3"] = f3

# Shift coordinates to cropped image space
for locations in data.values():
    for loc in locations.values():
        loc["x"] -= CROP_LEFT
        loc["y"] -= CROP_TOP

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "src", "data", "mapData.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        json.dump(data, f, indent=2)
    for k, v in data.items():
        print(f"{k}: {len(v)} locations")
