require("dotenv").config();
const settings = require("../../helpers/constants");
const { pickNoteMetadata } = require("../../helpers/bases-engine/noteMetadata");

const allSettings = settings.ALL_NOTE_SETTINGS;

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

  // [[image.jpg]] または ![[image.jpg]] を処理
  const wikilink = src.match(/^!?\[\[([^\]]+)\]\]$/);

  if (wikilink) {
    src = wikilink[1]
      .split("|")[0]
      .split("#")[0]
      .trim();
  }

  // Markdown形式の画像リンクにも対応
  const markdownLink = src.match(/^!?\[[^\]]*\]\(([^)]+)\)$/);

  if (markdownLink) {
    src = markdownLink[1].trim();
  }

  // 外部画像・絶対パスはそのまま
  if (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("/")
  ) {
    return src;
  }

  return encodeURI("/img/user/" + src);
}

module.exports = {
  eleventyComputed: {
    layout: (data) => {
      if (data.tags.indexOf("gardenEntry") != -1) {
        return "layouts/index.njk";
      }
      return "layouts/note.njk";
    },
    permalink: (data) => {
      if (data.tags.indexOf("gardenEntry") != -1) {
        return "/";
      }
      return data.permalink || undefined;
    },
    basesNotes: (data) => {
      if (!data.collections || !data.collections.note) return [];
      return data.collections.note.map((item) => ({
        path: item.filePathStem.replace("/notes/", ""),
        url: item.url,
        metadata: pickNoteMetadata(item.data),
        fileSlug: item.fileSlug,
      }));
    },

　　folderNotes: (data) => {
      if (!data.collections || !data.collections.note || !data.page) {
        return [];
      }
    
      const currentStem = data.page.filePathStem;
    
      // index.md 以外では何もしない
      if (!currentStem || !currentStem.endsWith("/index")) {
        return [];
      }
    
      // 現在の index.md があるフォルダ
      const currentFolder = currentStem.slice(
        0,
        currentStem.lastIndexOf("/")
      );
    
      return data.collections.note
        .filter((item) => {
          // index.md 自身は除外
          if (item.filePathStem === currentStem) {
            return false;
          }
    
          const itemFolder = item.filePathStem.slice(
            0,
            item.filePathStem.lastIndexOf("/")
          );
    
          // 同じフォルダのノートだけ
          return (
            itemFolder === currentFolder &&
            !item.data.hide &&
            !item.data.hideInFiletree
          );
        })
        .map((item) => ({
          title: item.data.title || item.fileSlug,
          url: item.url,
        }))
        .sort((a, b) => a.title.localeCompare(b.title, "ja"));
    },
    
    settings: (data) => {
      const noteSettings = {};
      allSettings.forEach((setting) => {
        let noteSetting = data[setting];
        let globalSetting = process.env[setting];

        let settingValue =
          noteSetting || (globalSetting === "true" && noteSetting !== false);
        noteSettings[setting] = settingValue;
      });
      return noteSettings;
    },
  },
};
