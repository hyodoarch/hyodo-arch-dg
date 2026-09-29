// Browser regression fixture; no changes to notes or publication.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const md = require('markdown-it')();
require('../../src/helpers/userSetup').userMarkdownSetup(md);
const source = '```slideshow\n![[images/top/yamate_IGP0510a.jpg]]\n![[images/top/yamate_IGP0510a.jpg|2枚目]]\n```';
const configured = source.replace('slideshow\n', 'slideshow\nautoplay: true\nspeed: 250\nautoPlayDuration: 4200\nnav: true\narrow: true\n');
const hiddenAutoplay = source.replace('slideshow\n', 'slideshow\nautoplay: true\n');
const html = md.render([configured, source, '```slideshow\n![[images/top/yamate_IGP0510a.jpg]]\n```', hiddenAutoplay, source.replace('slideshow\n', 'slideshow\nnav: true\n'), source.replace('slideshow\n', 'slideshow\narrow: true\n'), '```javascript\nconst x = 1;\n```'].join('\n\n'));
(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('http://slideshow.test/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<main class="cm-s-obsidian">' + html + '</main>' });
      const file = 'src/site' + decodeURIComponent(url.pathname);
      return route.fulfill({ body: fs.readFileSync(file), contentType: 'image/jpeg' });
    });
    await page.goto('http://slideshow.test/');
    await page.addStyleTag({ path: 'dist/styles/user/slideshow.css' });
    const clockStart = new Date('2026-09-28T00:00:00Z');
    await page.clock.install({ time: clockStart });
    await page.clock.pauseAt(clockStart);
    await page.addScriptTag({ path: 'src/site/scripts/slideshow.js' });
    const first = page.locator('.dg-slideshow').nth(0), second = page.locator('.dg-slideshow').nth(1);
    const active = root => root.locator('.is-active').getAttribute('aria-label');
    const hidden = page.locator('.dg-slideshow').nth(3);
    assert.equal(await first.locator('button').count(), 4);
    assert.equal(await second.locator('button').count(), 0);
    assert.equal(await hidden.locator('button').count(), 0);
    assert.equal(await page.locator('.dg-slideshow').nth(4).locator('button').count(), 2);
    assert.equal(await page.locator('.dg-slideshow').nth(5).locator('button').count(), 2);
    assert.equal(await page.getByRole('button', { name: '自動再生の切替' }).count(), 0);
    assert.equal(await first.locator('.dg-slideshow__slide').first().evaluate(el => getComputedStyle(el).transitionDuration), '0.25s');
    assert.equal(await second.locator('.dg-slideshow__slide').first().evaluate(el => getComputedStyle(el).transitionDuration), '1s');
    assert.equal(await page.locator('.dg-slideshow').nth(2).locator('button').count(), 0);
    await page.mouse.move(0, 0);
    await page.clock.runFor(2999);
    assert.equal(await active(first), '1 / 2'); assert.equal(await active(hidden), '1 / 2');
    await page.clock.runFor(1);
    assert.equal(await active(hidden), '2 / 2');
    await page.clock.runFor(1199); assert.equal(await active(first), '1 / 2');
    await page.clock.runFor(1);
    assert.equal(await active(first), '2 / 2');
    assert.equal(await active(second), '1 / 2');
    await first.locator('.dg-slideshow__stage').hover();
    await first.getByRole('button', { name: '次の画像', exact: true }).click();
    assert.equal(await active(first), '1 / 2'); assert.equal(await active(second), '1 / 2');
    await first.getByRole('button', { name: '画像 2 を表示' }).click();
    assert.equal(await active(first), '2 / 2');
    await page.keyboard.press('ArrowLeft'); assert.equal(await active(first), '1 / 2');
    // Focus/hover pause playback while controls are being used.
    await page.clock.fastForward(10000); assert.equal(await active(first), '1 / 2');
    await page.evaluate(() => document.activeElement.blur()); await page.mouse.move(0, 0);
    await page.clock.runFor(0); await page.clock.fastForward(4200);
    assert.equal(await active(first), '2 / 2');
    // Dispatch touch pointers to test swipe threshold and direction.
    await first.locator('.dg-slideshow__stage').evaluate(stage => {
      stage.setPointerCapture = () => {};
      stage.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 100 }));
      stage.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', pointerId: 1, clientX: 80, clientY: 110 }));
    });
    assert.equal(await active(first), '1 / 2');
    await page.clock.fastForward(4200); assert.equal(await active(first), '1 / 2');
    // Navigation-free blocks remain keyboard-operable.
    await second.focus(); await page.keyboard.press('ArrowRight'); assert.equal(await active(second), '2 / 2');
    await page.clock.fastForward(5000); assert.equal(await active(second), '2 / 2');
    await page.evaluate(() => {
      window.reducedReady = new Promise(resolve => matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', resolve, { once: true }));
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => window.reducedReady.then(() => true));
    const reducedSlide = await active(hidden);
    await page.clock.fastForward(3000); assert.equal(await active(hidden), reducedSlide);
    assert.equal(await first.locator('.dg-slideshow__slide').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    fs.mkdirSync('.cache/slideshow', { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.evaluate(() => [...document.images].every(img => img.complete && img.naturalWidth > 0)), true);
      await page.screenshot({ path: `.cache/slideshow/${width}.png`, fullPage: true });
    }
    assert.equal(await page.locator('pre').innerText(), 'const x = 1;\n');
    assert.deepEqual(errors, []);
    console.log('PASS: five settings/defaults, independent blocks, interval/speed, optional navigation, keyboard, focus/hover pause, swipe stops autoplay, reduced motion, single image, desktop/mobile, images, code blocks');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
