import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { parse } from 'node-html-parser';

const require = createRequire(import.meta.url);
const { seoMetatags } = require('./seo');
const { clearImageIndex } = require('./imageAssets');
const { defaultImage } = require('../site/_data/seo');
const nunjucks = require('nunjucks');
const MarkdownIt = require('markdown-it');
const header = fs.readFileSync(new URL('../site/_includes/components/pageheader.njk', import.meta.url), 'utf8')
  .split('<script type="importmap">')[0];
const base = 'https://example.com';
const first = '/img/user/seo-fixture/first.jpg';
const other = '/img/user/seo-fixture/second.jpg';
const env = new nunjucks.Environment(null, { autoescape: false });
env.addFilter('seoMetatags', seoMetatags);

beforeEach(() => {
  const exists = fs.existsSync;
  const stat = fs.statSync;
  const isFixture = file => /\/img\/user\/(?:seo-fixture|__image-captions-fixture)\//.test(String(file).replaceAll('\\', '/'));
  vi.spyOn(fs, 'existsSync').mockImplementation(file => isFixture(file)
    ? !String(file).includes('missing') : exists(file));
  vi.spyOn(fs, 'statSync').mockImplementation(file => isFixture(file)
    ? { isFile: () => true, size: String(file).includes('empty') ? 0 : 100 } : stat(file));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); clearImageIndex(); });

function tags(props = {}, content = '', manual = {}, site = base, page = '/house/example/') {
  return seoMetatags(content, props, manual, 'ページ "A" & B', page, site, defaultImage);
}
function render(props = {}, content = '', manual = {}) {
  return parse(env.renderString(header, {
    content, noteProps: props, metatags: manual, title: 'ページ "A" & B',
    page: { url: '/house/example/' }, meta: { siteBaseUrl: base }, seo: { defaultImage },
  }));
}

it('uses one note description for search, OGP and Twitter without changing its source', () => {
  const props = { description: '  住宅の説明。\n  "引用" & <img src=x onerror="alert(1)">  ' };
  const before = props.description;
  const html = render(props);
  const value = '住宅の説明。 "引用" & <img src=x onerror="alert(1)">';
  for (const key of ['description', 'og:description', 'twitter:description']) {
    const metas = html.querySelectorAll(`meta[${key.startsWith('og:') ? 'property' : 'name'}="${key}"]`);
    expect(metas).toHaveLength(1);
    expect(metas[0].getAttribute('content')).toBe(value);
    expect(Object.keys(metas[0].attributes).sort()).toEqual(['content', key.startsWith('og:') ? 'property' : 'name']);
  }
  expect(html.querySelectorAll('img')).toHaveLength(0);
  expect(props.description).toBe(before);
  expect(html.querySelector('meta[property="og:title"]').getAttribute('content')).toBe('ページ "A" & B');
});

it('omits all automatic description tags for missing, empty or non-text descriptions', () => {
  for (const description of [undefined, null, '', ' \n ', false, []]) {
    const result = tags({ description });
    for (const key of ['description', 'og:description', 'twitter:description']) expect(result).not.toHaveProperty(key);
  }
});

it('prefers og-image over a leading image and uses the same URL for both cards', () => {
  for (const value of [other, `[[${other}]]`, `![](${other})`]) {
    const result = tags({ 'og-image': value }, `<p><img src="${first}"></p>`);
    expect(result['og:image']).toBe(base + other);
    expect(result['twitter:image']).toBe(base + other);
  }
});

it('resolves vault-relative properties with the existing published-image index, including Japanese names', () => {
  vi.stubEnv('IMAGE_CAPTIONS_FIXTURE', 'true');
  clearImageIndex();
  const result = tags({ 'og-image': '[[住宅 外観 01.svg]]' });
  expect(result['og:image']).toBe(base + '/img/user/__image-captions-fixture/' + encodeURIComponent('住宅 外観 01.svg'));
});

