require('dotenv').config();
const { ALL_NOTE_SETTINGS } = require('../../helpers/constants');
const { tagNames, tagNotes } = require('../../helpers/tagNotes');

module.exports = {
  layout: 'layouts/note.njk',
  pagination: {
    data: 'collections.note',
    size: 1,
    alias: 'tagName',
    before: tagNames,
  },
  eleventyComputed: {
    title: data => data.tagName,
    permalink: data => `/tags/${String(data.tagName).trim().replace(/\s+/g, '-').replace(/[\/\\?#%]/g, '-')}/`,
    tagNotes,
    settings: data => {
      const values = {};
      ALL_NOTE_SETTINGS.forEach(key => {
        values[key] = data[key] || (process.env[key] === 'true' && data[key] !== false);
      });
      values.dgShowInlineTitle = false;
      values.dgShowTags = false;
      return values;
    },
  },
};
