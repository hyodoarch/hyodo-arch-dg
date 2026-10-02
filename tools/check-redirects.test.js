import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const { parseRedirects, checkRedirects } = createRequire(import.meta.url)('./check-redirects.cjs');
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
