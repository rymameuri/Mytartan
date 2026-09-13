import { buildMindMapFromConcept, normalizeMindMap, visibleMindMap } from "./mindMap";

const RAW = {
  title: "Recursion",
  nodes: [
    { id: "n0", label: "Recursion" },
    { id: "n1", label: "Base case", detail: "Stop when the input is simple enough." },
    { id: "n2", label: "Recursive case", detail: "Call the same problem on a smaller input." },
  ],
  links: [
    { id: "e1", from: "n0", to: "n1" },
    { id: "e2", from: "n0", to: "n2" },
  ],
};

describe("mind-map data shape", () => {
  test("normalizeMindMap fills positions, links, and stepwise order", () => {
    const map = normalizeMindMap({
      title: "Stacks",
      nodes: [{ label: "Stacks" }, { label: "Push" }, { label: "Pop" }],
    });
    expect(map.title).toBe("Stacks");
    expect(map.nodes.length).toBe(3);
    expect(map.nodes[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), label: "Stacks", x: expect.any(Number), y: expect.any(Number) })
    );
    expect(map.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: map.nodes[0].id, to: map.nodes[1].id }),
      ])
    );
    expect(map.steps.length).toBe(map.nodes.length);
    expect(map.steps[0].revealNodeIds).toContain(map.nodes[0].id);
    expect(map.steps[1].revealLinkIds.length).toBeGreaterThan(0);
    map.steps.forEach((step) => {
      expect(step).toEqual(
        expect.objectContaining({
          revealNodeIds: expect.any(Array),
          revealLinkIds: expect.any(Array),
          narration: expect.any(String),
        })
      );
    });
  });

  test("visibleMindMap reveals nodes and edges in order", () => {
    const map = normalizeMindMap(RAW);
    const first = visibleMindMap(map, 0);
    expect(first.visibleNodeIds).toEqual(["n0"]);
    expect(first.visibleLinkIds).toEqual([]);

    const second = visibleMindMap(map, 1);
    expect(second.visibleNodeIds).toEqual(expect.arrayContaining(["n0", "n1"]));
    expect(second.visibleLinkIds).toContain("e1");

    const last = visibleMindMap(map, 99);
    expect(last.visibleNodeIds).toHaveLength(3);
    expect(last.visibleLinkIds).toHaveLength(2);
  });

  test("buildMindMapFromConcept uses the student outline, not campus policy", () => {
    const map = buildMindMapFromConcept("binary search", {
      sourceText:
        "Binary search looks at the middle of a sorted list.\nIf the target is smaller, search the left half.\nIf it is larger, search the right half.",
      struggle: true,
    });
    expect(map.title).toMatch(/binary search/i);
    expect(map.nodes.length).toBeGreaterThanOrEqual(3);
    expect(map.steps[0].narration.toLowerCase()).toMatch(/messy|binary search/);
    const blob = JSON.stringify(map).toLowerCase();
    expect(blob).not.toMatch(/caps|financial aid|add\/drop/);
  });

  test("drops links that point at missing nodes", () => {
    const map = normalizeMindMap({
      title: "X",
      nodes: [{ id: "a", label: "A" }],
      links: [{ from: "a", to: "missing" }],
    });
    expect(map.links).toHaveLength(0);
  });
});
