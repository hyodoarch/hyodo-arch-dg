import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { parse } from 'node-html-parser';
const require = createRequire(import.meta.url);
const MarkdownIt = require('markdown-it');
const { userMarkdownSetup } = require('./userSetup');
const md = new MarkdownIt();
userMarkdownSetup(md);
const image = 'images/top/yamate_IGP0510a.jpg';
const block = '```slideshow\n![[%s]]\n```';

it('renders independent slideshows anywhere, with accessible initial state', () => {
  const html = parse(md.render('before\n\n' + block.replace('%s', image) + '\n\nafter\n\n' + block.replace('%s', image)));
  expect(html.querySelectorAll('.dg-slideshow')).toHaveLength(2);
  expect(html.querySelector('img').getAttribute('src')).toBe('/img/user/' + image);
  expect(html.querySelector('.dg-slideshow__slide').getAttribute('aria-hidden')).toBe('false');
});
it('preserves code samples and the existing image grid renderer', () => {
  const grid = '```image-grid-captions\ncolumns: 2\n![[%s]]\n![[%s]]\n```'.replaceAll('%s', image);
  const html = parse(md.render(block.replace('slideshow', 'javascript').replace('%s', image) + '\n\n' + grid));
  expect(html.querySelector('pre').text).toContain('![[');
  expect(html.querySelectorAll('.image-grid-captions img')).toHaveLength(2);
  expect(html.querySelectorAll('.dg-slideshow')).toHaveLength(0);
});
it('reports missing images and invalid/empty blocks; escapes alt text', () => {
  for (const source of ['', '![[missing.jpg]]', '![[../x.jpg]]', '<script>x</script>']) {
    expect(md.render('```slideshow\n' + source + '\n```')).toContain('role="alert"');
  }
  const html = parse(md.render(block.replace('%s', image + '|<script>alert(1)</script>')));
  expect(html.querySelector('script')).toBeNull();
  expect(html.querySelector('img').getAttribute('alt')).toBe('<script>alert(1)</script>');
});
