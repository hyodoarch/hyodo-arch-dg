import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { folderNotes, thumbnailUrl } = require('./folderNotes');
const item = (name, props = {}, folder = '古民家リノベーション') => ({
  filePathStem: `/notes/${folder}/${name}`, url: `/projects/${name}/`,
  data: {'dg-note-properties': {'dg-publish': true, ...props}},
});
const page = notes => ({page: {filePathStem: '/notes/古民家リノベーション/index'}, collections: {note: notes}});
describe('category index', () => {
  it('includes only published visible siblings, excluding index and nested/other categories', () => {
    const notes = [item('掲載'), item('index'), item('非公開', {'dg-publish': false}),
      item('非表示', {'dg-hide': true}), item('別カテゴリー', {}, '新築住宅'), item('子階層/作品')];
    expect(folderNotes(page(notes)).map(n => n.title)).toEqual(['掲載']);
    expect(folderNotes({page: {filePathStem: '/notes/古民家リノベーション/掲載'}, collections: {note: notes}})).toEqual([]);
  });
  it('reads metadata, orders numerically and falls back to the filename', () => {
    const notes = [item('最後'), item('二番', {order: '20'}), item('一番', {order: 10, title: '別タイトル', description: '段落1\n\r\n段落2'})];
    const result = folderNotes(page(notes));
    expect(result.map(n=>n.title)).toEqual(['二番','別タイトル','最後']);
    expect(result[1].description).toBe('段落1 段落2');
    notes[2].data['dg-note-properties'].description = '更新後';
    expect(folderNotes(page(notes))[1].description).toBe('更新後');
  });
  it('sorts descending with zero and negatives, keeps invalid values last and titles ascending on ties', () => {
    const notes = [item('え', {order: ' '}), item('あ', {order: 2}), item('い', {order: '2'}),
      item('zero', {order: 0}), item('negative', {order: -1}), item('う'), item('お', {order: false})];
    expect(folderNotes(page(notes)).map(n => n.title)).toEqual(['あ', 'い', 'zero', 'negative', 'う', 'え', 'お']);
  });
  it('supports local wiki thumbnails and rejects unsafe URL schemes', () => {
    expect(thumbnailUrl('[[images/sekiguchi/ic-sugito_IGP3086.jpg]]')).toBe('/img/user/images/sekiguchi/ic-sugito_IGP3086.jpg');
    expect(thumbnailUrl('![photo](https://example.com/photo.jpg)')).toBe('https://example.com/photo.jpg');
    expect(thumbnailUrl('javascript:alert(1)')).toBe('');
    expect(thumbnailUrl(undefined)).toBe('');
  });
});
