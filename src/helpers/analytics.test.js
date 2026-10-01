import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'node-html-parser';

const require = createRequire(import.meta.url);
const analytics = require('../site/_data/analytics');
const nunjucks = require('nunjucks');
const template = readFileSync(new URL('../site/_includes/components/user/common/head/ga4.njk', import.meta.url), 'utf8');
const testId = 'G-0123456789';

afterEach(() => vi.unstubAllEnvs());

function render(env, id) {
  vi.stubEnv('ELEVENTY_ENV', env);
  vi.stubEnv('GA_MEASUREMENT_ID', id);
  return nunjucks.renderString(template, { analytics: analytics() });
}

function visit(html, hostname, protocol = 'https:') {
  const loaded = [];
  const window = { location: { hostname, protocol } };
  const document = {
    createElement: () => ({}),
    head: { appendChild: tag => loaded.push(tag) },
  };
  for (const script of parse(html).querySelectorAll('script')) {
    runInNewContext(script.textContent, { window, document });
  }
  return { loaded, window };
}

describe('GA4 production tracking', () => {
  it('omits the loader when the measurement ID is absent or the build is not production', () => {
    for (const [env, id] of [['prod', undefined], ['prod', '   '], ['dev', testId], [undefined, testId]]) {
      const html = render(env, id);
      expect(parse(html).querySelectorAll('script')).toHaveLength(0);
      expect(visit(html, 'www.hyodo-arch.com').loaded).toHaveLength(0);
    }
  });

  it('loads one async Google tag and queues the standard config on the production domain', () => {
    const { loaded, window } = visit(render('prod', ' ' + testId + ' '), 'www.hyodo-arch.com');
    expect(loaded).toEqual([{ async: true, src: 'https://www.googletagmanager.com/gtag/js?id=' + testId }]);
    const commands = window.dataLayer.map(command => Array.from(command));
    expect(commands.map(command => command[0])).toEqual(['js', 'config']);
    expect(commands[1]).toEqual(['config', testId]);
  });

  it('makes no Google requests or tracking calls on previews, local addresses or other domains', () => {
    const html = render('prod', testId);
    for (const host of ['hyodo-arch-dg.pages.dev', 'preview.hyodo-arch-dg.pages.dev', 'localhost', '127.0.0.1', 'hyodo-arch.com', 'www.hyodo-arch.com.example.org']) {
      const { loaded, window } = visit(html, host);
      expect(loaded).toHaveLength(0);
      expect(window.dataLayer).toBeUndefined();
      expect(window.gtag).toBeUndefined();
    }
    expect(visit(html, 'www.hyodo-arch.com', 'http:').loaded).toHaveLength(0);
  });

  it('rejects numeric, legacy and unsafe IDs instead of generating a broken tracking tag', () => {
    for (const id of ['1234567890', 'UA-12345678-1', 'G-', 'G-ABC\"</script>']) {
      expect(() => render('prod', id)).toThrow('GA_MEASUREMENT_ID');
    }
  });
});