it('reads the first image of actual caption, slideshow and grid renderers without modifying them', () => {
  vi.stubEnv('IMAGE_CAPTIONS_FIXTURE', 'true');
  clearImageIndex();
  const md = new MarkdownIt({ html: true });
  require('./userSetup').userMarkdownSetup(md);
  const image = 'square.png';
  const originals = [
    md.render(`![[${image}|キャプション]]`),
    md.render('```slideshow\n![[' + image + ']]\n![[landscape.svg]]\n```'),
    md.render('```image-grid-captions\ncolumns: 2\ngap: 8\n![[' + image + ']]\n![[landscape.svg]]\n```'),
  ];
  for (const html of originals) {
    const result = tags({}, html);
    expect(result['og:image']).toBe(base + '/img/user/__image-captions-fixture/square.png');
    expect(tags({}, html)['og:image']).toBe(result['og:image']);
  }
});

it('accepts image-only paragraphs, linked images and pictures after whitespace or comments', () => {
  for (const html of [`<img src="${first}">`, `<p><a href="/work/"><img src="${first}"></a></p>`,
    `<picture><source srcset="${other}"><img src="${first}"></picture>`]) {
    expect(tags({}, '\n<!-- note -->\n' + html)['og:image']).toBe(base + first);
  }
});

it('uses the shared image when a heading or text comes first, and ignores later or sidebar images', () => {
  for (const html of ['<h1>見出し</h1>', '<p>説明文</p>', `<p>文章<img src="${first}"></p>`,
    `<aside><img src="${first}"></aside>`, `<div class="navigation"><img src="${first}"></div>`, '説明文']) {
    expect(tags({}, html + `<p><img src="${other}"></p>`)['og:image']).toBe(base + defaultImage);
  }
  expect(tags({}, '')['og:image']).toBe(base + defaultImage);
  expect(defaultImage).not.toContain('/user/');
});

it('preserves DG manual metadata, normalizes explicit image URLs, and emits each key once', () => {
  const manual = { description: '専用の説明', 'og:title': '専用タイトル', 'og:image': other,
    'twitter:description': 'X用の説明', robots: 'noindex, follow', author: '事務所' };
  const html = render({ description: '通常の説明' }, `<img src="${first}">`, manual);
  const keys = html.querySelectorAll('meta').map(meta => meta.getAttribute('name') || meta.getAttribute('property')).filter(Boolean);
  expect(new Set(keys).size).toBe(keys.length);
  expect(html.querySelector('meta[name="description"]').getAttribute('content')).toBe('専用の説明');
  expect(html.querySelector('meta[property="og:image"]').getAttribute('content')).toBe(base + other);
  expect(html.querySelector('meta[name="twitter:image"]').getAttribute('content')).toBe(base + other);
  expect(html.querySelector('meta[name="twitter:description"]').getAttribute('content')).toBe('X用の説明');
  expect(html.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex, follow');
  expect(manual['og:image']).toBe(other);
  expect(tags({ 'og-image': first }, '', manual)['og:image']).toBe(base + first);
});

it('handles site URL changes and trailing slashes without malformed paths', () => {
  for (const site of ['https://hyodo-arch-dg.pages.dev', 'https://www.hyodo-arch.com/']) {
    const result = tags({}, '', {}, site, '/tags/新築住宅/');
    expect(result['og:url']).toBe(new URL('/tags/新築住宅/', site).href);
    expect(result['og:image']).toBe(new URL(defaultImage, site).href);
    expect(result['og:type']).toBe('website');
    expect(result['twitter:card']).toBe('summary_large_image');
  }
});

it('rejects missing, empty and unsupported explicit images with the affected page in the error', () => {
  for (const value of ['/img/user/seo-fixture/missing.jpg', '/img/user/seo-fixture/empty.jpg',
    'images/nonexistent-photo.jpg', '../private.jpg', '/img/%2e%2e/private.jpg', 'javascript:alert(1)', {}, '//other.example/image.jpg']) {
    expect(() => tags({ 'og-image': value })).toThrow('SEO /house/example/');
  }
  expect(() => tags({}, '', {}, 'javascript:alert(1)')).toThrow('SITE_BASE_URL');
  expect(() => tags({}, '', {}, base, '//other.example/')).toThrow('page URL');
});

it('retains standard DG output when the optional site URL is unconfigured', () => {
  expect(tags({}, '', { robots: 'noindex, follow' }, '')).toEqual({ robots: 'noindex, follow' });
});
