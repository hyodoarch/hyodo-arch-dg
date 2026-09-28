import { describe, it, expect } from "vitest";
import { getFileTree } from "./filetreeUtils.js";

// Helper to build a minimal note object for testing
function makeNote(filePathStem, data = {}) {
  return {
    filePathStem: `/notes${filePathStem}`,
    data: {
      permalink: filePathStem,
      ...data,
    },
  };
}

describe("filetreeUtils", () => {
  describe("ordinary note order", () => {
    const notes = (tree) => Object.keys(tree).filter(key => tree[key].isNote && key !== 'index.md');

    it("sorts numeric values before missing or invalid orders, with Japanese title ties", () => {
      const tree = getFileTree({ collections: { note: [
        makeNote('/works/index', { order: -100 }),
        makeNote('/works/z', { order: '2', title: 'あ' }),
        makeNote('/works/a', { order: 10 }),
        makeNote('/works/tie', { order: 2, title: 'い' }),
        makeNote('/works/zero', { order: 0 }),
        makeNote('/works/negative', { 'dg-note-properties': { order: -1 } }),
        makeNote('/works/missing', { title: 'う' }),
        makeNote('/works/invalid', { order: 'bad', title: 'え' }),
        makeNote('/works/blank', { order: ' ', title: 'お' }),
      ] } });
      expect(notes(tree.works)).toEqual(['a.md', 'z.md', 'tie.md', 'zero.md', 'negative.md', 'missing.md', 'invalid.md', 'blank.md']);
    });

    it("applies recursively, overrides navigation and pinning, and preserves folder slots", () => {
      const tree = getFileTree({ collections: { note: [
        makeNote('/works/first', { order: 1 }),
        makeNote('/works/last', { order: 20, pinned: true }),
        makeNote('/works/sub/index', { order: 5 }),
        makeNote('/works/sub/a', { order: 10 }),
        makeNote('/works/sub/z', { order: 1 }),
      ] }, navigationOrder: { '/works': ['last', 'sub', 'first'] } });
      expect(Object.keys(tree.works).filter(key => key !== 'isFolder')).toEqual(['last.md', 'sub', 'first.md']);
      expect(notes(tree.works.sub)).toEqual(['a.md', 'z.md']);
    });
  });

  describe("folder index order", () => {
    const folders = (tree) => Object.keys(tree).filter((key) => tree[key].isFolder);

    it("sorts numeric orders first, accepts zero and numeric strings, and ignores invalid values", () => {
      const tree = getFileTree({ collections: { note: [
        makeNote('/z/index', { order: '2' }),
        makeNote('/a/index', { order: 10 }),
        makeNote('/zero/index', { order: 0 }),
        makeNote('/blank/index', { order: ' ' }),
        makeNote('/bool/index', { order: false }),
        makeNote('/invalid/index', { order: 'invalid' }),
        makeNote('/missing/child', { order: -100 }),
        makeNote('/infinite/index', { order: Infinity }),
      ] } });
      expect(folders(tree)).toEqual(['a', 'z', 'zero', 'blank', 'bool', 'infinite', 'invalid', 'missing']);
    });

    it("applies nested index metadata, breaks ties by name, and overrides navigation folder order only", () => {
      const tree = getFileTree({ collections: { note: [
        makeNote('/parent/b/index', { 'dg-note-properties': { order: 10 } }),
        makeNote('/parent/a/index', { order: 10 }),
        makeNote('/parent/z/index', { order: -1 }),
        makeNote('/parent/ordinary'),
      ] }, navigationOrder: { '/parent': ['b', 'ordinary', 'a', 'z'] } });
      expect(folders(tree.parent)).toEqual(['a', 'b', 'z']);
      expect(Object.keys(tree.parent).filter(key => key !== 'isFolder'))
        .toEqual(['a', 'ordinary.md', 'b', 'z']);
    });
  });

  describe("getFileTree without navigation ordering", () => {
    it("sorts folders before files, then alphabetically", () => {
      const data = {
        collections: {
          note: [
            makeNote("/zebra"),
            makeNote("/alpha/note1"),
            makeNote("/beta"),
          ],
        },
      };

      const tree = getFileTree(data);
      const keys = Object.keys(tree);

      // "alpha" folder should come before files
      expect(keys[0]).toBe("alpha");
      // Then files alphabetically
      expect(keys[1]).toBe("beta.md");
      expect(keys[2]).toBe("zebra.md");
    });
  });

  describe("getFileTree with navigation ordering", () => {
    it("respects ordering from navigationOrder for known items", () => {
      const data = {
        collections: {
          note: [
            makeNote("/alpha"),
            makeNote("/beta"),
            makeNote("/gamma"),
          ],
        },
        navigationOrder: {
          "/": ["gamma.md", "alpha.md", "beta.md"],
        },
      };

      const tree = getFileTree(data);
      const keys = Object.keys(tree);

      expect(keys[0]).toBe("gamma.md");
      expect(keys[1]).toBe("alpha.md");
      expect(keys[2]).toBe("beta.md");
    });

    it("appends unknown items after ordered items using default sort", () => {
      const data = {
        collections: {
          note: [
            makeNote("/alpha"),
            makeNote("/beta"),
            makeNote("/gamma"),
            makeNote("/folder1/child"),
          ],
        },
        navigationOrder: {
          "/": ["gamma.md", "alpha.md"],
        },
      };

      const tree = getFileTree(data);
      const keys = Object.keys(tree);

      // Ordered items first
      expect(keys[0]).toBe("gamma.md");
      expect(keys[1]).toBe("alpha.md");
      // Then unordered: folders before files, then alphabetical
      expect(keys[2]).toBe("folder1");
      expect(keys[3]).toBe("beta.md");
    });

    it("skips items in ordering that do not exist in tree", () => {
      const data = {
        collections: {
          note: [
            makeNote("/alpha"),
            makeNote("/beta"),
          ],
        },
        navigationOrder: {
          "/": ["deleted-note.md", "alpha.md", "beta.md"],
        },
      };

      const tree = getFileTree(data);
      const keys = Object.keys(tree);

      expect(keys).toEqual(["alpha.md", "beta.md"]);
    });

    it("applies ordering to nested folders", () => {
      const data = {
        collections: {
          note: [
            makeNote("/myfolder/zebra"),
            makeNote("/myfolder/alpha"),
            makeNote("/myfolder/middle"),
          ],
        },
        navigationOrder: {
          "/myfolder": ["middle.md", "zebra.md", "alpha.md"],
        },
      };

      const tree = getFileTree(data);
      const folderKeys = Object.keys(tree["myfolder"]).filter(
        (k) => k !== "isFolder"
      );

      expect(folderKeys[0]).toBe("middle.md");
      expect(folderKeys[1]).toBe("zebra.md");
      expect(folderKeys[2]).toBe("alpha.md");
    });

    it("resolves ordering names without .md extension", () => {
      const data = {
        collections: {
          note: [
            makeNote("/alpha"),
            makeNote("/beta"),
            makeNote("/gamma"),
          ],
        },
        navigationOrder: {
          "/": ["gamma", "alpha", "beta"],
        },
      };

      const tree = getFileTree(data);
      const keys = Object.keys(tree);

      expect(keys[0]).toBe("gamma.md");
      expect(keys[1]).toBe("alpha.md");
      expect(keys[2]).toBe("beta.md");
    });

    it("respects ordering for notes with dg-path from rewrite rules (.md extension)", () => {
      // Path rewrite rules produce a dg-path that includes the ".md" extension
      // (e.g. "Path Rewriting/note.md" -> dg-path "note.md"). The navigation
      // ordering stored by the plugin uses stems without the extension.
      const data = {
        collections: {
          note: [
            makeNote("/zebra", { "dg-path": "zebra.md" }),
            makeNote("/alpha", { "dg-path": "alpha.md" }),
            makeNote("/beta", { "dg-path": "beta.md" }),
          ],
        },
        navigationOrder: {
          "/": ["beta", "zebra", "alpha"],
        },
      };

      const tree = getFileTree(data);
      const keys = Object.keys(tree);

      expect(keys[0]).toBe("beta.md");
      expect(keys[1]).toBe("zebra.md");
      expect(keys[2]).toBe("alpha.md");
    });

    it("respects ordering for nested folders from rewrite rules (.md extension)", () => {
      const data = {
        collections: {
          note: [
            makeNote("/old/zebra", { "dg-path": "renamed/zebra.md" }),
            makeNote("/old/alpha", { "dg-path": "renamed/alpha.md" }),
            makeNote("/old/middle", { "dg-path": "renamed/middle.md" }),
          ],
        },
        navigationOrder: {
          "/renamed": ["middle", "zebra", "alpha"],
        },
      };

      const tree = getFileTree(data);
      const folderKeys = Object.keys(tree["renamed"]).filter(
        (k) => k !== "isFolder"
      );

      expect(folderKeys[0]).toBe("middle.md");
      expect(folderKeys[1]).toBe("zebra.md");
      expect(folderKeys[2]).toBe("alpha.md");
    });

    it("preserves dots in note names that are not the .md extension", () => {
      const data = {
        collections: {
          note: [makeNote("/my-note-v1.2", { "dg-path": "my-note-v1.2" })],
        },
      };

      const tree = getFileTree(data);
      const keys = Object.keys(tree);

      // The dot in "v1.2" must not be treated as an extension boundary
      expect(keys).toEqual(["my-note-v1.2.md"]);
    });

    it("falls back to default sort when navigationOrder is empty object", () => {
      const data = {
        collections: {
          note: [
            makeNote("/zebra"),
            makeNote("/alpha"),
          ],
        },
        navigationOrder: {},
      };

      const tree = getFileTree(data);
      const keys = Object.keys(tree);

      expect(keys[0]).toBe("alpha.md");
      expect(keys[1]).toBe("zebra.md");
    });
  });

  describe("hide flags", () => {
    it("does not hide a normal note", () => {
      const data = { collections: { note: [makeNote("/normal")] } };
      const tree = getFileTree(data);
      expect(tree["normal.md"].hide).toBeFalsy();
    });

    it("hides a note with hide:true (dg-hide)", () => {
      const data = {
        collections: { note: [makeNote("/secret", { hide: true })] },
      };
      const tree = getFileTree(data);
      expect(tree["secret.md"].hide).toBe(true);
    });

    it("hides a note with hideInFiletree:true (dg-hide-in-filetree)", () => {
      const data = {
        collections: {
          note: [makeNote("/treeonly", { hideInFiletree: true })],
        },
      };
      const tree = getFileTree(data);
      expect(tree["treeonly.md"].hide).toBe(true);
    });
  });
});
