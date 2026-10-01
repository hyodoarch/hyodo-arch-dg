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
  write(path.join(project, 'src/site/_includes/sidebar.njk'), `<img src="/img/${path.basename(image)}">`);
  write(path.join(vault, image), 'original-image');
  return { project, vault, image, write, output: path.join(project, 'src/site/img', path.basename(image)) };
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
  write(path.join(project, 'src/site/_includes/nested/new.njk'), '<img src="/img/new.png">');
  write(path.join(project, 'src/site/img/new.png'), 'new-image');
  expect(() => checkCommonImages(project)).toThrow('Register template images');
});
it('checks standalone page images as well as layout includes', () => {
  const { project, vault, write } = fixture();
  syncCommonImages(project, vault);
  write(path.join(project, 'src/site/404.njk'), '<img src="/img/banner.png">');
  expect(checkCommonImages(project)).toHaveLength(1);
  write(path.join(project, 'src/site/404.njk'), '<img src="/img/unregistered.jpg">');
  expect(() => checkCommonImages(project)).toThrow('unregistered.jpg');
  write(path.join(project, 'src/site/404.njk'), '<img src="/img/user/images/common/banner.png">');
  expect(() => checkCommonImages(project)).toThrow('Use /img/<filename>');
});
it('rejects malformed and escaping manifest paths', () => {
  const { project, vault, write } = fixture();
  for (const manifest of [[], ['images/common/../../private.png'], ['images/common/a.png', 'images/common/a.png'], {}]) {
    write(path.join(project, 'tools/common-images.json'), JSON.stringify(manifest));
    expect(() => syncCommonImages(project, vault)).toThrow('Invalid');
  }
});

it('does not recreate plugin-managed copies, and old copies cannot satisfy the check', () => {
  const { project, vault, image, output, write } = fixture();
  const old = path.join(project, 'src/site/img/user', image);
  syncCommonImages(project, vault);
  expect(fs.existsSync(old)).toBe(false);
  fs.unlinkSync(output);
  write(old, 'obsolete-copy');
  expect(() => checkCommonImages(project)).toThrow('Missing or empty');
  syncCommonImages(project, vault);
  expect(fs.readFileSync(output, 'utf8')).toBe('original-image');
  expect(fs.readFileSync(old, 'utf8')).toBe('obsolete-copy');
});
it('rejects template links into the plugin-managed common image directory', () => {
  const { project, vault, image, write } = fixture();
  syncCommonImages(project, vault);
  write(path.join(project, 'src/site/_includes/sidebar.njk'), `<img src="/img/user/${image}">`);
  expect(() => checkCommonImages(project)).toThrow('Use /img/<filename>');
});

it('keeps a shared OGP image from images/top outside plugin-owned inputs and follows source replacements', () => {
  const { project, vault, image, write } = fixture();
  const source = 'images/top/default.jpg';
  write(path.join(project, 'tools/common-images.json'), JSON.stringify([image, source]));
  write(path.join(vault, source), 'og-image');
  write(path.join(project, 'src/site/_data/seo.js'), "module.exports = { defaultImage: '/img/default.jpg' };");
  expect(syncCommonImages(project, vault)).toEqual([image, source]);
  expect(fs.existsSync(path.join(project, 'src/site/img/user'))).toBe(false);
  expect(checkCommonImages(project)).toEqual([image, source]);
  write(path.join(vault, source), 'updated-og-image');
  expect(syncCommonImages(project, vault)).toEqual([source]);
  expect(fs.readFileSync(path.join(project, 'src/site/img/default.jpg'), 'utf8')).toBe('updated-og-image');
});

it('checks global OGP settings for unregistered template images', () => {
  const { project, vault, write } = fixture();
  syncCommonImages(project, vault);
  write(path.join(project, 'src/site/_data/seo.js'), "module.exports = { defaultImage: '/img/unknown.jpg' };");
  expect(() => checkCommonImages(project)).toThrow('unknown.jpg');
});

it('rejects colliding public filenames from different source folders, including Windows casing', () => {
  const { project, vault, write } = fixture();
  for (const other of ['images/top/banner.png', 'images/top/BANNER.PNG']) {
    write(path.join(project, 'tools/common-images.json'), JSON.stringify(['images/common/banner.png', other]));
    expect(() => syncCommonImages(project, vault)).toThrow('unique public filenames');
  }
});
