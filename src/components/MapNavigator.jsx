import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import mapData from "../data/mapData.json";
import mapSizes from "../data/mapSizes.json";
import floor1Img from "../assets/maps/floor1.png";
import floor2Img from "../assets/maps/floor2.png";
import floor3Img from "../assets/maps/floor3.png";
import "./MapNavigator.css";

const SNAP_RADIUS = 40;

const MAP_SIZES = {
  floor1: { width: mapSizes.floor1.width, height: mapSizes.floor1.height },
  floor2: { width: mapSizes.floor2.width, height: mapSizes.floor2.height },
  floor3: { width: mapSizes.floor3.width, height: mapSizes.floor3.height },
};

function getMapDimensions(floorKey) {
  return MAP_SIZES[floorKey] || MAP_SIZES.floor1;
}

const FLOOR_IMAGES = {
  floor1: floor1Img,
  floor2: floor2Img,
  floor3: floor3Img,
};

const FLOOR_KEYS = ["floor1", "floor2", "floor3"];
const VERTICAL_TYPES = new Set(["elevator", "stairwell"]);

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getFloorData(floorKey) {
  return mapData[floorKey] || {};
}

function getAllLocations() {
  const list = [];
  FLOOR_KEYS.forEach((floorKey) => {
    const floorNum = parseInt(floorKey.replace("floor", ""), 10);
    Object.entries(getFloorData(floorKey)).forEach(([id, loc]) => {
      list.push({
        id,
        floorKey,
        floorNum,
        ...loc,
        compositeKey: `${floorKey}:${id}`,
      });
    });
  });
  return list;
}

function findNearestLocation(floorKey, x, y, maxDist = SNAP_RADIUS, excludeTypes = new Set(["waypoint"])) {
  let best = null;
  let bestDist = maxDist;
  Object.entries(getFloorData(floorKey)).forEach(([id, loc]) => {
    if (excludeTypes.has(loc.type)) return;
    const d = distance({ x, y }, loc);
    if (d < bestDist) {
      bestDist = d;
      best = { id, ...loc };
    }
  });
  return best;
}

function getVerticalNodes(floorKey) {
  return Object.entries(getFloorData(floorKey))
    .filter(([, loc]) => VERTICAL_TYPES.has(loc.type) && loc.linkId)
    .map(([id, loc]) => ({ id, ...loc }));
}

function findLinkedNode(floorKey, linkId) {
  const entry = Object.entries(getFloorData(floorKey)).find(
    ([, loc]) => loc.linkId === linkId && VERTICAL_TYPES.has(loc.type)
  );
  if (!entry) return null;
  const [id, loc] = entry;
  return { id, ...loc };
}

function getNearestWaypoint(floorKey, point) {
  const waypoints = Object.entries(getFloorData(floorKey))
    .filter(([, loc]) => loc.type === "waypoint")
    .map(([id, loc]) => ({ id, ...loc }));
  if (waypoints.length === 0) return null;
  return waypoints.reduce((best, wp) =>
    distance(point, wp) < distance(point, best) ? wp : best
  );
}

