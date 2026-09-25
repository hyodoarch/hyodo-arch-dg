require("dotenv").config();
const settings = require("../../helpers/constants");
const { pickNoteMetadata } = require("../../helpers/bases-engine/noteMetadata");

const allSettings = settings.ALL_NOTE_SETTINGS;

module.exports = {
  eleventyComputed: {
    title: require('../../helpers/noteTemplate').noteTitle,
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

    folderNotes: require('../../helpers/folderNotes').folderNotes,

    settings: (data) => {
      const noteSettings = {};
      allSettings.forEach((setting) => {
        let noteSetting = data[setting];
        let globalSetting = process.env[setting];

        let settingValue =
          noteSetting || (globalSetting === "true" && noteSetting !== false);
        noteSettings[setting] = settingValue;
      });
      // Title and tags are placed explicitly in the note body with Nunjucks.
      noteSettings.dgShowInlineTitle = false;
      noteSettings.dgShowTags = false;
      return noteSettings;
    },
  },
};
