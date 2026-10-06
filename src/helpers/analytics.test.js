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

function storage(value) {
  const entries = new Map([['theme', 'dark']]);
  if (value !== undefined) entries.set('hyodo-arch-analytics-optout', value);
  return {
    entries,
    getItem: vi.fn(key => entries.get(key) ?? null),
    setItem: vi.fn((key, value) => entries.set(key, value)),
    removeItem: vi.fn(key => entries.delete(key)),
  };
}

function element(tagName) {
  const events = new Map();
  return {
    tagName, children: [], attributes: {}, removed: false,
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...children) { this.children.push(...children); },
    prepend(child) { this.children.unshift(child); },
    addEventListener(name, callback) { events.set(name, callback); },
    remove() { this.removed = true; },
    click() { events.get('click')?.(); },
  };
}

function visit(html, hostname, protocol = 'https:', options = {}) {
  const loaded = [];
  const store = options.store ?? storage(options.value);
  const events = new Map();
  const documentEvents = new Map();
  const main = element('main');
  const body = element('body');
  const window = {
    location: new URL(options.url ?? `${protocol}//${hostname}/`),
    addEventListener: (name, callback) => events.set(name, callback),
  };
  Object.defineProperty(window, 'localStorage', {
    get() {
      if (options.accessThrows) throw new Error('Storage is blocked');
      return store;
    },
  });
  window.history = {
    state: { preserved: true },
    replaceState: vi.fn((state, unused, url) => {
      if (options.historyThrows) throw new Error('History is blocked');
      window.location = new URL(url, window.location);
    }),
  };
  if (options.alreadyDisabled) window['ga-disable-' + testId] = true;
  const document = {
    readyState: options.readyState ?? 'complete',
    createElement: element,
    querySelector: () => options.noMain ? null : main,
    addEventListener: (name, callback) => documentEvents.set(name, callback),
    body,
    head: { appendChild: tag => loaded.push(tag) },
  };
  for (const script of parse(html).querySelectorAll('script')) {
    runInNewContext(script.textContent, { window, document, URLSearchParams: options.invalidParser ? undefined : URLSearchParams });
  }
  return {
    loaded, window, store, main, body,
    dispatch: (name, event) => events.get(name)?.(event),
    ready: () => documentEvents.get('DOMContentLoaded')?.(),
  };
}

