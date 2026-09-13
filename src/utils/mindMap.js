const VIEW_W = 800;
const VIEW_H = 520;
const CENTER_X = 400;
const CENTER_Y = 250;

function slugId(value, fallback) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return slug || fallback;
}

function clipLabel(text, max = 36) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function uniqueSentences(text, limit = 6) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•#>\d.)\s]+/, "").trim())
    .filter(Boolean)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 18 && item.length <= 180)
    .filter((item) => !/\.(txt|md|pdf|pptx|docx)$/i.test(item));

  const unique = [];
  const seen = new Set();
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
    if (unique.length >= limit) break;
  }
  return unique;
}

function layoutPositions(count) {
  if (count <= 1) return [{ x: CENTER_X, y: CENTER_Y }];
  const positions = [{ x: CENTER_X, y: CENTER_Y }];
  const satellites = count - 1;
  const radiusX = 250;
  const radiusY = 170;
  for (let i = 0; i < satellites; i += 1) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / satellites;
    positions.push({
      x: Math.round(CENTER_X + Math.cos(angle) * radiusX),
      y: Math.round(CENTER_Y + Math.sin(angle) * radiusY),
    });
  }
  return positions;
}

function ensureSteps(nodes, links) {
  const steps = [
    {
      revealNodeIds: [nodes[0].id],
      revealLinkIds: [],
      narration: `Let's start with ${nodes[0].label}.`,
    },
  ];
  const revealed = new Set([nodes[0].id]);
  for (const node of nodes.slice(1)) {
    const link = links.find(
      (item) =>
        (item.from === node.id && revealed.has(item.to)) ||
        (item.to === node.id && revealed.has(item.from))
    );
    revealed.add(node.id);
    steps.push({
      revealNodeIds: [node.id],
      revealLinkIds: link ? [link.id] : [],
      narration: node.detail || `Next: ${node.label}.`,
    });
  }
  return steps;
}

/**
 * Validate and fill a mind-map outline: nodes, links, stepwise reveal order.
 */
export function normalizeMindMap(raw = {}) {
  const title = String(raw.title || "Concept").trim() || "Concept";
  const incomingNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const nodes = incomingNodes
    .map((node, index) => {
      const id = String(node?.id || `n${index}`).trim();
      const label = clipLabel(node?.label || node?.text || `Idea ${index + 1}`, 42);
      if (!id || !label) return null;
      return {
        id,
        label,
        detail: String(node?.detail || "").trim(),
        x: Number.isFinite(node?.x) ? node.x : undefined,
        y: Number.isFinite(node?.y) ? node.y : undefined,
      };
    })
    .filter(Boolean);

  if (nodes.length === 0) {
    nodes.push({ id: "n0", label: title, detail: "" });
  }

  const ids = new Set(nodes.map((node) => node.id));
  const incomingLinks = Array.isArray(raw.links) ? raw.links : [];
  const links = incomingLinks
    .map((link, index) => {
      const from = String(link?.from || "").trim();
      const to = String(link?.to || "").trim();
      if (!ids.has(from) || !ids.has(to) || from === to) return null;
      return {
        id: String(link?.id || `e${index + 1}`),
        from,
        to,
      };
    })
    .filter(Boolean);

  if (links.length === 0 && nodes.length > 1) {
    for (let i = 1; i < nodes.length; i += 1) {
      links.push({ id: `e${i}`, from: nodes[0].id, to: nodes[i].id });
    }
  }

  const positions = layoutPositions(nodes.length);
  const laidOut = nodes.map((node, index) => ({
    ...node,
    x: node.x ?? positions[index].x,
    y: node.y ?? positions[index].y,
  }));

  let steps = Array.isArray(raw.steps)
    ? raw.steps
        .map((step) => ({
          revealNodeIds: (step?.revealNodeIds || []).filter((id) => ids.has(id)),
          revealLinkIds: (step?.revealLinkIds || []).filter((id) => links.some((link) => link.id === id)),
          narration: String(step?.narration || "").trim(),
        }))
        .filter((step) => step.revealNodeIds.length > 0 || step.revealLinkIds.length > 0 || step.narration)
    : [];

  if (steps.length === 0) {
    steps = ensureSteps(laidOut, links);
  }

  return {
    title,
    width: VIEW_W,
    height: VIEW_H,
    nodes: laidOut,
    links,
    steps,
  };
}

export function visibleMindMap(map, stepIndex = 0) {
  const normalized = normalizeMindMap(map);
  const visibleNodes = new Set();
  const visibleLinks = new Set();
  const last = Math.min(Math.max(stepIndex, 0), Math.max(normalized.steps.length - 1, 0));
  normalized.steps.slice(0, last + 1).forEach((step) => {
    step.revealNodeIds.forEach((id) => visibleNodes.add(id));
    step.revealLinkIds.forEach((id) => visibleLinks.add(id));
  });
  return {
    ...normalized,
    visibleNodeIds: [...visibleNodes],
    visibleLinkIds: [...visibleLinks],
    currentStep: last,
    narration: normalized.steps[last]?.narration || "",
  };
}

export function buildMindMapFromConcept(concept, { sourceText = "", explanation = "", struggle = false } = {}) {
  const title = String(concept || "").trim() || guessTitle(sourceText) || "this idea";
  const points = uniqueSentences(explanation || sourceText, 6).filter(
    (sentence) => sentence.toLowerCase() !== title.toLowerCase()
  );

  const fallback = [
    `What ${title} is, in one line.`,
    `When you would use ${title}.`,
    `A common mix-up with ${title}.`,
    `How the pieces of ${title} connect.`,
  ];

  const details = points.length >= 2 ? points : fallback;
  const nodes = [
    { id: "n0", label: clipLabel(title, 28), detail: struggle ? `Let's slow this down.` : "" },
    ...details.slice(0, 6).map((detail, index) => ({
      id: slugId(detail, `n${index + 1}`),
      label: clipLabel(detail, 32),
      detail,
    })),
  ];

  const uniqueNodes = [];
  const seen = new Set();
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    uniqueNodes.push(node);
  }

  const links = uniqueNodes.slice(1).map((node, index) => ({
    id: `e${index + 1}`,
    from: "n0",
    to: node.id,
  }));

  const firstNarration = struggle
    ? `Yeah, ${title} can feel messy. We'll pin the center, then add one piece at a time.`
    : `Here's ${title} on the board. We'll grow the map as we talk.`;

  const steps = [
    { revealNodeIds: ["n0"], revealLinkIds: [], narration: firstNarration },
    ...uniqueNodes.slice(1).map((node, index) => ({
      revealNodeIds: [node.id],
      revealLinkIds: [links[index].id],
      narration: node.detail || `Next piece: ${node.label}.`,
    })),
  ];

  return normalizeMindMap({ title, nodes: uniqueNodes, links, steps });
}

export function guessTitle(text) {
  const line = String(text || "")
    .split(/\n+/)
    .map((item) => item.replace(/^#+\s*/, "").trim())
    .find((item) => item.length >= 4 && item.length <= 60);
  return line || "";
}
