import {
  MINDMAP_GENERATION_RULES,
  isBibliographicJunk,
  isConceptualClaim,
  isUsableTopic,
  sentencesFromSource,
  titleCasePhrase,
  WEAK_TOPIC,
} from "./sourceTextFilters";

export { MINDMAP_GENERATION_RULES };

const VIEW_W = 800;
const VIEW_H = 520;
const CENTER_X = 400;
const CENTER_Y = 250;

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "from",
  "that",
  "this",
  "these",
  "those",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "as",
  "by",
  "it",
  "its",
  "their",
  "more",
  "than",
  "not",
  "how",
  "when",
  "through",
  "into",
  "about",
  "also",
  "such",
  "can",
  "may",
  "if",
  "then",
  "looks",
  "would",
  "should",
]);

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

function clipClaim(text, max = 140) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function subjectOfClaim(sentence) {
  const raw = String(sentence || "").replace(/\s+/g, " ").trim();
  const article = raw.match(
    /^(?:A|An|The)\s+([A-Za-z][A-Za-z]+(?:\s+(?:of|and|or)\s+[A-Za-z][A-Za-z]+)(?:\s+[A-Za-z][A-Za-z]+)?)\s+(?:is|are|means|refers|describes|defines|treats|becomes|grows|comes)\b/i
  );
  if (article) return article[1];
  const head = raw.match(
    /^([A-Z][A-Za-z]+(?:\s+[A-Za-z]+){0,2})\s+(?:is|are|means|refers|describes|defines|treats|becomes|grows|comes)\b/
  );
  if (head) return head[1];
  return "";
}

const LABEL_LEAD_VERB =
  /^(describes|through|including|using|from|with|looks|treats|argues|shows|reserved|rights)$/i;

function enumeratedPhrases(sentence) {
  const raw = String(sentence || "");
  const match =
    raw.match(
      /\b(?:through|via|namely|including)\s+((?:(?:a|an|the)\s+)?[a-z][a-z]*(?:\s+[a-z]+){0,2},\s+(?:(?:a|an|the)\s+)?[a-z][a-z]*(?:\s+[a-z]+){0,2},\s+(?:and|or)\s+(?:(?:a|an|the)\s+)?[a-z][a-z]*(?:\s+[a-z]+){0,2})/i
    ) ||
    raw.match(
      /\b((?:(?:a|an|the)\s+)?[a-z][a-z]{2,},\s+(?:(?:a|an|the)\s+)?[a-z][a-z]{2,},\s+(?:and|or)\s+(?:(?:a|an|the)\s+)?[a-z][a-z]*(?:\s+[a-z]+){0,2})/i
    );
  if (!match) return [];
  return match[1]
    .split(/,|(?:\s+and\s+)|(?:\s+or\s+)/i)
    .map((part) => part.replace(/^(?:a|an|the)\s+/i, "").trim())
    .filter((part) => part.length >= 3 && part.length <= 32 && !LABEL_LEAD_VERB.test(part));
}

