// Run after npm run build. PLAYWRIGHT_MODULE may point to a local Playwright install.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const project = path.resolve(__dirname, '../..');
const dist = path.join(project, 'dist');
const output = path.join(project, '.cache/layout-check');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  try {
    let file = path.resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (file !== dist && !file.startsWith(dist + path.sep)) return res.writeHead(403).end();
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
const widths = [390, 674, 675, 768, 820, 999, 1000, 1001, 1024, 1180, 1280, 1440];
const routes = ['/', '/house/', '/house/house_in_sawara/', '/consultation/', '/consultation/faq/', '/news/', '/tags/和風/'];
async function measure(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main.content');
    const rect = el => el ? { x: el.getBoundingClientRect().x, right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width } : null;
    const nav = document.querySelector('.filetree-wrapper');
    const font = selector => { const el = document.querySelector(selector); return el ? getComputedStyle(el).fontSize : null; };
    return {
      viewport: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1,
      main: rect(main), footer: rect(document.querySelector('body > aside > .sidebar')),
      nav: rect(nav), navVisible: !!nav && getComputedStyle(nav).display !== 'none',
      dock: rect(document.querySelector('.hyodo-contact-dock')),
      font: getComputedStyle(main).fontSize,
      headings: ['h1', 'h2', 'h3'].map(s => font('main ' + s)),
      thumbnail: rect(document.querySelector('.folder-note-thumbnail-link')),
      card: rect(document.querySelector('.folder-note-card')),
      navFonts: [font('.filetree-sidebar > .folder .foldername-wrapper'), font('.filetree-sidebar .filelist .notelink'), font('.hyodo-sidebar-links')],
      table: font('main td'),
      images: [...main.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth).map(i => ({ src: i.currentSrc, natural: i.naturalWidth, display: i.getBoundingClientRect().width })),
    };
  });
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const results = [];
  let browser;
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    // In-memory four-column fixture: do not add unpublished notes to the site.
    await page.goto(base + '/house/house_in_sawara/', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      const source = document.querySelector('main img').src;
      const row = document.createElement('div');
      row.className = 'image-grid-captions';
      row.id = 'layout-four-column-fixture';
      row.dataset.gap = '18';
      row.dataset.columns = '4';
      for (let i = 0; i < 4; i++) {
        const figure = document.createElement('figure');
        figure.className = 'image-grid-captions__item';
        const img = document.createElement('img');
        img.className = 'image-grid-captions__image';
        img.src = source;
        figure.append(img);
        row.append(figure);
      }
      document.querySelector('main').prepend(row);
    });
    await page.waitForFunction(() => document.querySelector('#layout-four-column-fixture').dataset.ready === 'true');
    const fourWidths = await page.locator('#layout-four-column-fixture > figure').evaluateAll(items => items.map(i => i.getBoundingClientRect().width));
    fourWidths.forEach(w => assert.ok(Math.abs(w - 201) < 1));
    console.log(JSON.stringify({ fourColumnWidths: fourWidths }));
    if (process.env.GRID_ONLY) return;
    for (const route of process.env.DETAILS_ONLY ? [] : routes) {
      const response = await page.goto(base + encodeURI(route), { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, route);
      await page.waitForFunction(() => !!window.Alpine);
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForFunction(w => {
          const nav = document.querySelector('.filetree-wrapper');
          return (getComputedStyle(nav).display !== 'none') === (w >= 1000);
        }, width);
        await page.waitForTimeout(100);
        const result = { route, ...await measure(page) };
        results.push(result);
        const label = `${route} at ${width}: ${JSON.stringify(result)}`;
        assert.ok(!result.overflow, label);
        assert.equal(result.font, '16px', label);
        assert.deepEqual(result.navFonts, ['18px', '16px', '14px'], label);
        assert.ok(result.main.width <= 859, label);
        if (width >= 1280) assert.ok(Math.abs(result.main.width - 858) < 1, label);
        if (result.footer) {
          assert.ok(Math.abs(result.main.x - result.footer.x) < 1, label);
          assert.ok(Math.abs(result.main.width - result.footer.width) < 1, label);
        }
        if (width >= 1000) {
          assert.ok(result.nav.x >= result.main.right + 39, label);
          assert.ok(result.nav.right <= width + 1, label);
          assert.ok(Math.abs(result.dock.x - result.nav.x) < 1, label);
          assert.equal(result.navFonts[2], '14px', label);
        }
        if (result.thumbnail) {
          const expected = width <= 674 ? result.card.width * .23125 : 201;
          assert.ok(Math.abs(result.thumbnail.width - expected) < 1, label);
        }
        result.headings.forEach((size, i) => { if (size) assert.equal(size, ['20px', '18px', '16px'][i], label); });
        if (route === '/' && [390, 820, 1024, 1440].includes(width)) await page.screenshot({ path: path.join(output, `home-${width}.png`) });
      }
    }
    // Rotation/resizing must preserve both desktop visibility and mobile controls.
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.getByRole('button', { name: 'メニューを開く', exact: true }).click();
    await page.locator('.filetree-wrapper').waitFor({ state: 'visible' });
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.locator('.filetree-wrapper').waitFor({ state: 'visible' });
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.getByRole('button', { name: 'メニューを閉じる', exact: true }).click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.filetree-wrapper')).display === 'none');
    await require('./check-sidebar.cjs')(page, base, output);
    const details = [];
    for (const route of ['/house/house_in_sawara/', '/house/ph-6x6/', '/shop-office/prospect/', '/news/']) {
      await page.goto(base + route, { waitUntil: 'networkidle' });
      await page.locator('main img').evaluateAll(imgs => imgs.forEach(i => i.loading = 'eager'));
      await page.waitForFunction(() => [...document.querySelectorAll('main img')].every(i => i.complete && i.naturalWidth));
      for (const width of [390, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForTimeout(200);
        const d = await page.evaluate(() => {
          const main = document.querySelector('main').getBoundingClientRect();
          const grids = [...document.querySelectorAll('.image-grid-captions')].map(g => {
            const items = [...g.querySelectorAll(':scope > figure')].filter(i => !i.hidden);
            return { count: items.length, width: g.getBoundingClientRect().width, occupied: items.reduce((s, i) => s + i.getBoundingClientRect().width, 0) + (items.length - 1) * parseFloat(getComputedStyle(g).gap), ready: g.dataset.ready };
          });
          const cells = [...document.querySelectorAll('main td')].map(e => ({ font: getComputedStyle(e).fontSize, line: getComputedStyle(e).lineHeight }));
          const outside = [...document.querySelectorAll('main img')].filter(i => { const r = i.getBoundingClientRect(); return r.width && (r.left < main.left - 1 || r.right > main.right + 1); }).map(i => i.src);
          return { grids, cells, outside };
        });
        assert.deepEqual(d.outside, [], `${route} ${width}`);
        d.grids.forEach(g => { assert.equal(g.ready, 'true'); assert.ok(Math.abs(g.width - g.occupied) < 1); });
        d.cells.forEach(c => { assert.equal(c.font, '16px'); assert.equal(c.line, '25.6px'); });
        details.push({ route, width, ...d });
        if (route === '/house/house_in_sawara/' && width === 1440) {
          const image = await page.locator('main img').first().evaluate(i => ({ natural: i.naturalWidth, width: i.getBoundingClientRect().width }));
          assert.equal(image.natural, 900);
          assert.equal(image.width, 858);
          await page.screenshot({ path: path.join(output, 'sawara-1440.png') });
          await page.locator('.image-grid-captions').first().scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(output, 'sawara-grid-1440.png') });
        }
      }
    }
    await page.goto(base, { waitUntil: 'networkidle' });
    const dots = page.locator('.dg-slideshow__dots button');
    await dots.nth(1).click();
    assert.equal(await dots.nth(1).getAttribute('aria-current'), 'true');
    await page.locator('.filetree-sidebar .search-button').click();
    await page.locator('#term').fill('佐原');
    // The existing search binds keydown rather than input.
    await page.locator('#term').press('End');
    await page.locator('.searchresult').first().waitFor();
    await page.locator('.searchresult').first().hover();
    await page.locator('.preview-body p').first().waitFor();
    assert.equal(await page.locator('.preview-body p').first().evaluate(e => getComputedStyle(e).fontSize), '16px');
    await page.screenshot({ path: path.join(output, 'search-1440.png') });
    await page.keyboard.press('Escape');
    await page.locator('body > aside > .sidebar').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'footer-1440.png') });
    const retina = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
    await retina.goto(base + '/house/house_in_sawara/', { waitUntil: 'networkidle' });
    await retina.screenshot({ path: path.join(output, 'sawara-1440-dpr2.png') });
    await retina.close();
    fs.writeFileSync(path.join(output, 'details.json'), JSON.stringify(details, null, 2));
    console.log(JSON.stringify({ checked: results.length, rotation: 'passed', output }));
  } finally {
    if (results.length) fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    if (browser) await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
