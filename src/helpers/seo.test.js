import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { parse } from 'node-html-parser';

const require = createRequire(import.meta.url);
const { seoTitle, seoCanonical, seoMetatags } = require('./seo');
const { clearImageIndex } = require('./imageAssets');
const { defaultImage } = require('../site/_data/seo');
const nunjucks = require('nunjucks');
const MarkdownIt = require('markdown-it');
const header = fs.readFileSync(new URL('../site/_includes/components/pageheader.njk', import.meta.url), 'utf8')
  .split('<script type="importmap">')[0];
const canonicalComponent = 'components/user/common/head/canonical.njk';
const canonicalTemplate = fs.readFileSync(new URL(`../site/_includes/${canonicalComponent}`, import.meta.url), 'utf8');
const base = 'https://example.com';
const first = '/img/user/seo-fixture/first.jpg';
const other = '/img/user/seo-fixture/second.jpg';
const env = new nunjucks.Environment(null, { autoescape: false });
env.addFilter('seoMetatags', seoMetatags);

class HeadLoader extends nunjucks.Loader {
  getSource(name) {
    const src = name === 'components/pageheader.njk' ? header :
      name === canonicalComponent ? canonicalTemplate : undefined;
    if (src === undefined) throw new Error(`Unexpected head include: ${name}`);
    return { src, path: name, noCache: true };
  }
}
const headEnv = new nunjucks.Environment(new HeadLoader(), { autoescape: false });
headEnv.addFilter('seoTitle', seoTitle);
headEnv.addFilter('seoCanonical', seoCanonical);
headEnv.addFilter('seoMetatags', seoMetatags);

function renderLayoutHead(layout, data = {}) {
  const source = fs.readFileSync(new URL(`../site/_includes/layouts/${layout}.njk`, import.meta.url), 'utf8');
  const head = source.slice(source.indexOf('<head>'), source.indexOf('</head>') + '</head>'.length);
  return parse(headEnv.renderString(head, {
    content: '<h1>本文のタイトル</h1>', noteProps: {}, metatags: {}, title: '作品名',
    page: { url: '/house/example/', fileSlug: 'fallback' },
    meta: { siteBaseUrl: base, siteName: '兵藤善紀建築設計事務所' }, seo: { defaultImage },
    dynamics: { common: { head: [] }, notes: { head: [] }, index: { head: [] } },
    collections: { note: [] }, ...data,
  }));
}

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

it('shares one head title across the real home, note, tag, 404 and random layouts', () => {
  const siteName = '兵藤善紀建築設計事務所';
  const cases = [
    ['index', '/', 'HOME', siteName],
    ['note', '/house/honbasu/', '本蓮の家', `本蓮の家 | ${siteName}`],
    ['note', '/house/', '新築住宅', `新築住宅 | ${siteName}`],
    ['note', '/tags/和風/', '和風', `和風 | ${siteName}`],
    ['index', '/404.html', `ページが見つかりません | ${siteName}`, `ページが見つかりません | ${siteName}`],
    ['random', '/~random/', '', `Random Page | ${siteName}`],
  ];
  for (const [layout, url, title, expected] of cases) {
    const data = { title, page: { url, fileSlug: 'fallback' } };
    const html = renderLayoutHead(layout, data);
    expect(html.querySelectorAll('title')).toHaveLength(1);
    expect(html.querySelector('title').text).toBe(expected);
    for (const [attribute, name] of [['property', 'og:title'], ['name', 'twitter:title']]) {
      const tags = html.querySelectorAll(`meta[${attribute}="${name}"]`);
      expect(tags).toHaveLength(1);
      expect(tags[0].getAttribute('content')).toBe(expected);
    }
    expect(data.title).toBe(title);
  }
});

it('uses the configured site name and safely escapes both title text and metadata attributes', () => {
  const title = 'ページ "A" & <script>alert(1)</script>';
  const siteName = '別の事務所 "B" & <img src=x onerror="alert(1)">';
  const html = renderLayoutHead('note', { title, meta: { siteBaseUrl: base, siteName } });
  const expected = `${title} | ${siteName}`;
  expect(html.querySelector('title').text).toBe(expected);
  expect(html.querySelector('meta[property="og:title"]').getAttribute('content')).toBe(expected);
  expect(html.querySelector('meta[name="twitter:title"]').getAttribute('content')).toBe(expected);
  expect(html.querySelectorAll('script, img')).toHaveLength(0);
});

it('keeps filename fallback and avoids empty or repeated site-name suffixes', () => {
  const html = renderLayoutHead('note', { title: '' });
  expect(html.querySelector('title').text).toBe('fallback | 兵藤善紀建築設計事務所');
  const withoutSiteName = renderLayoutHead('note', { meta: { siteBaseUrl: base, siteName: '' } });
  expect(withoutSiteName.querySelector('title').text).toBe('作品名');
  expect(seoTitle('  作品名\n | 事務所  ', '  事務所 ', '/work/')).toBe('作品名 | 事務所');
  expect(seoTitle('事務所', '事務所', '/office/')).toBe('事務所');
});

