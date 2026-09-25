const path = require('node:path');
const { escapeHtml } = require('markdown-it')().utils;

function noteTitle(data) {
  const title = data.title || data['dg-note-properties']?.title;
  if (typeof title === 'string' && title.trim()) return title.trim();
  if (data.page?.inputPath) return path.basename(data.page.inputPath, path.extname(data.page.inputPath));
  return data.page?.fileSlug || '';
}

function noteTags(data, tagSlug) {
  const value = data.tags ?? data['dg-note-properties']?.tags ?? [];
  const tags = [...new Set((Array.isArray(value) ? value : [value])
    .filter(tag => typeof tag === 'string').map(tag => tag.trim())
    .filter(tag => tag && tag !== 'note' && tag !== 'gardenEntry'))];
  if (!tags.length) return '';
  // Encode # so DG's subsequent taggify filter does not create nested links.
  return '<div class="note-tags">' + tags.map(tag =>
    `<a class="tag" href="/tags/${escapeHtml(tagSlug(tag))}/">&#35;${escapeHtml(tag)}</a>`
  ).join(' ') + '</div>\n';
}

module.exports = { noteTitle, noteTags };
