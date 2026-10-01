const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { parse } = require('node-html-parser');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const project = path.resolve(__dirname, '../..');
const dist = path.join(project, 'dist');
const output = path.join(project, '.cache/404-check');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.xml': 'application/xml', '.woff2': 'font/woff2' };
const missingRoutes = ['/__dg_404_check__', '/house/__dg_404_check__/missing/?from=check#missing'];
const settingNames = ['autoplay', 'speed', 'auto-play-duration', 'nav', 'arrow'];
function slideshowSnapshot(html) {
  const slider = parse(html).querySelector('main .dg-slideshow');
  assert.ok(slider, 'Homepage and 404 must contain a slideshow');
  return {
    settings: Object.fromEntries(settingNames.map(name => [name, slider.getAttribute('data-' + name)])),
    images: slider.querySelectorAll('.dg-slideshow__slide img').map(img => ({ src: img.getAttribute('src'), alt: img.getAttribute('alt') })),
  };
}

// Model Pages' static 404 fallback locally; VERIFY_BASE tests the real host.
const server = http.createServer((req, res) => {
  let file;
  let status = 200;
  try {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    file = path.resolve(dist, '.' + requested);
    if (file !== dist && !file.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) && !path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      file = path.join(dist, '404.html');
      status = 404;
    }
    res.writeHead(status, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  } catch (error) { res.writeHead(500).end(error.message); }
});

