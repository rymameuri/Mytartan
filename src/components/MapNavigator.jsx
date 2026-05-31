import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { SendIcon } from "./Icons";
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

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content:
    "Tell me where you are and where you'd like to go — for example, \"I'm at room 1051, heading to the library.\" You can also tap the map or scan a QR code to set your location.",
};

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

function toLocationRecord(loc, floorKeyOverride) {
  const floorKey = floorKeyOverride || loc.floorKey;
  return {
    id: loc.id,
    floorKey,
    x: loc.x,
    y: loc.y,
    label: loc.label,
    floor: loc.floor,
    type: loc.type,
  };
}

function scoreLocationMatch(text, loc) {
  const lower = text.toLowerCase().trim();
  if (!lower) return 0;

  let score = 0;
  const labelLower = loc.label.toLowerCase();
  const idLower = loc.id.toLowerCase().replace(/_/g, " ");
  const roomNum = loc.label.match(/\b(\d{3,4})\b/);

  if (roomNum && lower.includes(roomNum[1])) score += 12;
  if (lower.includes(labelLower) && labelLower.length > 3) score += 10;
  if (lower.includes(idLower) && idLower.length > 3) score += 6;

  const aliases = {
    library: ["library", "1156"],
    entrance: ["entrance"],
    elevator: ["elevator", "lift"],
    stairwell: ["stairs", "stairwell", "staircase"],
    bathroom: ["bathroom", "restroom", "toilet"],
    dining: ["dining", "cafeteria", "food"],
  };

  Object.entries(aliases).forEach(([type, words]) => {
    if (loc.type !== type && !labelLower.includes(type)) return;
    words.forEach((word) => {
      if (lower.includes(word)) score += 8;
    });
  });

  const floorMatch = lower.match(/\bfloor\s*([123])\b/i);
  if (floorMatch && parseInt(floorMatch[1], 10) === loc.floor) score += 3;

  return score;
}

function bestMatchInText(text, locations, minScore = 6) {
  let best = null;
  let bestScore = minScore;
  locations.forEach((loc) => {
    const score = scoreLocationMatch(text, loc);
    if (score > bestScore) {
      bestScore = score;
      best = loc;
    }
  });
  return best;
}

