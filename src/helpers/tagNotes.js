const { property, isListedNote, noteCards } = require('./folderNotes');

function tagsForNote(item) {
  const value = property(item.data, 'tags') ?? [];
  return [...new Set((Array.isArray(value) ? value : [value])
    .filter(tag => typeof tag === 'string').map(tag => tag.trim())
    .filter(tag => tag && tag !== 'note' && tag !== 'gardenEntry'))];
}

function tagNames(notes = []) {
  return [...new Set(notes.filter(isListedNote).flatMap(tagsForNote))]
    .sort((a, b) => a.localeCompare(b, 'ja'));
}

function tagNotes(data) {
  return noteCards((data.collections?.note || [])
    .filter(item => isListedNote(item) && tagsForNote(item).includes(data.tagName)));
}

module.exports = { tagsForNote, tagNames, tagNotes };
