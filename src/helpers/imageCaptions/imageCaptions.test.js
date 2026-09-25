import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import MarkdownIt from 'markdown-it';
import { parse } from 'node-html-parser';
const require = createRequire(import.meta.url);
const { userMarkdownSetup } = require('../userSetup');
const { clearImageIndex, resolveImage } = require('../imageAssets');
const { parseGrid } = require('../imageGridCaptions/shared/parser');
const { calculateLayout } = require('../imageGridCaptions/shared/layout');
const path = '__image-captions-fixture/住宅 外観 01.svg';
let md;
let previousFixture;
beforeEach(() => {
  previousFixture = process.env.IMAGE_CAPTIONS_FIXTURE;
  process.env.IMAGE_CAPTIONS_FIXTURE = 'true';
  clearImageIndex();
  md = new MarkdownIt({ html: true, breaks: true });
  userMarkdownSetup(md);
});
afterEach(() => {
  if (previousFixture === undefined) delete process.env.IMAGE_CAPTIONS_FIXTURE;
  else process.env.IMAGE_CAPTIONS_FIXTURE = previousFixture;
  clearImageIndex();
});
const embed = alias => `![[${path}|${alias}]]`;
const grid = (n, params = '') => '```image-grid-captions\ncolumns: ' + n + '\n' + params + '\n' + Array.from({length: n}, (_, i) => `![[${path}${i ? '' : '|外観'}]]`).join('\n') + '\n```';

describe('Image Captions compatibility', () => {
  it.each(['', 'left|312', 'right|312', 'center|312', 'Caption', 'Caption|right|405', '%|right|405', 'See <<HOME|home>>|left|312'])('DG Publish preserves the local rendering of %s', alias => {
    const original = alias ? embed(alias) : `![[${path}]]`;
    const label = (path + (alias ? '|' + alias : '')).replace(/\|/g, '\\|');
    const published = `![${label}](${resolveImage(path)})`;
    expect(md.render(published)).toBe(md.render(original));
  });
  it('retains dimensions of a size-only published embed without a caption', () => {
    const html = parse(md.render(`![${path}\\|312x200](${resolveImage(path)})`));
    expect(html.querySelector('figure')).toBeNull();
    expect(html.querySelector('img').getAttribute('width')).toBe('312');
    expect(html.querySelector('img').getAttribute('height')).toBe('200');
  });
  it('recognizes an encoded published URL and a shortest-path image reference', () => {
    const html = parse(md.render(`![住宅 外観 01.svg\\|right\\|312](${resolveImage(path)})`));
    expect(html.querySelector('figure').classList.contains('image-captions-right')).toBe(true);
    expect(html.querySelector('figcaption')).toBeNull();
  });
  it('preserves intentional Markdown captions and external image labels', () => {
    expect(parse(md.render('![other.jpg](/img/user/images/photo.jpg)')).querySelector('figcaption').text).toBe('other.jpg');
    expect(parse(md.render('![photo.jpg](https://example.com/photo.jpg)')).querySelector('figcaption').text).toBe('photo.jpg');
  });
  it.each(['left', 'right'])('supports captionless %s wrapping without an empty caption', alignment => {
    const html = parse(md.render(embed(`${alignment}|312`) + '\n\n## Heading\n\nText\n\n<br clear="all">'));
    expect(html.querySelector('figure').classList.contains(`image-captions-${alignment}`)).toBe(true);
    expect(html.querySelector('figure').getAttribute('style')).toContain('--image-caption-width:312px');
    expect(html.querySelector('figcaption')).toBeNull();
    expect(html.querySelector('img').getAttribute('alt')).toBe('');
    expect(html.querySelector('br').getAttribute('clear')).toBe('all');
  });
  it.each(['Caption', 'Caption|405', 'Caption|left', 'Caption|center', 'Caption|right', 'Caption|right|405'])('%s produces semantic figure', alias => {
    const html = parse(md.render(embed(alias)));
    expect(html.querySelectorAll('figure')).toHaveLength(1);
    expect(html.querySelector('figcaption').text).toBe('Caption');
    expect(html.querySelector('p figure')).toBeNull();
    const alignment = alias.match(/left|center|right/);
    if (alignment) expect(html.querySelector('figure').classList.contains('image-captions-' + alignment[0])).toBe(true);
    if (alias.endsWith('405')) expect(html.querySelector('img').getAttribute('width')).toBe('405');
  });
  it('renders Markdown and links without interpreting raw HTML', () => {
    const html = parse(md.render(embed('**bold** and [link](https://example.com) <script>alert(1)</script>')));
    expect(html.querySelector('figcaption strong').text).toBe('bold');
    expect(html.querySelector('figcaption a').getAttribute('href')).toBe('https://example.com');
    expect(html.querySelector('script')).toBeNull();
  });
  it.each(['<<HOME>>', '<<HOME|home>>'])('delegates %s to existing internal link transform', link => {
    const a = parse(md.render(embed(`See ${link}|right|405`))).querySelector('figcaption a');
    expect(a.getAttribute('data-href')).toBe('HOME');
    expect(a.classList.contains('internal-link')).toBe(true);
    expect(a.text).toBe(link.includes('|') ? 'home' : 'HOME');
  });
  it.each([['%', '住宅 外観 01'], ['%.%', '住宅 外観 01.svg'], ['\\%', '%']])('filename %s', (alias, expected) => {
    expect(parse(md.render(embed(alias))).querySelector('figcaption').text).toBe(expected);
    expect(parse(md.render(embed(alias + '|right|405'))).querySelector('figcaption').text).toBe(expected);
  });
  it.each([`![[${path}]]`, embed('405'), '![](/img/test.svg)', '![405](/img/test.svg)'])('leaves captionless image unwrapped: %s', source => {
    const html = parse(md.render(source));
    expect(html.querySelector('figure')).toBeNull();
    expect(html.querySelector('img')).not.toBeNull();
  });
  it('handles consecutive images independently', () => {
    const html = parse(md.render(embed('One|left|280') + '\n' + embed('Two|left|280')));
    expect(html.querySelectorAll('figure')).toHaveLength(2);
    expect(html.querySelector('p')).toBeNull();
  });
  it('matches Quartz scope for inline and mixed captionless paragraphs', () => {
    expect(md.render('Text ' + embed('caption'))).not.toContain('<figure');
    expect(md.render(embed('caption') + '\n' + embed('405'))).not.toContain('<figure');
  });
  it('does not process fenced or inline code', () => {
    expect(md.render('`' + embed('caption') + '`')).not.toContain('<figure');
    expect(md.render('```md\n' + embed('caption') + '\n```')).not.toContain('<figure');
  });
  it.each(['Caption', 'Caption|405', '**bold** and [link](https://example.com)|405'])('standard Markdown: %s', alias => {
    expect(md.render(`![${alias}](image.jpg)`)).toContain('<figcaption');
  });
});

