import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { parse } from 'node-html-parser';
const require = createRequire(import.meta.url);
const { homeSlideshow } = require('./homeSlideshow');
const md = require('markdown-it')().use(require('./slideshow'));
const first = 'images/top/yamate_IGP0510a.jpg';
const second = 'images/top/top-IMGP0361.jpg';
const block = (images, settings = '') => '```slideshow\n' + settings + images.map(image => `![[${image}]]`).join('\n') + '\n```';
const home = content => ({ url: '/', data: {}, templateContent: md.render(content) });

it('includes only the first homepage slideshow, without homepage prose or other components', () => {
  const html = homeSlideshow([home('Home introduction\n\n' + block([first, second], 'nav: true\n') + '\n\nNews\n\n' + block([second]))]);
  const root = parse(html);
  expect(root.querySelectorAll('.dg-slideshow')).toHaveLength(1);
  expect(root.querySelectorAll('img').map(img => img.getAttribute('src'))).toEqual(['/img/user/' + first, '/img/user/' + second]);
  expect(html).not.toMatch(/Home introduction|News/);
  expect(root.querySelector('.dg-slideshow').getAttribute('data-nav')).toBe('true');
});

it('follows changed images, order and playback settings instead of retaining a copy', () => {
  let source = block([first, second], 'autoplay: true\nspeed: 1000\nautoPlayDuration: 3000\n');
  const entry = { url: '/', data: {}, get templateContent() { return md.render(source); } };
  const before = parse(homeSlideshow([entry]));
  expect(before.querySelector('img').getAttribute('src')).toBe('/img/user/' + first);
  source = block([second], 'autoplay: false\nspeed: 250\nautoPlayDuration: 4200\n');
  const after = parse(homeSlideshow([entry]));
  expect(after.querySelectorAll('img').map(img => img.getAttribute('src'))).toEqual(['/img/user/' + second]);
  const slider = after.querySelector('.dg-slideshow');
  expect(slider.getAttribute('data-autoplay')).toBe('false');
  expect(slider.getAttribute('data-speed')).toBe('250');
  expect(slider.getAttribute('data-auto-play-duration')).toBe('4200');
});

it('preserves optimized picture markup and accessible image descriptions', () => {
  const markup = '<section class="dg-slideshow" aria-label="画像スライドショー"><div class="dg-slideshow__stage"><div class="dg-slideshow__slide"><picture><source srcset="/img/optimized/a.webp" type="image/webp"><img src="/img/user/a.jpg" alt="庭 &amp; 建物"></picture></div></div></section>';
  expect(homeSlideshow([{ url: '/', data: {}, templateContent: markup }])).toBe(markup);
});

it('stops on a missing, ambiguous, hidden or invalid homepage instead of substituting an old photo', () => {
  const entry = home(block([first]));
  for (const entries of [undefined, [], [entry, entry], [{ ...entry, url: '/other/' }], [{ ...entry, data: { hide: true } }]]) {
    expect(() => homeSlideshow(entries)).toThrow('one visible published homepage');
  }
  for (const content of ['Home without a slideshow', block(['missing.jpg'])]) {
    expect(() => homeSlideshow([home(content)])).toThrow('valid slideshow block');
  }
});
