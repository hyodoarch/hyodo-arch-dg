function tagSlug(tag) {
  return String(tag)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[\/\\?#%]/g, "-");
}

function getUserProperty(data, key) {
  const props = data && data["dg-note-properties"];

  if (props && props[key] !== undefined) {
    return props[key];
  }

  return data ? data[key] : undefined;
}

function getThumbnailUrl(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  let src = value.trim();

  // [[image.jpg]] または ![[image.jpg]]
  const wikilink = src.match(/^!?\[\[([^\]]+)\]\]$/);

  if (wikilink) {
    src = wikilink[1]
      .split("|")[0]
      .split("#")[0]
      .trim();
  }

  // Markdown形式
  const markdownLink = src.match(/^!?\[[^\]]*\]\(([^)]+)\)$/);

  if (markdownLink) {
    src = markdownLink[1].trim();
  }

  // 外部画像・絶対パス
  if (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("/")
  ) {
    return src;
  }

  return encodeURI("/img/user/" + src);
}

function normalizeTags(tags) {
  if (!tags) return [];
  return Array.isArray(tags) ? tags : [tags];
}

module.exports = {
  layout: "layouts/note.njk",

  pagination: {
    data: "collections.note",
    size: 1,
    alias: "tagName",

    before: (notes) => {
      const tagSet = new Set();

      for (const note of notes || []) {
        const tags = normalizeTags(note.data.tags);

        for (const tag of tags) {
          if (!tag) continue;
          if (tag === "note") continue;
          if (tag === "gardenEntry") continue;

          tagSet.add(String(tag));
        }
      }

      return [...tagSet].sort((a, b) =>
        a.localeCompare(b, "ja")
      );
    },
  },

  eleventyComputed: {
    title: (data) => {
      return "#" + data.tagName;
    },

    permalink: (data) => {
      return `/tags/${tagSlug(data.tagName)}/`;
    },

    tagNotes: (data) => {
      if (!data.collections || !data.collections.note) {
        return [];
      }

      return data.collections.note
        .filter((item) => {
          const tags = normalizeTags(item.data.tags)
            .map((tag) => String(tag));

          return (
            tags.includes(String(data.tagName)) &&
            !item.data.hide
          );
        })
        .map((item) => {
          const thumbnail = getUserProperty(
            item.data,
            "thumbnail"
          );

          const description = getUserProperty(
            item.data,
            "description"
          );

          return {
            title: item.data.title || item.fileSlug,
            url: item.url,
            thumbnail: getThumbnailUrl(thumbnail),
            description: description
              ? String(description)
              : "",
          };
        })
        .sort((a, b) =>
          a.title.localeCompare(b.title, "ja")
        );
    },
  },
};
