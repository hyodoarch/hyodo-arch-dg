import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { syncCommonImages, checkCommonImages } = require('./common-images.cjs');
const roots = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'dg-common-images-'));
  roots.push(project);
  const vault = path.join(project, 'vault');
  const image = 'images/common/banner.png';
  const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
  write(path.join(project, 'tools/common-images.json'), JSON.stringify([image]));
  write(path.join(project, 'src/site/_includes/sidebar.njk'), `<img src="/img/user/${image}">`);
  write(path.join(vault, image), 'original-image');
  return { project, vault, image, write, output: path.join(project, 'src/site/img/user', image) };
}
it('copies template-only images without notes and updates only changed files', () => {
  const { project, vault, image, output, write } = fixture();
  expect(syncCommonImages(project, vault)).toEqual([image]);
  expect(fs.readFileSync(output, 'utf8')).toBe('original-image');
  expect(syncCommonImages(project, vault)).toEqual([]);
  write(path.join(vault, image), 'replacement');
  expect(syncCommonImages(project, vault)).toEqual([image]);
  expect(fs.readFileSync(output, 'utf8')).toBe('replacement');
  expect(checkCommonImages(project)).toEqual([image]);
});
it('rejects missing sources before copying and preserves public images', () => {
  const { project, vault, image, output, write } = fixture();
  syncCommonImages(project, vault);
  write(path.join(vault, image), 'replacement');
  write(path.join(project, 'tools/common-images.json'), JSON.stringify([image, 'images/common/missing.png']));
  expect(() => syncCommonImages(project, vault)).toThrow('missing.png');
  expect(fs.readFileSync(output, 'utf8')).toBe('original-image');
});
it('blocks missing or empty public images without requiring a vault', () => {
  const { project, output, write } = fixture();
  expect(() => checkCommonImages(project)).toThrow('Missing or empty');
  write(output, '');
  expect(() => checkCommonImages(project)).toThrow('Missing or empty');
  write(output, 'public-image');
  expect(checkCommonImages(project)).toHaveLength(1);
});
it('requires newly referenced template images to be registered', () => {
  const { project, vault, write } = fixture();
  syncCommonImages(project, vault);
  write(path.join(project, 'src/site/_includes/nested/new.njk'), '<img src="/img/user/images/common/new.png">');
  write(path.join(project, 'src/site/img/user/images/common/new.png'), 'new-image');
  expect(() => checkCommonImages(project)).toThrow('Register template images');
});
it('rejects malformed and escaping manifest paths', () => {
  const { project, vault, write } = fixture();
  for (const manifest of [[], ['images/common/../../private.png'], ['images/common/a.png', 'images/common/a.png'], {}]) {
    write(path.join(project, 'tools/common-images.json'), JSON.stringify(manifest));
    expect(() => syncCommonImages(project, vault)).toThrow('Invalid');
  }
});
