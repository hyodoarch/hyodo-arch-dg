import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const { parseRedirects, matches, checkRedirects } = createRequire(import.meta.url)('./check-redirects.cjs');
const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
function fixture(rules = '/projects/old.html /house/new/ 301\n') {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'dg-redirects-'));
  roots.push(project);
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(project, file)), { recursive: true }); fs.writeFileSync(path.join(project, file), text); };
  write('src/site/_redirects', rules);
  write('dist/_redirects', rules);
  write('dist/sitemap.xml', '<urlset><url><loc>https://hyodo-arch-dg.pages.dev/house/new/</loc></url></urlset>');
  write('dist/house/new/index.html', '<h1>Published work</h1>');
  write('src/site/notes/new.md', '---\npermalink: /house/new/\ndg-note-properties:\n  source-url: https://www.hyodo-arch.com/projects/old.html\n---\nPublished work');
  return { project, write };
}
it('checks the actual copied file, public target and source-url relationship', () => {
  const { project } = fixture();
  const result = checkRedirects(project);
  expect(result.staticCount).toBe(1);
  expect(result.legacyNotes[0].mapped).toBe(true);
});
it('blocks lost build copying and missing destination files', () => {
  const { project, write } = fixture();
  write('dist/_redirects', '');
  expect(() => checkRedirects(project)).toThrow('differs');
  write('dist/_redirects', '/projects/old.html /house/new/ 301\n');
  fs.unlinkSync(path.join(project, 'dist/house/new/index.html'));
  expect(() => checkRedirects(project)).toThrow('Missing destination HTML');
});
it('blocks private or excluded destinations even when HTML exists', () => {
  const { project, write } = fixture('/projects/old.html /private/ 301\n');
  write('dist/private/index.html', 'Private');
  expect(() => checkRedirects(project)).toThrow('not a public sitemap page');
});
it('blocks rules that hijack current URLs or form loops', () => {
  const { project } = fixture('/house/new/ /house/new/ 301\n');
  expect(() => checkRedirects(project)).toThrow('current public page');
});
it('rejects duplicate paths, default 302, wildcard fallbacks and staging targets', () => {
  for (const text of ['/old /house/new/\n', '/old /house/new/ 302\n', '/old /a/ 301\n/old /b/ 301', '/projects/* /house/:splat 301', '/old https://hyodo-arch-dg.pages.dev/house/new/ 301']) {
    expect(() => parseRedirects(text)).toThrow();
  }
});
it('keeps exact blog paths before the limited pagination rules', () => {
  const exact = '/buryoshaki/archives/398 https://blog.hyodo-arch.com/article 301';
  const page = '/buryoshaki/archives/category/books/page/:page https://blog.hyodo-arch.com/books/ 301';
  expect(parseRedirects(exact + '\n' + page).at(-1).dynamic).toBe(true);
  expect(() => parseRedirects(page + '\n' + exact)).toThrow('Exact paths must precede');
});
it('enforces Cloudflare line and static count limits', () => {
  expect(() => parseRedirects('/old https://blog.hyodo-arch.com/' + 'a'.repeat(1000) + ' 301')).toThrow('line limit');
  expect(() => parseRedirects(Array.from({ length: 2001 }, (_, i) => `/old${i} /house/new/ 301`).join('\n'))).toThrow('count limit');
});

it('accepts only the three approved section fallbacks with their fixed destinations', () => {
  expect(parseRedirects('/vectorworks/* https://blog.hyodo-arch.com/vectorscript/ 301\n/buryoshaki/* https://blog.hyodo-arch.com/ 301\n/progress/* / 301')).toHaveLength(3);
  for (const text of ['/* / 301', '/projects/* / 301', '/progress/* /news/ 301', '/vectorworks/* https://blog.hyodo-arch.com/ 301', '/buryoshaki/* https://blog.hyodo-arch.com/:splat 301']) {
    expect(() => parseRedirects(text)).toThrow('Only approved');
  }
});

it('preserves article and pagination precedence, including deep fallback paths and section boundaries', () => {
  const article = '/buryoshaki/archives/398 https://blog.hyodo-arch.com/article 301';
  const page = '/buryoshaki/archives/category/books/page/:page https://blog.hyodo-arch.com/books/ 301';
  const fallback = '/buryoshaki/* https://blog.hyodo-arch.com/ 301';
  const rules = parseRedirects([article, page, fallback].join('\n'));
  const destination = source => rules.find(rule => matches(rule, source))?.destination;
  expect(destination('/buryoshaki/archives/398')).toBe('https://blog.hyodo-arch.com/article');
  expect(destination('/buryoshaki/archives/category/books/page/2')).toBe('https://blog.hyodo-arch.com/books/');
  expect(destination('/buryoshaki/wp-content/uploads/2012/photo.jpg')).toBe('https://blog.hyodo-arch.com/');
  expect(destination('/buryoshaki/archives/category/books/page/2/deeper')).toBe('https://blog.hyodo-arch.com/');
  expect(destination('/buryoshaki-other/archives/398')).toBeUndefined();
  expect(() => parseRedirects([article, fallback, page].join('\n'))).toThrow('Pagination rules must precede');
});

it('blocks fallback rules that would hide a current public page while leaving adjacent sections alone', () => {
  const { project, write } = fixture('/projects/old.html /house/new/ 301\n/vectorworks/* https://blog.hyodo-arch.com/vectorscript/ 301\n');
  const sitemap = publicPath => `<urlset><url><loc>https://www.hyodo-arch.com/house/new/</loc></url><url><loc>https://www.hyodo-arch.com${publicPath}</loc></url></urlset>`;
  write('dist/sitemap.xml', sitemap('/vectorworks/current/deep/'));
  expect(() => checkRedirects(project)).toThrow('current public page');
  write('dist/sitemap.xml', sitemap('/vectorworks-other/current/deep/'));
  expect(checkRedirects(project).dynamicCount).toBe(1);
});
