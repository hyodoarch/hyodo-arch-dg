import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { serializeAsync } = require('./serialFavicons');

it('does not let concurrent pages write the favicon at the same time', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const started = [];
  const render = serializeAsync(async page => {
    started.push(page);
    if (page === 'first') await gate;
    return `<link data-page="${page}">`;
  });
  const first = render('first');
  const second = render('second');
  await Promise.resolve();
  expect(started).toEqual(['first']);
  release();
  expect(await Promise.all([first, second])).toEqual([
    '<link data-page="first">', '<link data-page="second">',
  ]);
  expect(started).toEqual(['first', 'second']);
});

it('reports a failed write without preventing the next render attempt', async () => {
  const error = new Error('write failed');
  const render = serializeAsync(async fail => { if (fail) throw error; return 'recovered'; });
  const failed = render(true);
  const retried = render(false);
  await expect(failed).rejects.toBe(error);
  await expect(retried).resolves.toBe('recovered');
});

it('preserves the shortcode context and option arguments', async () => {
  const render = serializeAsync(function (source, options) { return [this.page, source, options]; });
  const options = { generateManifest: false };
  expect(await render.call({ page: 'home' }, 'icon.svg', options)).toEqual(['home', 'icon.svg', options]);
});