(async () => {
  fs.mkdirSync(output, { recursive: true });
  let browser;
  const results = [];
  try {
    if (!process.env.VERIFY_BASE) {
      assert.ok(fs.existsSync(path.join(dist, '404.html')), 'Build must generate a top-level 404.html');
      assert.ok(!fs.existsSync(path.join(dist, '404/index.html')), 'Obsolete 404/index.html must not survive a fresh build');
      assert.deepEqual(slideshowSnapshot(fs.readFileSync(path.join(dist, '404.html'), 'utf8')), slideshowSnapshot(fs.readFileSync(path.join(dist, 'index.html'), 'utf8')));
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    }
    const base = process.env.VERIFY_BASE || `http://127.0.0.1:${server.address().port}`;
    const url = route => new URL(route, base + '/').href;
    const homepage = await fetch(url('/'));
    assert.equal(homepage.status, 200);
    const expectedSlideshow = slideshowSnapshot(await homepage.text());
    const collections = {};
    for (const route of ['/sitemap.xml', '/feed.xml', '/searchIndex.json', '/graph.json']) {
      const response = await fetch(url(route));
      assert.equal(response.status, 200, route);
      const content = await response.text();
      assert.doesNotMatch(content, /\/404(?:\/|\.html|["<])/, `404 must be excluded from ${route}`);
      collections[route] = '404 excluded';
    }
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width < 1000, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const [index, route] of missingRoutes.entries()) {
        errors.length = 0;
        const response = await page.goto(url(route), { waitUntil: 'load', timeout: 45000 });
        assert.equal(response.status(), 404, route);
        await page.waitForFunction(() => Array.isArray(window.docs) && !!window.Alpine && document.querySelector('.dg-slideshow')?.dataset.initialized === 'true' && [...document.images].every(img => img.complete));
        await page.evaluate(() => document.fonts.ready);
        const state = await page.evaluate(() => ({
          title: document.title,
          heading: document.querySelector('main h1')?.textContent,
          robots: document.querySelector('meta[name=robots]')?.content,
          brokenImages: [...document.images].filter(img => !img.naturalWidth).map(img => img.getAttribute('src')),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          office: !!document.querySelector('.hyodo-office-info'),
          slideshow: {
            settings: Object.fromEntries(['autoplay', 'speed', 'auto-play-duration', 'nav', 'arrow'].map(name => [name, document.querySelector('main .dg-slideshow').getAttribute('data-' + name)])),
            images: [...document.querySelectorAll('main .dg-slideshow__slide img')].map(img => ({ src: img.getAttribute('src'), alt: img.getAttribute('alt') })),
          },
          styles: [...document.querySelectorAll('link[rel=stylesheet]')].map(el => el.getAttribute('href')).filter(href => href.includes('/styles/user/')),
        }));
        assert.equal(state.heading, '404 Not Found');
        assert.match(state.title, /兵藤善紀建築設計事務所$/);
        assert.equal(state.robots, 'noindex, follow');
        assert.deepEqual(state.brokenImages, []);
        assert.equal(state.overflow, false);
        assert.ok(state.office && state.styles.some(style => style.includes('hyodo-arch.css')));
        assert.deepEqual(state.slideshow, expectedSlideshow, '404 photos/order/settings must follow HOME');
        if (index === 0) {
          await page.screenshot({ path: path.join(output, `${process.env.VERIFY_BASE ? 'remote' : 'local'}-${width}.png`), fullPage: true });
          const slider = page.locator('main .dg-slideshow');
          const slideCount = expectedSlideshow.images.length;
          if (slideCount > 1) {
            if (expectedSlideshow.settings.nav === 'true') {
              assert.equal(await slider.locator('.dg-slideshow__dots button').count(), slideCount);
              await slider.getByRole('button', { name: `画像 ${slideCount} を表示`, exact: true }).click();
              assert.equal(await slider.locator('.is-active').getAttribute('aria-label'), `${slideCount} / ${slideCount}`);
            } else {
              await slider.focus();
            }
            await slider.press('ArrowLeft');
            const selected = expectedSlideshow.settings.nav === 'true' ? slideCount - 1 : slideCount;
            assert.equal(await slider.locator('.is-active').getAttribute('aria-label'), `${selected} / ${slideCount}`);
          }
          if (width < 1000) {
            const menu = page.locator('.hyodo-mobile-menu');
            await menu.click();
            await page.waitForFunction(() => document.querySelector('.hyodo-mobile-menu').getAttribute('aria-expanded') === 'true');
            await page.locator('.hyodo-mobile-search').click();
          } else {
            await page.locator('.filetree-sidebar .search-button').click();
          }
          await page.waitForFunction(() => document.querySelector('#globalsearch').classList.contains('active'));
          await page.locator('#term').fill('本蓮');
          await page.evaluate(() => window.search());
          await page.locator('.searchresult').filter({ hasText: '本蓮の家' }).first().waitFor();
          await page.keyboard.press('Escape');
          if (width < 1000) await page.waitForFunction(() => document.querySelector('.hyodo-mobile-menu').getAttribute('aria-expanded') === 'false');
          await Promise.all([
            page.waitForURL(url('/')),
            page.locator('main a[href="/"]').click(),
          ]);
          assert.equal(await page.locator('main h1').filter({ hasText: '404 Not Found' }).count(), 0, 'HOME link must reach the real homepage');
        }
        assert.deepEqual(errors, [], `Browser errors on ${route} at ${width}px`);
        results.push({ route, width, status: response.status(), ...state, navigation: index === 0 ? 'menu/search/HOME passed' : 'deep URL passed' });
      }
      await page.close();
    }
    const playback = [];
    if (expectedSlideshow.settings.autoplay === 'true' && expectedSlideshow.images.length > 1) {
      for (const width of [1440, 390]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width < 1000, reducedMotion: 'no-preference' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url(missingRoutes[1]), { waitUntil: 'load', timeout: 45000 });
        const slider = page.locator('main .dg-slideshow');
        await page.locator('main .dg-slideshow[data-initialized=true]').waitFor();
        const duration = Number(expectedSlideshow.settings['auto-play-duration']);
        const active = await slider.locator('.is-active').getAttribute('aria-label');
        await page.waitForFunction(previous => document.querySelector('main .dg-slideshow .is-active').getAttribute('aria-label') !== previous, active, { timeout: duration * 2 + 2000 });
        assert.equal(await slider.locator('.dg-slideshow__slide').first().evaluate(el => getComputedStyle(el).transitionDuration), `${Number(expectedSlideshow.settings.speed) / 1000}s`);
        assert.deepEqual(errors, []);
        playback.push({ width, autoplay: 'passed', speed: expectedSlideshow.settings.speed, interval: duration });
        await page.close();
      }
    }
    fs.writeFileSync(path.join(output, process.env.VERIFY_BASE ? 'remote.json' : 'local.json'), JSON.stringify({ base, collections, results, playback }, null, 2));
    console.log(JSON.stringify({ checked: results.length, slides: expectedSlideshow.images.length, playback, collections, failed: 0 }));
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
