import { describe, it, expect } from "vitest";
import { getGraph } from "./linkUtils.js";

// Minimal note stub matching what getGraph reads.
function makeNote(slug, data = {}, content = "") {
  return {
    filePathStem: `/notes/${slug}`,
    url: `/${slug}/`,
    fileSlug: slug,
    data: { title: slug, ...data },
    template: { read: async () => ({ content }) },
  };
}

async function buildGraph(notes) {
  return getGraph({ collections: { note: notes } });
}

describe("linkUtils getGraph hide flags", () => {
  it("does not hide or privatize a normal note", async () => {
    const graph = await buildGraph([makeNote("normal")]);
    expect(graph.nodes["/normal/"].hide).toBe(false);
    expect(graph.nodes["/normal/"].private).toBe(false);
  });

  it("hides and privatizes a note with hide:true (dg-hide)", async () => {
    const graph = await buildGraph([makeNote("secret", { hide: true })]);
    expect(graph.nodes["/secret/"].hide).toBe(true);
    expect(graph.nodes["/secret/"].private).toBe(true);
  });

  it("hides but does not privatize a note with hideInGraph:true", async () => {
    const graph = await buildGraph([
      makeNote("graphonly", { hideInGraph: true }),
    ]);
    expect(graph.nodes["/graphonly/"].hide).toBe(true);
    expect(graph.nodes["/graphonly/"].private).toBe(false);
  });

  it("does not hide a filetree-only note from the graph", async () => {
    const graph = await buildGraph([
      makeNote("treeonly", { hideInFiletree: true }),
    ]);
    expect(graph.nodes["/treeonly/"].hide).toBe(false);
    expect(graph.nodes["/treeonly/"].private).toBe(false);
  });
});

describe("linkUtils getGraph tags", () => {
  it("connects published notes to shared tags without adding note backlinks", async () => {
    const graph = await buildGraph([
      makeNote("one", { "dg-publish": true, tags: [" 和障子 ", "和障子", "note", "gardenEntry", ""] }, '[[two|two]]'),
      makeNote("two", { "dg-publish": true, "dg-note-properties": { tags: ["和障子", "建具/木製"] } }),
    ]);

    expect(graph.tagNodes).toEqual([
      { id: 2, title: "#和障子", url: "/tags/和障子/" },
      { id: 3, title: "#建具/木製", url: "/tags/建具-木製/" },
    ]);
    expect(graph.tagLinks).toEqual([
      { source: 0, target: 2 },
      { source: 1, target: 2 },
      { source: 1, target: 3 },
    ]);
    expect(graph.links).toEqual([{ source: 0, target: 1 }]);
    expect(graph.nodes["/two/"].backLinks).toEqual(["/one/"]);
    expect(graph.nodes["/two/"].neighbors).toEqual(["/one/"]);
  });

  it("uses graph visibility independently of tag-page eligibility", async () => {
    const graph = await buildGraph([
      makeNote("unpublished", { "dg-publish": false, tags: ["未公開"] }),
      makeNote("private", { "dg-publish": true, "dg-hide": true, tags: ["非表示"] }),
      makeNote("hidden-in-graph", { "dg-publish": true, hideInGraph: true, tags: ["グラフ非表示"] }),
      makeNote("hidden-in-tree", { "dg-publish": true, hideInFiletree: true, tags: "一覧ページなし" }),
    ]);

    expect(graph.tagNodes).toEqual([{ id: 4, title: "#一覧ページなし", url: null }]);
    expect(graph.tagLinks).toEqual([{ source: 3, target: 4 }]);
  });
});