function chooseBestVerticalTransit(fromFloorKey, fromPoint, toFloorKey, toPoint) {
  const fromNodes = getVerticalNodes(fromFloorKey);
  const candidates = [];

  fromNodes.forEach((fromNode) => {
    const toNode = findLinkedNode(toFloorKey, fromNode.linkId);
    if (!toNode) return;
    const cost =
      distance(fromPoint, fromNode) +
      distance(toNode, toPoint) +
      Math.abs(fromNode.floor - toNode.floor) * 50;
    candidates.push({ fromNode, toNode, cost });
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.cost - b.cost);
  return candidates[0];
}

function bearingLabel(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
  if (angle >= -22.5 && angle < 22.5) return "north";
  if (angle >= 22.5 && angle < 67.5) return "northeast";
  if (angle >= 67.5 && angle < 112.5) return "east";
  if (angle >= 112.5 && angle < 157.5) return "southeast";
  if (angle >= 157.5 || angle < -157.5) return "south";
  if (angle >= -157.5 && angle < -112.5) return "southwest";
  if (angle >= -112.5 && angle < -67.5) return "west";
  return "northwest";
}

function buildRoute(current, destination) {
  if (!current || !destination) return { segments: [], directions: [] };

  const from = { x: current.x, y: current.y, floor: current.floor, label: current.label };
  const to = { x: destination.x, y: destination.y, floor: destination.floor, label: destination.label };

  if (from.floor === to.floor) {
    const dir = bearingLabel(from, to);
    return {
      segments: [{ floor: from.floor, points: [from, to] }],
      directions: [
        `Start at ${from.label} (Floor ${from.floor}).`,
        `Head ${dir} toward ${to.label}.`,
        `Arrive at ${to.label} on Floor ${to.floor}.`,
      ],
    };
  }

  const fromFloorKey = `floor${from.floor}`;
  const toFloorKey = `floor${to.floor}`;
  const transit = chooseBestVerticalTransit(fromFloorKey, from, toFloorKey, to);

  if (!transit) {
    return {
      segments: [
        { floor: from.floor, points: [from, to] },
      ],
      directions: [
        "Cross-floor route unavailable. Please use stairs or elevators shown on the map.",
      ],
    };
  }

  const fromHall = getNearestWaypoint(fromFloorKey, from) || from;
  const toHall = getNearestWaypoint(toFloorKey, to) || to;
  const { fromNode, toNode } = transit;
  const transitLabel = fromNode.label;
  const floorDiff = to.floor - from.floor;
  const floorVerb = floorDiff > 0 ? "up" : "down";

  const segments = [
    { floor: from.floor, points: [from, fromHall, fromNode] },
    { floor: to.floor, points: [toNode, toHall, to] },
  ];

  const dir1 = bearingLabel(from, fromHall);
  const dir2 = bearingLabel(toNode, to);
  const corridorName = fromHall.label || "the main corridor";

  const directions = [
    `Start at ${from.label} (Floor ${from.floor}).`,
    `Head ${dir1} along ${corridorName}.`,
    `Take ${transitLabel} ${floorVerb} to Floor ${to.floor}.`,
    `Head ${dir2} from the elevator toward ${to.label}.`,
    `${to.label} is on your right.`,
  ];

  return { segments, directions };
}

function parseQrPayload(raw) {
  const text = String(raw || "").trim();
  const match = text.match(/^cmuq:(floor[123]):([a-z0-9_]+)$/i);
  if (!match) return null;
  const floorKey = match[1].toLowerCase();
  const roomId = match[2].toLowerCase();
  const loc = getFloorData(floorKey)[roomId];
  if (!loc) return null;
  return { floorKey, id: roomId, ...loc };
}

const DESTINATION_TYPES = new Set([
  "classroom",
  "conference",
  "office",
  "entrance",
  "library",
  "dining",
  "common",
  "department",
  "elevator",
  "stairwell",
  "bathroom",
]);

function MapNavigator() {
  const [activeFloor, setActiveFloor] = useState("floor1");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destinationId, setDestinationId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [qrError, setQrError] = useState("");
  const [imageScale, setImageScale] = useState(1);

  const mapContainerRef = useRef(null);
  const imageRef = useRef(null);
  const qrScannerRef = useRef(null);
  const html5QrRef = useRef(null);

  const allLocations = useMemo(() => getAllLocations(), []);

  const destinationOptions = useMemo(() => {
    return allLocations
      .filter((loc) => DESTINATION_TYPES.has(loc.type))
      .sort((a, b) => {
        if (a.floorNum !== b.floorNum) return a.floorNum - b.floorNum;
        return a.label.localeCompare(b.label);
      });
  }, [allLocations]);

  const filteredDestinations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return destinationOptions;
    return destinationOptions.filter(
      (loc) =>
        loc.label.toLowerCase().includes(q) ||
        loc.id.toLowerCase().includes(q) ||
        loc.type.toLowerCase().includes(q)
    );
  }, [destinationOptions, searchQuery]);

  const destination = useMemo(() => {
    if (!destinationId) return null;
    return destinationOptions.find((loc) => loc.compositeKey === destinationId) || null;
  }, [destinationId, destinationOptions]);

  const route = useMemo(
    () => buildRoute(currentLocation, destination),
    [currentLocation, destination]
  );

  const mapDimensions = getMapDimensions(activeFloor);

  const updateImageScale = useCallback(() => {
    const img = imageRef.current;
    if (!img || !img.clientWidth) return;
    const { width } = getMapDimensions(activeFloor);
    setImageScale(img.clientWidth / width);
  }, [activeFloor]);

  useEffect(() => {
    updateImageScale();
    window.addEventListener("resize", updateImageScale);
    return () => window.removeEventListener("resize", updateImageScale);
  }, [updateImageScale, activeFloor]);

  useEffect(() => {
    if (!showQr) {
      if (html5QrRef.current) {
        html5QrRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            html5QrRef.current = null;
          });
      }
      return undefined;
    }

    let cancelled = false;
    const scannerId = "map-navigator-qr-reader";

    async function startScanner() {
      setQrError("");
      try {
        const scanner = new Html5Qrcode(scannerId);
        html5QrRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decoded) => {
            const parsed = parseQrPayload(decoded);
            if (!parsed) {
              setQrError("Invalid QR code. Expected format: cmuq:floor1:room_1051");
              return;
            }
            setCurrentLocation({
              id: parsed.id,
              floorKey: parsed.floorKey,
              x: parsed.x,
              y: parsed.y,
              label: parsed.label,
              floor: parsed.floor,
              type: parsed.type,
            });
            setActiveFloor(parsed.floorKey);
            setShowQr(false);
            setQrError("");
          },
          () => {}
        );
      } catch (err) {
        if (!cancelled) {
          setQrError(err.message || "Could not access camera. Allow camera permission and try again.");
        }
      }
    }

    const timer = setTimeout(startScanner, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
        html5QrRef.current = null;
      }
    };
  }, [showQr]);

  function handleMapClick(event) {
    const img = imageRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    const { width, height } = getMapDimensions(activeFloor);
    const x = Math.round(relX * width);
    const y = Math.round(relY * height);

    const snapped = findNearestLocation(activeFloor, x, y);
    if (snapped) {
      setCurrentLocation({
        id: snapped.id,
        floorKey: activeFloor,
        x: snapped.x,
        y: snapped.y,
        label: snapped.label,
        floor: snapped.floor,
        type: snapped.type,
      });
    } else {
      setCurrentLocation({
        id: "custom",
        floorKey: activeFloor,
        x,
        y,
        label: `Custom (${x}, ${y})`,
        floor: parseInt(activeFloor.replace("floor", ""), 10),
        type: "custom",
      });
    }
  }

  function renderRouteSvg() {
    const scale = imageScale;
    const { width: mapW, height: mapH } = getMapDimensions(activeFloor);
    const floorNum = parseInt(activeFloor.replace("floor", ""), 10);
    const segment = route.segments.find((s) => s.floor === floorNum);
    if (!segment || segment.points.length < 2) return null;

    const points = segment.points
      .map((p) => `${p.x * scale},${p.y * scale}`)
      .join(" ");

    const showCurrent = currentLocation && currentLocation.floor === floorNum;
    const showDest = destination && destination.floor === floorNum;

    return (
      <svg
        className="map-navigator__overlay"
        viewBox={`0 0 ${mapW * scale} ${mapH * scale}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <polyline
          className="map-navigator__route"
          points={points}
          fill="none"
          stroke="#C41230"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="8 6"
        />
        {showCurrent && (
          <circle
            cx={currentLocation.x * scale}
            cy={currentLocation.y * scale}
            r={8}
            fill="#2563eb"
            stroke="#ffffff"
            strokeWidth={2}
          />
        )}
        {showDest && (
          <circle
            cx={destination.x * scale}
            cy={destination.y * scale}
            r={8}
            fill="#dc2626"
            stroke="#ffffff"
            strokeWidth={2}
          />
        )}
      </svg>
    );
  }

  const selectedDestLabel = destination
    ? `${destination.label} (Floor ${destination.floor}, ${destination.type})`
    : "";

  return (
    <div className="map-navigator">
      <header className="map-navigator__header">
        <h2 className="map-navigator__title">CMUQ Building Navigator</h2>
        <div className="map-navigator__controls">
          <div className="map-navigator__floor-tabs" role="tablist" aria-label="Floor">
            {FLOOR_KEYS.map((key, i) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeFloor === key}
                className={`map-navigator__floor-tab${
                  activeFloor === key ? " map-navigator__floor-tab--active" : ""
                }`}
                onClick={() => setActiveFloor(key)}
              >
                Floor {i + 1}
              </button>
            ))}
          </div>
          <div className="map-navigator__search-wrap">
            <input
              type="search"
              className="map-navigator__search"
              placeholder="Search destination (room, library, entrance…)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              list="map-destinations-list"
              aria-label="Search destination"
            />
            <datalist id="map-destinations-list">
              {filteredDestinations.map((loc) => (
                <option
                  key={loc.compositeKey}
                  value={`${loc.label} — Floor ${loc.floor} (${loc.type})`}
                />
              ))}
            </datalist>
          </div>
          <select
            className="map-navigator__search"
            style={{ maxWidth: 220 }}
            value={destinationId}
            onChange={(e) => {
              setDestinationId(e.target.value);
              const loc = destinationOptions.find((l) => l.compositeKey === e.target.value);
              if (loc) setActiveFloor(loc.floorKey);
            }}
            aria-label="Select destination"
          >
            <option value="">Select destination…</option>
            {filteredDestinations.map((loc) => (
              <option key={loc.compositeKey} value={loc.compositeKey}>
                {loc.label} — F{loc.floor} ({loc.type})
              </option>
            ))}
          </select>
          <button type="button" className="map-navigator__btn" onClick={() => setShowQr(true)}>
            Scan QR Code
          </button>
        </div>
      </header>

      <div className="map-navigator__map-area">
        {currentLocation && (
          <p className="map-navigator__status">
            You are at: <strong>{currentLocation.label}</strong> (Floor {currentLocation.floor})
            {selectedDestLabel && (
              <>
                {" "}
                → Destination: <strong>{destination.label}</strong>
              </>
            )}
          </p>
        )}
        <div
          className="map-navigator__map-container"
          ref={mapContainerRef}
          onClick={handleMapClick}
          role="presentation"
        >
          <img
            ref={imageRef}
            src={FLOOR_IMAGES[activeFloor]}
            alt={`CMUQ Floor ${activeFloor.replace("floor", "")} map`}
            className="map-navigator__floor-image"
            width={mapDimensions.width}
            height={mapDimensions.height}
            onLoad={updateImageScale}
            draggable={false}
          />
          {renderRouteSvg()}
        </div>
        <p className="map-navigator__status" style={{ marginTop: 8 }}>
          Tap the map to set your location (snaps within {SNAP_RADIUS}px of labeled rooms).
        </p>
      </div>

      <section className="map-navigator__directions" aria-live="polite">
        <h3 className="map-navigator__directions-title">Directions</h3>
        {!currentLocation || !destination ? (
          <p className="map-navigator__directions-empty">
            Set your location (map tap or QR scan) and choose a destination to see step-by-step
            directions.
          </p>
        ) : (
          <ol className="map-navigator__directions-list">
            {route.directions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
      </section>

      {showQr && (
        <div
          className="map-navigator__qr-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-dialog-title"
        >
          <div className="map-navigator__qr-panel">
            <h3 id="qr-dialog-title">Scan location QR code</h3>
            <p className="map-navigator__status">Format: cmuq:floor1:room_1051</p>
            {qrError && <p className="map-navigator__qr-error">{qrError}</p>}
            <div id="map-navigator-qr-reader" className="map-navigator__qr-reader" ref={qrScannerRef} />
            <button
              type="button"
              className="map-navigator__btn map-navigator__btn--secondary"
              style={{ marginTop: 12, width: "100%" }}
              onClick={() => setShowQr(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapNavigator;