function compactLabelFromSentence(sentence) {
  const subject = subjectOfClaim(sentence);
  if (subject && isUsableTopic(subject)) return titleCasePhrase(subject);
  const stripped = String(sentence || "").replace(/^(if|when|because|although|while)\s+/i, "");
  const words = stripped
    .replace(/[^A-Za-z\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP.has(word.toLowerCase()));
  const take = words.slice(0, 3).join(" ");
  if (take && isUsableTopic(take)) return titleCasePhrase(take);
  return "";
}

function headingLines(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/^#+\s*/, "").replace(/^[-*•]+\s*/, "").trim())
    .filter((line) => line.length >= 3 && line.length <= 40 && !/[.!?]$/.test(line))
    .filter((line) => isUsableTopic(line) && !isBibliographicJunk(line));
}

/**
 * Short concept labels from paper body — not citation lines or sentence dumps.
 */
function citationLeadNames(text) {
  const names = new Set();
  String(text || "")
    .split(/\n+/)
    .forEach((line) => {
      if (!isBibliographicJunk(line)) return;
      const first = line.replace(/\s+/g, " ").trim().split(/[,\s]/)[0];
      if (first && /^[A-Z][a-z]{3,}$/.test(first)) names.add(first.toLowerCase());
    });
  return names;
}

export function extractConceptLabels(text, { exclude = [], limit = 6 } = {}) {
  const blocked = new Set(exclude.map((item) => String(item || "").toLowerCase().trim()).filter(Boolean));
  citationLeadNames(text).forEach((name) => blocked.add(name));
  const labels = [];
  const seen = new Set(blocked);

  function add(label, detail = "") {
    const clean = titleCasePhrase(String(label || "").replace(/[.:;]+$/, ""));
    if (!isUsableTopic(clean) || LABEL_LEAD_VERB.test(clean)) return;
    if (clean.split(/\s+/).length > 4 || /…/.test(clean)) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    if (detail && isBibliographicJunk(detail)) return;
    seen.add(key);
    labels.push({
      label: clipLabel(clean, 28),
      detail: isConceptualClaim(detail) ? detail : "",
    });
  }

  const claims = sentencesFromSource(text, { min: 18, max: 220 }).filter(isConceptualClaim);
  for (const sentence of claims) {
    enumeratedPhrases(sentence).forEach((phrase) => add(phrase, sentence));
  }
  for (const sentence of claims) {
    add(subjectOfClaim(sentence), sentence);
  }
  headingLines(text).forEach((line) => add(line));

  if (labels.length < 2) {
    for (const sentence of claims) {
      add(compactLabelFromSentence(sentence), sentence);
      if (labels.length >= limit) break;
    }
  }

  return labels.slice(0, limit);
}

function titleFromSourceName(name) {
  const base = String(name || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "";
  const tokens = base.split(" ").filter((token) => !/^(19|20)\d{2}$/.test(token));
  const drop = new Set(["notes", "paper", "article", "pdf", "doc", "lecture", "reading"]);
  const meaningful = tokens.filter((token) => !drop.has(token.toLowerCase()));
  if (meaningful.length >= 2 && /^[A-Z][a-z]{4,}$/.test(meaningful[0])) {
    const rest = meaningful.slice(1).join(" ");
    if (isUsableTopic(rest)) return titleCasePhrase(rest);
  }
  const joined = meaningful.join(" ");
  if (isUsableTopic(joined)) return titleCasePhrase(joined);
  const last = meaningful[meaningful.length - 1];
  if (last && isUsableTopic(last)) return titleCasePhrase(last);
  return "";
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

function teachNarration(label, detail, { opening = false, struggle = false } = {}) {
  if (opening) {
    return struggle
      ? `Yeah, ${label} can feel messy. We'll pin the center, then add one piece at a time.`
      : `Here's ${label} on the board. Each node is a concept from your notes — not a citation.`;
  }
  const claim = String(detail || "").replace(/\s+/g, " ").trim();
  if (claim && isConceptualClaim(claim) && !isBibliographicJunk(claim)) {
    return `${label} — ${clipClaim(claim)}`;
  }
  return `${label} is one of the ideas the paper is actually arguing.`;
}

function ensureSteps(nodes, links) {
  const steps = [
    {
      revealNodeIds: [nodes[0].id],
      revealLinkIds: [],
      narration: teachNarration(nodes[0].label, nodes[0].detail, { opening: true }),
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
      narration: teachNarration(node.label, node.detail),
    });
  }
  return steps;
}

function cleanNode(node, index) {
  const id = String(node?.id || `n${index}`).trim();
  const label = clipLabel(node?.label || node?.text || "", 42);
  if (!id || !label || WEAK_TOPIC.test(label) || isBibliographicJunk(label)) return null;
  const detail = String(node?.detail || "").trim();
  return {
    id,
    label,
    detail: isBibliographicJunk(detail) ? "" : detail,
    x: Number.isFinite(node?.x) ? node.x : undefined,
    y: Number.isFinite(node?.y) ? node.y : undefined,
  };
}

/**
 * Validate and fill a mind-map outline: nodes, links, stepwise reveal order.
 */
export function normalizeMindMap(raw = {}) {
  const incomingTitle = String(raw.title || "").trim();
  const title =
    incomingTitle && !WEAK_TOPIC.test(incomingTitle) && !isBibliographicJunk(incomingTitle)
      ? incomingTitle
      : "Concept";
  const incomingNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const nodes = incomingNodes.map((node, index) => cleanNode(node, index)).filter(Boolean);

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
        .map((step) => {
          const narration = String(step?.narration || "").trim();
          return {
            revealNodeIds: (step?.revealNodeIds || []).filter((id) => ids.has(id)),
            revealLinkIds: (step?.revealLinkIds || []).filter((id) => links.some((link) => link.id === id)),
            narration: isBibliographicJunk(narration) ? "" : narration,
          };
        })
        .filter((step) => step.revealNodeIds.length > 0 || step.revealLinkIds.length > 0 || step.narration)
    : [];

  if (steps.length === 0) {
    steps = ensureSteps(laidOut, links);
  } else {
    steps = steps.map((step, index) => {
      if (step.narration) return step;
      const node = laidOut.find((item) => step.revealNodeIds.includes(item.id)) || laidOut[index];
      return {
        ...step,
        narration: teachNarration(node?.label || title, node?.detail, { opening: index === 0 }),
      };
    });
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

export function resolveMapTitle(concept, sourceText = "", sourceName = "") {
  const asked = String(concept || "").trim();
  if (isUsableTopic(asked)) return clipLabel(titleCasePhrase(asked), 28);
  const fromName = titleFromSourceName(sourceName);
  if (fromName) return clipLabel(fromName, 28);
  const guessed = guessTitle(sourceText, { sourceName });
  if (guessed) return clipLabel(guessed, 28);
  const firstLabel = extractConceptLabels(sourceText, { limit: 1 })[0]?.label;
  if (firstLabel) return firstLabel;
  return "Your notes";
}

export function buildMindMapFromConcept(
  concept,
  { sourceText = "", explanation = "", struggle = false, sourceName = "" } = {}
) {
  const title = resolveMapTitle(concept, sourceText || explanation, sourceName);
  const extracted = extractConceptLabels(explanation || sourceText, {
    exclude: [title],
    limit: 6,
  });

  const fallback = [
    { label: "What it is", detail: `What ${title} is, in one line.` },
    { label: "When to use it", detail: `When you would use ${title}.` },
    { label: "Common mix-up", detail: `A common mix-up with ${title}.` },
    { label: "How pieces connect", detail: `How the pieces of ${title} connect.` },
  ];

  const satellites = extracted.length >= 2 ? extracted : fallback;
  const nodes = [
    { id: "n0", label: clipLabel(title, 28), detail: struggle ? `Let's slow this down.` : "" },
    ...satellites.slice(0, 6).map((item, index) => ({
      id: slugId(item.label, `n${index + 1}`),
      label: clipLabel(item.label, 28),
      detail: item.detail,
    })),
  ];

  const uniqueNodes = [];
  const seen = new Set();
  for (const node of nodes) {
    if (seen.has(node.id) || !isUsableTopic(node.label)) continue;
    seen.add(node.id);
    uniqueNodes.push(node);
  }

  const links = uniqueNodes.slice(1).map((node, index) => ({
    id: `e${index + 1}`,
    from: "n0",
    to: node.id,
  }));

  const steps = [
    {
      revealNodeIds: ["n0"],
      revealLinkIds: [],
      narration: teachNarration(title, "", { opening: true, struggle }),
    },
    ...uniqueNodes.slice(1).map((node, index) => ({
      revealNodeIds: [node.id],
      revealLinkIds: [links[index].id],
      narration: teachNarration(node.label, node.detail),
    })),
  ];

  return normalizeMindMap({ title, nodes: uniqueNodes, links, steps });
}

export function guessTitle(text, { sourceName = "" } = {}) {
  const fromName = titleFromSourceName(sourceName);
  if (fromName) return fromName;

  const heading = headingLines(text).find((line) => isUsableTopic(line));
  if (heading) return titleCasePhrase(heading);

  const claims = sentencesFromSource(text, { min: 18, max: 220 }).filter(isConceptualClaim);
  for (const sentence of claims) {
    const subject = subjectOfClaim(sentence);
    if (isUsableTopic(subject)) return titleCasePhrase(subject);
  }

  const line = String(text || "")
    .split(/\n+/)
    .map((item) => item.replace(/^#+\s*/, "").trim())
    .find((item) => item.length >= 4 && item.length <= 60 && isUsableTopic(item));
  return line ? titleCasePhrase(line) : "";
}
