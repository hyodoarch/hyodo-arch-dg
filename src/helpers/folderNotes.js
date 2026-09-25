const { noteTitle } = require('./noteTemplate');
const { resolveImage } = require('./imageAssets');

function property(data, key) {
  return data['dg-note-properties']?.[key] ?? data[key];
}

function thumbnailUrl(value) {
  if (typeof value !== 'string') return '';
  let src = value.trim();
  const wiki = src.match(/^!?\[\[([^\]]+)\]\]$/);
  const markdown = src.match(/^!?\[[^\]]*\]\(([^)]+)\)$/);
  if (wiki) src = wiki[1].split('|')[0].trim();
  else if (markdown) src = markdown[1].replace(/^<|>$/g, '').trim();
  if (/^https?:\/\//i.test(src) || /^\/(?!\/)/.test(src)) return src;
  if (!src || /^[a-z][a-z\d+.-]*:/i.test(src) || src.startsWith('//')) return '';
  return resolveImage(src);
}

function isListedNote(item) {
  return !item.filePathStem?.endsWith('/index') &&
    property(item.data, 'dg-publish') === true &&
    !property(item.data, 'dg-hide') && !item.data.hide && !item.data.hideInFiletree;
}

function noteCards(items) {
  return items
    .map(item => {
      const rawOrder = property(item.data, 'order');
      const order = rawOrder !== '' && rawOrder != null && Number.isFinite(Number(rawOrder))
        ? Number(rawOrder) : Infinity;
      return {
        title: noteTitle({...item.data, page: item.data.page || {inputPath: item.filePathStem + '.md'}}),
        url: item.url,
        thumbnail: thumbnailUrl(property(item.data, 'thumbnail')),
        description: String(property(item.data, 'description') || '').replace(/\s+/g, ' ').trim(),
        order,
      };
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ja'));
}

function folderNotes(data) {
  const stem = data.page?.filePathStem;
  if (!stem?.endsWith('/index')) return [];
  const folder = stem.slice(0, stem.lastIndexOf('/'));
  return noteCards((data.collections?.note || [])
    .filter(item => {
      const itemStem = item.filePathStem || '';
      return itemStem !== stem && !itemStem.endsWith('/index') &&
        itemStem.slice(0, itemStem.lastIndexOf('/')) === folder &&
        isListedNote(item);
    })
  );
}

module.exports = { folderNotes, thumbnailUrl, property, isListedNote, noteCards };
