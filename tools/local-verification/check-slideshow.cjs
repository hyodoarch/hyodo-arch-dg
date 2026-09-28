// Browser regression fixture; no changes to notes or publication.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const md = require('markdown-it')();
require('../../src/helpers/userSetup').userMarkdownSetup(md);
const source = '```slideshow\n![[images/top/yamate_IGP0510a.jpg]]\n![[images/top/yamate_IGP0510a.jpg|2枚目]]\n```';
const html = md.render(source + '\n\n' + source + '\n\n```slideshow\n![[images/top/yamate_IGP0510a.jpg]]\n```\n\n```javascript\nconst x = 1;\n```');
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
    await page.clock.install();
    await page.addScriptTag({ path: 'src/site/scripts/slideshow.js' });
    const first = page.locator('.dg-slideshow').nth(0), second = page.locator('.dg-slideshow').nth(1);
    const active = root => root.locator('.is-active').getAttribute('aria-label');
    assert.equal(await first.locator('button').count(), 5);
    assert.equal(await page.locator('.dg-slideshow').nth(2).locator('button').count(), 0);
    await page.mouse.move(0, 0);
    await page.clock.fastForward(5100);
    assert.equal(await active(first), '2 / 2');
    await first.getByRole('button', { name: '次の画像', exact: true }).click();
    assert.equal(await active(first), '1 / 2'); assert.equal(await active(second), '2 / 2');
    await first.getByRole('button', { name: '画像 2 を表示' }).click();
    assert.equal(await active(first), '2 / 2');
    await page.keyboard.press('ArrowLeft'); assert.equal(await active(first), '1 / 2');
    await first.getByRole('button', { name: '自動再生の切替' }).click();
    await page.locator('body').click({ position: { x: 1, y: 1 } }); await page.mouse.move(0, 0);
    await page.clock.fastForward(10000); assert.equal(await active(first), '1 / 2');
    // Dispatch touch pointers to test swipe threshold and direction.
    await first.locator('.dg-slideshow__stage').evaluate(stage => {
      stage.setPointerCapture = () => {};
      stage.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 100 }));
      stage.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', pointerId: 1, clientX: 80, clientY: 110 }));
    });
    assert.equal(await active(first), '2 / 2');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('.dg-slideshow__controls > button').disabled);
    await page.clock.fastForward(10000); assert.equal(await active(first), '2 / 2');
    assert.equal(await first.getByRole('button', { name: '自動再生の切替' }).isDisabled(), true);
    fs.mkdirSync('.cache/slideshow', { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.evaluate(() => [...document.images].every(img => img.complete && img.naturalWidth > 0)), true);
      await page.screenshot({ path: `.cache/slideshow/${width}.png`, fullPage: true });
    }
    assert.equal(await page.locator('pre').innerText(), 'const x = 1;\n');
    assert.deepEqual(errors, []);
    console.log('PASS: autoplay, independent blocks, buttons/dots/keyboard, pause, swipe, reduced motion, single image, desktop/mobile, images, code blocks');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