const production = options => visit(render('prod', testId), 'www.hyodo-arch.com', 'https:', options);
const notice = result => (result.main.children[0] ?? result.body.children[0]);
const message = result => notice(result)?.children[0].textContent;
function expectStopped(result) {
  expect(result.loaded).toHaveLength(0);
  expect(result.window.gtag).toBeUndefined();
  expect(result.window.dataLayer).toBeUndefined();
  expect(result.window['ga-disable-' + testId]).toBe(true);
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
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({ async: true, src: 'https://www.googletagmanager.com/gtag/js?id=' + testId });
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

describe('GA4 browser opt-out', () => {
  it('saves exclusion before tracking and reuses it on another page and a new browser window', () => {
    const store = storage();
    const first = production({ store, url: 'https://www.hyodo-arch.com/?analytics=off' });
    expectStopped(first);
    expect(store.entries.get('hyodo-arch-analytics-optout')).toBe('1');
    expect(message(first)).toContain('除外設定を保存しました');
    expect(notice(first).attributes.role).toBe('status');
    const next = production({ store, url: 'https://www.hyodo-arch.com/house/honbasu/' });
    expectStopped(next);
    expect(notice(next)).toBeUndefined();
  });

  it('removes only its own preference, excludes the operation page and resumes on the next page', () => {
    const store = storage('1');
    const operation = production({ store, url: 'https://www.hyodo-arch.com/?analytics=on' });
    expectStopped(operation);
    expect(store.entries.has('hyodo-arch-analytics-optout')).toBe(false);
    expect(store.entries.get('theme')).toBe('dark');
    expect(message(operation)).toContain('除外設定を解除しました');
    const next = production({ store });
    expect(next.loaded).toHaveLength(1);
    expect(next.window.dataLayer.map(command => command[0])).toEqual(['js', 'config']);
  });

  it.each([
    ['1', '除外されています', 'status'],
    [undefined, '除外設定はありません', 'status'],
    ['corrupted', '確認できませんでした', 'alert'],
  ])('reports a saved preference of %s without modifying it or tracking', (value, text, role) => {
    const result = production({ value, url: 'https://www.hyodo-arch.com/?analytics=status' });
    expectStopped(result);
    expect(message(result)).toContain(text);
    expect(notice(result).attributes.role).toBe(role);
    expect(result.store.setItem).not.toHaveBeenCalled();
    expect(result.store.removeItem).not.toHaveBeenCalled();
  });

  it.each(['off', 'on', 'status', ''])('never tracks when storage access is forbidden, for mode %s', mode => {
    const result = production({ accessThrows: true, url: 'https://www.hyodo-arch.com/' + (mode ? '?analytics=' + mode : '') });
    expectStopped(result);
    if (mode) {
      expect(notice(result).attributes.role).toBe('alert');
      expect(message(result)).toMatch(/できませんでした/);
    } else expect(notice(result)).toBeUndefined();
  });

  it.each(['setItem', 'getItem'])('does not claim exclusion was saved when %s throws', method => {
    const store = storage();
    store[method].mockImplementation(() => { throw new Error('Storage failure'); });
    const result = production({ store, url: 'https://www.hyodo-arch.com/?analytics=off' });
    expectStopped(result);
    expect(message(result)).toContain('保存できませんでした');
    expect(notice(result).attributes.role).toBe('alert');
  });

  it('checks the value written rather than treating a no-op write as success', () => {
    const store = storage();
    store.setItem.mockImplementation(() => {});
    const result = production({ store, url: 'https://www.hyodo-arch.com/?analytics=off' });
    expectStopped(result);
    expect(message(result)).toContain('保存できませんでした');
  });

  it.each(['removeItem', 'getItem'])('does not claim exclusion was removed when %s throws', method => {
    const store = storage('1');
    store[method].mockImplementation(() => { throw new Error('Storage failure'); });
    const result = production({ store, url: 'https://www.hyodo-arch.com/?analytics=on' });
    expectStopped(result);
    expect(message(result)).toContain('解除を確認できませんでした');
  });

  it('checks deletion rather than treating a no-op removal as success', () => {
    const store = storage('1');
    store.removeItem.mockImplementation(() => {});
    const result = production({ store, url: 'https://www.hyodo-arch.com/?analytics=on' });
    expectStopped(result);
    expect(store.entries.get('hyodo-arch-analytics-optout')).toBe('1');
    expect(message(result)).toContain('解除を確認できませんでした');
  });

  it.each(['0', '', 'true'])('does not treat a malformed saved value %s as permission to track', value => {
    const result = production({ value });
    expectStopped(result);
    expect(notice(result)).toBeUndefined();
  });

  it.each(['off', 'on', 'status'])('cleans only analytics=%s while preserving path, repeated queries and the anchor', mode => {
    const result = production({ url: `https://www.hyodo-arch.com/house/honbasu/?utm_source=office&analytics=${mode}&check=one&check=two&value=two%20words#photos` });
    expectStopped(result);
    expect(result.window.location.pathname).toBe('/house/honbasu/');
    expect(result.window.location.hash).toBe('#photos');
    expect(Array.from(result.window.location.searchParams)).toEqual([
      ['utm_source', 'office'], ['check', 'one'], ['check', 'two'], ['value', 'two words'],
    ]);
    expect(result.window.history.replaceState.mock.calls[0][0]).toEqual({ preserved: true });
  });

  it.each(['off', 'on', 'status'])('keeps the result and tracking stopped if URL cleanup for %s throws', mode => {
    const result = production({ historyThrows: true, url: 'https://www.hyodo-arch.com/?analytics=' + mode });
    expectStopped(result);
    expect(message(result)).toBeTruthy();
    expect(result.window.location.search).toBe('?analytics=' + mode);
    expect(notice(result).attributes.role).toBe('status');
    if (mode === 'off') expect(result.store.entries.get('hyodo-arch-analytics-optout')).toBe('1');
  });

  it.each(['?analytics=off&analytics=on', '?analytics=off&analytics=off'])('does not change preferences for ambiguous URL %s', query => {
    const result = production({ url: 'https://www.hyodo-arch.com/' + query });
    expectStopped(result);
    expect(result.store.setItem).not.toHaveBeenCalled();
    expect(result.store.removeItem).not.toHaveBeenCalled();
    expect(result.window.history.replaceState).not.toHaveBeenCalled();
    expect(message(result)).toContain('指定方法を確認');
  });

  it.each(['?analytics=unknown', '?analytics=', '?analytics=OFF'])('ignores unrecognized operation %s without cleaning the URL', query => {
    const result = production({ url: 'https://www.hyodo-arch.com/' + query });
    expect(result.loaded).toHaveLength(1);
    expect(result.window.history.replaceState).not.toHaveBeenCalled();
    expect(result.store.setItem).not.toHaveBeenCalled();
    expect(notice(result)).toBeUndefined();
  });

  it('stops on an unreadable preference or unparseable URL without affecting the page', () => {
    const store = storage();
    store.getItem.mockImplementation(() => { throw new Error('Read failure'); });
    expectStopped(production({ store }));
    const unparseable = production({ invalidParser: true });
    expectStopped(unparseable);
    expect(unparseable.store.getItem).not.toHaveBeenCalled();
  });

  it('disables an existing tag after exclusion from another tab, without reinitializing on removal', () => {
    const store = storage();
    const existing = production({ store });
    expect(existing.loaded).toHaveLength(1);
    production({ store, url: 'https://www.hyodo-arch.com/?analytics=off' });
    existing.dispatch('storage', { key: 'hyodo-arch-analytics-optout' });
    expect(existing.window['ga-disable-' + testId]).toBe(true);
    production({ store, url: 'https://www.hyodo-arch.com/?analytics=on' });
    existing.dispatch('storage', { key: 'hyodo-arch-analytics-optout' });
    expect(existing.window['ga-disable-' + testId]).toBe(true);
    expect(existing.loaded).toHaveLength(1);
    expect(existing.window.dataLayer).toHaveLength(2);
  });

  it('ignores another storage key and rechecks exclusion on back/forward restoration', () => {
    const result = production();
    result.store.setItem('hyodo-arch-analytics-optout', '1');
    result.dispatch('storage', { key: 'theme' });
    expect(result.window['ga-disable-' + testId]).toBeUndefined();
    result.dispatch('pageshow', { persisted: false });
    expect(result.window['ga-disable-' + testId]).toBeUndefined();
    result.dispatch('pageshow', { persisted: true });
    expect(result.window['ga-disable-' + testId]).toBe(true);
    expect(result.loaded).toHaveLength(1);
    expect(result.window.dataLayer).toHaveLength(2);
  });

  it('rechecks a storage clear event and stops if the preference becomes unreadable', () => {
    const result = production();
    result.store.getItem.mockImplementation(() => { throw new Error('Read failure'); });
    result.dispatch('storage', { key: null });
    expect(result.window['ga-disable-' + testId]).toBe(true);
  });

  it('never overrides a pre-existing Google tracking disable flag', () => {
    expectStopped(production({ alreadyDisabled: true }));
  });

  it('waits for the body and allows closing the notice without restarting tracking', () => {
    const result = production({ readyState: 'loading', url: 'https://www.hyodo-arch.com/?analytics=off' });
    expect(notice(result)).toBeUndefined();
    result.ready();
    const banner = notice(result);
    expect(banner).toBeTruthy();
    expect(banner.children[1].type).toBe('button');
    banner.children[1].click();
    expect(banner.removed).toBe(true);
    expectStopped(result);
  });

  it('uses the body as a fallback when there is no main content element', () => {
    const result = production({ noMain: true, url: 'https://www.hyodo-arch.com/?analytics=status' });
    expect(result.main.children).toHaveLength(0);
    expect(result.body.children).toHaveLength(1);
    expectStopped(result);
  });

  it.each(['hyodo-arch-dg.pages.dev', '0c4d71ec.hyodo-arch-dg.pages.dev', 'localhost', 'www.hyodo-arch.com.example.org'])('does not save or clean an opt-out operation on %s', hostname => {
    const result = visit(render('prod', testId), hostname, 'https:', { url: `https://${hostname}/?analytics=off` });
    expect(result.loaded).toHaveLength(0);
    expect(result.store.getItem).not.toHaveBeenCalled();
    expect(result.store.setItem).not.toHaveBeenCalled();
    expect(result.window.history.replaceState).not.toHaveBeenCalled();
    expect(notice(result)).toBeUndefined();
  });
});