function resolveLocationsFromMessage(text, locations) {
  const lower = text.toLowerCase();
  const toSplit = lower.split(/\s+to\s+/i);
  if (toSplit.length >= 2) {
    const from = bestMatchInText(toSplit[0], locations);
    const to = bestMatchInText(toSplit.slice(1).join(" to "), locations);
    if (from || to) return { from, to };
  }

  const currentHint = /\b(i'?m\s+at|i am at|starting from|currently at|near|from)\b/i.test(text);
  const destHint = /\b(to|going to|head(?:ing)? to|need to get to|want to go to|find)\b/i.test(text);

  const match = bestMatchInText(text, locations);
  if (!match) return { from: null, to: null };

  if (currentHint && !destHint) return { from: match, to: null };
  if (destHint && !currentHint) return { from: null, to: match };
  return { from: match, to: null };
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
      segments: [{ floor: from.floor, points: [from, to] }],
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

function formatDirectionsReply(route, current, destination) {
  if (!current || !destination) return null;
  const header = `Route from ${current.label} to ${destination.label}:`;
  return [header, ...route.directions.map((step, i) => `${i + 1}. ${step}`)].join("\n");
}

function MapNavigator() {
  const [activeFloor, setActiveFloor] = useState("floor1");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [chatMessages, setChatMessages] = useState([WELCOME_MESSAGE]);
  const [chatInput, setChatInput] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [qrError, setQrError] = useState("");
  const [imageScale, setImageScale] = useState(1);

  const mapContainerRef = useRef(null);
  const imageRef = useRef(null);
  const qrScannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const messagesEndRef = useRef(null);
  const destinationRef = useRef(destination);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  const allLocations = useMemo(() => getAllLocations(), []);

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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
            const loc = toLocationRecord({ ...parsed, floorKey: parsed.floorKey }, parsed.floorKey);
            setCurrentLocation(loc);
            setActiveFloor(parsed.floorKey);
            setChatMessages((prev) => {
              const content = `QR scanned. You're at ${loc.label} on Floor ${loc.floor}. Where would you like to go?`;
              const idx = prev.findIndex((m) => m.role === "assistant" && m.kind === "location-status");
              const message = { role: "assistant", kind: "location-status", content };
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = message;
                return next;
              }
              return [...prev, message];
            });
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

  function upsertAssistant(kind, content) {
    setChatMessages((prev) => {
      const idx = prev.findIndex((m) => m.role === "assistant" && m.kind === kind);
      const message = {
        id: kind,
        role: "assistant",
        kind,
        content,
        updatedAt: Date.now(),
      };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = message;
        return next;
      }
      return [...prev, message];
    });
  }

  function appendAssistant(content) {
    setChatMessages((prev) => [...prev, { role: "assistant", content }]);
  }

  function applyCurrentLocation(loc, source = "map") {
    setCurrentLocation({ ...loc });
    setActiveFloor(loc.floorKey);

    const activeDest = destinationRef.current;
    const prefix = source === "qr" ? "QR scanned. " : "";
    const suffix = activeDest ? "" : " Where would you like to go?";
    upsertAssistant(
      "location-status",
      `${prefix}You're at ${loc.label} on Floor ${loc.floor}.${suffix}`
    );

    if (activeDest) {
      maybeReplyWithRoute(loc, activeDest);
    }
  }

  function applyDestination(loc) {
    setDestination(loc);
    if (loc.floorKey !== activeFloor) {
      setActiveFloor(loc.floorKey);
    }
  }

  function maybeReplyWithRoute(nextCurrent, nextDest) {
    if (!nextCurrent || !nextDest) return;
    const nextRoute = buildRoute(nextCurrent, nextDest);
    const reply = formatDirectionsReply(nextRoute, nextCurrent, nextDest);
    if (reply) {
      upsertAssistant("route-status", `${reply}\n\nRoute updated on the map.`);
    }
    setActiveFloor(`floor${nextCurrent.floor}`);
  }

  function handleChatSubmit(event) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    setChatMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", content: text },
    ]);
    setChatInput("");

    const { from, to } = resolveLocationsFromMessage(text, allLocations);
    let nextCurrent = currentLocation;
    let nextDest = destination;

    if (from) {
      nextCurrent = toLocationRecord(from);
      setCurrentLocation(nextCurrent);
      setActiveFloor(nextCurrent.floorKey);
    }
    if (to) {
      nextDest = toLocationRecord(to);
      setDestination(nextDest);
      if (nextDest.floorKey) setActiveFloor(nextDest.floorKey);
    }

    if (from && to) {
      maybeReplyWithRoute(nextCurrent, nextDest);
      return;
    }

    if (from && !to) {
      const activeDest = destinationRef.current;
      upsertAssistant(
        "location-status",
        `You're at ${from.label} on Floor ${from.floor}.${activeDest ? "" : " Where would you like to go?"}`
      );
      if (activeDest) {
        maybeReplyWithRoute(nextCurrent, activeDest);
      }
      return;
    }

    if (to && !from) {
      if (nextCurrent) {
        applyDestination(toLocationRecord(to));
        maybeReplyWithRoute(nextCurrent, toLocationRecord(to));
      } else {
        setDestination(toLocationRecord(to));
        upsertAssistant(
          "destination-status",
          `Destination set to ${to.label} on Floor ${to.floor}. Tell me where you are so I can draw the route.`
        );
      }
      return;
    }

    appendAssistant(
      "I couldn't find that location. Try a room number (e.g. 1051), a place name (library, west entrance), or say \"I'm at room 1051, going to the library.\""
    );
  }

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
    let loc;
    if (snapped) {
      loc = toLocationRecord({ ...snapped, floorKey: activeFloor }, activeFloor);
    } else {
      loc = {
        id: "custom",
        floorKey: activeFloor,
        x,
        y,
        label: `Custom (${x}, ${y})`,
        floor: parseInt(activeFloor.replace("floor", ""), 10),
        type: "custom",
      };
    }

    applyCurrentLocation(loc, "map");
  }

  function renderMapOverlay() {
    const scale = imageScale;
    const { width: mapW, height: mapH } = getMapDimensions(activeFloor);
    const floorNum = parseInt(activeFloor.replace("floor", ""), 10);
    const segment = route.segments.find((s) => s.floor === floorNum);

    const showCurrent = currentLocation && currentLocation.floor === floorNum;
    const showDest = destination && destination.floor === floorNum;
    const showRoute = segment && segment.points.length >= 2;

    if (!showCurrent && !showDest && !showRoute) return null;

    const routePoints =
      showRoute && segment.points.map((p) => `${p.x * scale},${p.y * scale}`).join(" ");

    return (
      <svg
        className="map-navigator__overlay"
        viewBox={`0 0 ${mapW * scale} ${mapH * scale}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {showRoute && (
          <polyline
            className="map-navigator__route"
            points={routePoints}
            fill="none"
            stroke="#c41230"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {showCurrent && (
          <circle
            key={`current-${currentLocation.id}-${currentLocation.x}-${currentLocation.y}`}
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
            fill="#111111"
            stroke="#ffffff"
            strokeWidth={2}
          />
        )}
      </svg>
    );
  }

  return (
    <div className="map-navigator">
      <div className="map-navigator__split">
        <div className="map-navigator__map-panel">
          <div className="map-navigator__map-toolbar">
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
            <button type="button" className="map-navigator__btn" onClick={() => setShowQr(true)}>
              Scan QR
            </button>
          </div>

          <div className="map-navigator__map-scroll">
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
              {renderMapOverlay()}
            </div>
          </div>

          <p className="map-navigator__hint">Tap the map to set your location.</p>
        </div>

        <div className="map-navigator__chat-panel">
          <div className="map-navigator__chat-messages">
            {chatMessages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id ?? `${message.role}-${message.kind}-${message.updatedAt ?? message.content}`}
                  className={`map-navigator__message${isUser ? " map-navigator__message--user" : ""}`}
                >
                  <div
                    className={`map-navigator__bubble${
                      isUser ? " map-navigator__bubble--user" : " map-navigator__bubble--assistant"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form className="map-navigator__chat-input-bar" onSubmit={handleChatSubmit}>
            <div className="map-navigator__chat-input-wrap">
              <input
                type="text"
                className="map-navigator__chat-input"
                placeholder="I'm at room 1051, heading to the library…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                aria-label="Navigation message"
              />
              <button
                type="submit"
                className="map-navigator__chat-send"
                disabled={!chatInput.trim()}
                aria-label="Send"
              >
                <SendIcon />
              </button>
            </div>
          </form>
        </div>
      </div>

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
