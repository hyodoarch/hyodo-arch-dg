import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { parse } from 'node-html-parser';
const require = createRequire(import.meta.url);

it('uses the real Digital Garden Markdown, link and picture pipeline', async () => {
  let md;
  const transforms = new Map();
  const filters = new Map();
  const hooks = new Map();
  const config = new Proxy({
    setLibrary: (name, library) => { if (name === 'md') md = library; },
    addTransform: (name, transform) => transforms.set(name, transform),
    addFilter: (name, filter) => filters.set(name, filter),
    on: (name, hook) => { hooks.set(name, [...(hooks.get(name) || []), hook]); },
  }, { get: (target, name) => target[name] || (() => {}) });
  require('../../../.eleventy.js')(config);
  const source = '![[images/top/yamate_IGP0510a.jpg|See <<HOME|home>>|right|405]]\n\n' +
    '```image-grid-captions\ncolumns: 2\n![[images/top/yamate_IGP0510a.jpg|## A "quoted" & <caption> #tag\n本文 <script>x</script> #tag\n\n第二段落\n]]\n![[images/top/yamate_IGP0510a.jpg|### 材料]]\n```';
  let html = '<main class="cm-s-obsidian">' + md.render(source) + '</main>';
  html = filters.get('taggify')(filters.get('link')(html));
  const context = { page: { inputPath: 'src/site/notes/test.md', outputPath: 'test.html' } };
  for (const name of ['dataview-js-links', 'picture']) html = await transforms.get(name).call(context, html);
  const result = parse(html);
  expect(result.querySelector('figcaption a').getAttribute('href')).toBe('/');
  expect(result.querySelector('.image-captions-figure img').getAttribute('width')).toBe('405');
  expect(result.querySelectorAll('.image-grid-captions figure')).toHaveLength(2);
  expect(result.querySelectorAll('.image-grid-captions picture img')).toHaveLength(2);
  expect(result.querySelector('.image-grid-captions img').getAttribute('alt')).toBe('A "quoted" & <caption> #tag 本文 <script>x</script> #tag 第二段落');
  expect(result.querySelector('.image-grid-captions figcaption a')).toBeNull();
  expect(result.querySelector('.image-grid-captions figcaption h2').text).toBe('A "quoted" & <caption> #tag');
  expect(result.querySelector('.image-grid-captions figcaption h3').text).toBe('材料');
  expect(result.querySelectorAll('.image-grid-captions figcaption p')).toHaveLength(2);
  expect(result.querySelector('.image-grid-captions figcaption script')).toBeNull();
  for (const hook of hooks.get('eleventy.after') || []) await hook();
}, 30000); // The real image pipeline can exceed 5s on a cold Windows/Dropbox cache.