describe('Image Grid Captions', () => {
  it.each([2, 3, 4])('renders %i columns with plain captions and filename alt', n => {
    const html = parse(md.render(grid(n)));
    expect(html.querySelectorAll('.image-grid-captions__item')).toHaveLength(n);
    expect(html.querySelector('.image-grid-captions').getAttribute('data-gap')).toBe('8');
    expect(html.querySelectorAll('img')[0].getAttribute('alt')).toBe('外観');
    expect(html.querySelectorAll('img')[1].getAttribute('alt')).toBe('住宅 外観 01.svg');
    expect(html.querySelectorAll('.image-captions-figure')).toHaveLength(0);
  });
  it.each(['0', '12'])('gap %s', gap => expect(md.render(grid(2, 'gap: ' + gap))).toContain(`data-gap="${gap}"`));
  it('keeps Markdown, HTML, width and alignment as plain text', () => {
    const html = parse(md.render(grid(2).replace('|外観', '|**bold** <em>x</em> center 405')));
    expect(html.querySelector('figcaption').text).toBe('**bold** <em>x</em> center 405');
    expect(html.querySelector('figcaption em')).toBeNull();
  });
  it.each([
    '', 'columns: 1', 'columns: 5', 'columns: 2', 'columns: 2\ncolumns: 2',
    'columns: 2\ngap: -1', 'columns: 2\ngap: 1px', 'columns: 2\ngap: 1.5',
    'columns: 2\ngap: 9007199254740992', 'columns: 2\nunknown: yes',
    'columns: 2\ngap: 8\ngap: 9', 'columns: 2\n![x](a.jpg)',
    'columns: 2\n![[a.jpg|cap|405]]', 'columns: 2\n![[https://example.com/a.jpg]]',
    'columns: 2\n![[/a.jpg]]', 'columns: 2\n![[a.jpg#id]]', 'columns: 2\n![[a.mp4]]',
    'columns: 2\n![[missing.jpg]]\n![[missing2.jpg]]',
  ])('isolates invalid block: %s', source => {
    expect(() => md.render('```image-grid-captions\n' + source + '\n```\n\nAfter')).not.toThrow();
    expect(md.render('```image-grid-captions\n' + source + '\n```\n\nAfter')).toContain('role="alert"');
    expect(md.render('```image-grid-captions\n' + source + '\n```\n\nAfter')).toContain('<p>After</p>');
  });
  it.each(['png','jpg','jpeg','webp','gif','bmp','avif','svg'])('parser accepts %s', ext => {
    expect(parseGrid(`columns: 2\n![[a.${ext}]]\n![[b.${ext}]]`).images).toHaveLength(2);
  });
  it('does not register image-grid', () => expect(md.render('```image-grid\ncolumns: 2\n```')).toContain('language-image-grid'));
  it('coexists with ordinary captions', () => {
    const html = parse(md.render(embed('caption') + '\n\n' + grid(2)));
    expect(html.querySelectorAll('.image-captions-figure')).toHaveLength(1);
    expect(html.querySelectorAll('.image-grid-captions figure')).toHaveLength(2);
  });
});

describe('Digital Garden image adapter and portable layout', () => {
  it.each([path, '住宅 外観 01.svg', encodeURIComponent('住宅 外観 01.svg')])('resolves Japanese/spaces/folder/shortest paths: %s', source => {
    expect(resolveImage(source, true)).toBe('/img/user/__image-captions-fixture/' + encodeURIComponent('住宅 外観 01.svg'));
  });
  it('preserves published and external URLs', () => {
    expect(resolveImage('/img/user/a.jpg')).toBe('/img/user/a.jpg');
    expect(resolveImage('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(() => resolveImage('../outside.jpg', true)).toThrow();
  });
  it('calculates equal height with exact total width', () => {
    const result = calculateLayout(800, 8, [2/3, 2, 1]);
    expect(result.widths.reduce((a,b) => a+b, 0) + 16).toBeCloseTo(800);
    expect(result.widths[0] / result.height).toBeCloseTo(2/3);
    expect(() => calculateLayout(8, 8, [1, 1])).toThrow('too narrow');
  });
  it('renders the complete opt-in fixture', () => {
    const html = parse(md.render(readFileSync('test/fixtures/image-captions/demo.md', 'utf8')));
    expect(html.querySelectorAll('.image-grid-captions')).toHaveLength(4);
    expect(html.querySelectorAll('.image-grid-captions__error')).toHaveLength(2);
  });
});
