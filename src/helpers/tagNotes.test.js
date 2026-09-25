import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { tagNames, tagNotes } = require('./tagNotes');
const item = (name, tags, props = {}) => ({
  filePathStem: `/notes/${name}`, url: `/projects/${name}/`,
  data: { 'dg-note-properties': { 'dg-publish': true, tags, ...props } },
});
const page = notes => ({ tagName: '古民家', collections: { note: notes } });

describe('tag indexes without index.md', () => {
  it('groups across folders and excludes unpublished, hidden and index notes', () => {
    const notes = [item('A/作品1', ['古民家', 'note', 'gardenEntry', '古民家']),
      item('B/作品2', '古民家'), item('A/index', '索引'),
      item('秘密', '非公開タグ', {'dg-publish': false}), item('隠す', '隠すタグ', {'dg-hide': true})];
    expect(tagNames(notes)).toEqual(['古民家']);
    expect(tagNotes(page(notes)).map(n => n.title)).toEqual(['作品1', '作品2']);
  });
  it('uses the same metadata and numeric order as category cards, and reflects updates', () => {
    const notes = [item('A/末尾', '古民家'), item('B/最初', '古民家', {
      order: '10', title: '別タイトル', thumbnail: '[[images/sekiguchi/ic-sugito_IGP3086.jpg]]', description: '説明\n続き',
    })];
    const cards = tagNotes(page(notes));
    expect(cards.map(n => n.title)).toEqual(['別タイトル', '末尾']);
    expect(cards[0]).toMatchObject({ thumbnail: '/img/user/images/sekiguchi/ic-sugito_IGP3086.jpg', description: '説明 続き' });
    notes[1].data['dg-note-properties'].tags = ['別タグ'];
    expect(tagNotes(page(notes))).toHaveLength(1);
  });
  it('supports top-level tags, trims whitespace and ignores invalid values', () => {
    const note = {filePathStem: '/notes/作品', url: '/作品/', data: {'dg-publish': true, tags: [' 古民家 ', null, 5, '']}};
    expect(tagNames([note])).toEqual(['古民家']);
    expect(tagNotes(page([note]))).toHaveLength(1);
    expect(tagNames()).toEqual([]);
    expect(tagNotes({})).toEqual([]);
  });
});