it('retains explicitly configured social titles while formatting the browser title', () => {
  const manual = { 'og:title': '専用OGPタイトル', 'twitter:title': '専用Xタイトル' };
  const html = renderLayoutHead('note', { metatags: manual });
  expect(html.querySelector('title').text).toBe('作品名 | 兵藤善紀建築設計事務所');
  expect(html.querySelector('meta[property="og:title"]').getAttribute('content')).toBe(manual['og:title']);
  expect(html.querySelector('meta[name="twitter:title"]').getAttribute('content')).toBe(manual['twitter:title']);
});

const canonicalData = {
  meta: { siteBaseUrl: 'https://www.hyodo-arch.com', siteName: '兵藤善紀建築設計事務所' },
  dynamics: { common: { head: [canonicalComponent] }, notes: { head: [] }, index: { head: [] } },
};

it('discovers canonical through the standard DG head slot and outputs one absolute URL per public page', async () => {
  const dynamics = await require('../site/_data/dynamics')();
  expect(dynamics.common.head.filter(name => name === canonicalComponent)).toHaveLength(1);
  for (const site of ['https://www.hyodo-arch.com', 'https://www.hyodo-arch.com/']) {
    for (const [layout, url] of [['index', '/'], ['note', '/house/honbasu/'],
      ['note', '/house/'], ['note', '/tags/和風/'], ['note', '/tags/%E5%92%8C%E9%A2%A8/']]) {
      const html = renderLayoutHead(layout, { ...canonicalData,
        meta: { ...canonicalData.meta, siteBaseUrl: site }, page: { url } });
      const links = html.querySelectorAll('head link[rel="canonical"]');
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute('href')).toBe(new URL(url, site).href);
      expect(links[0].getAttribute('href')).toBe(html.querySelector('meta[property="og:url"]').getAttribute('content'));
    }
  }
});

it('keeps canonical inactive before cutover and never points it at pages.dev or local hosts', () => {
  for (const site of ['', 'https://hyodo-arch-dg.pages.dev', 'https://preview.hyodo-arch-dg.pages.dev/',
    'http://localhost:8080', 'https://hyodo-arch.com', 'https://www.hyodo-arch.com.example.org']) {
    const html = renderLayoutHead('note', { ...canonicalData, meta: { ...canonicalData.meta, siteBaseUrl: site } });
    expect(html.querySelectorAll('link[rel="canonical"]')).toHaveLength(0);
  }
});

it('omits canonical on collection-excluded 404, random and fixture pages', () => {
  for (const [layout, url] of [['index', '/404.html'], ['random', '/~random/'], ['note', '/__image-captions-fixture/']]) {
    const html = renderLayoutHead(layout, { ...canonicalData, page: { url }, eleventyExcludeFromCollections: true });
    expect(html.querySelectorAll('link[rel="canonical"]')).toHaveLength(0);
  }
});

it('rejects unsafe production URL settings instead of silently emitting a wrong canonical', () => {
  for (const site of ['http://www.hyodo-arch.com', 'https://www.hyodo-arch.com:8443',
    'https://user:pass@www.hyodo-arch.com', 'https://www.hyodo-arch.com/subpath/',
    'https://www.hyodo-arch.com?preview=1', 'https://www.hyodo-arch.com/#section']) {
    expect(() => seoCanonical('/house/honbasu/', site, false)).toThrow('Canonical /house/honbasu/: SITE_BASE_URL');
  }
  for (const url of [undefined, 'house/honbasu/', '//other.example/house/', '/\\other.example/', '/house\\honbasu/']) {
    expect(() => seoCanonical(url, canonicalData.meta.siteBaseUrl, false)).toThrow('site-relative page URL');
  }
});

it('preserves page paths, drops query and fragment, and escapes canonical attributes', () => {
  const url = '/作品 & 設計/"?utm_source=example#photo';
  const html = renderLayoutHead('note', { ...canonicalData, page: { url } });
  const link = html.querySelector('link[rel="canonical"]');
  expect(link.getAttribute('href')).toBe('https://www.hyodo-arch.com/%E4%BD%9C%E5%93%81%20&%20%E8%A8%AD%E8%A8%88/%22');
  expect(link.outerHTML).toContain('&amp;');
  expect(Object.keys(link.attributes)).toEqual(['rel', 'href']);
  expect(seoCanonical('/existing.html', canonicalData.meta.siteBaseUrl)).toBe('https://www.hyodo-arch.com/existing.html');
});

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
