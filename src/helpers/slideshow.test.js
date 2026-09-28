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

it('applies defaults and keeps explicit settings local to each block', () => {
  const configured = block.replace('slideshow\n', 'slideshow\nautoplay: true\nspeed: 250\nautoPlayDuration: 4200\nnav: true\narrow: true\n').replace('%s', image);
  const [custom, defaults] = parse(md.render(configured + '\n\n' + block.replace('%s', image))).querySelectorAll('.dg-slideshow');
  for (const [key, value] of Object.entries({ autoplay: 'true', speed: '250', 'auto-play-duration': '4200', nav: 'true', arrow: 'true' })) expect(custom.getAttribute('data-' + key)).toBe(value);
  for (const [key, value] of Object.entries({ autoplay: 'false', speed: '1000', 'auto-play-duration': '3000', nav: 'false', arrow: 'false' })) expect(defaults.getAttribute('data-' + key)).toBe(value);
});

it('rejects invalid settings rather than silently changing playback', () => {
  for (const setting of ['autoplay: yes', 'nav: 1', 'arrow: False', 'speed: -1', 'speed: 1.5', 'autoPlayDuration: 0', 'autoPlayDuration: 2147483648', 'speed: NaN', 'unknown: true', 'nav: true\nnav: false', 'speed: 1000px']) {
    expect(md.render(block.replace('slideshow\n', 'slideshow\n' + setting + '\n').replace('%s', image))).toContain('role="alert"');
  }
  expect(md.render(block.replace('slideshow\n', 'slideshow\nspeed: 0\n').replace('%s', image))).toContain('data-speed="0"');
});

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
