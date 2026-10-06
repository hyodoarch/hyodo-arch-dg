const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MarkdownIt = require('markdown-it');
const { imageCaptions } = require('../../src/helpers/imageCaptions');
const dist = path.resolve(__dirname, '../../dist');
const output = path.resolve(__dirname, '../../.cache/image-captions-check');
const md = new MarkdownIt().use(imageCaptions);
const photo = '/img/user/images/house/iwatsuki/iwatsuki-04_DSC04059.jpg';
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  try {
    let file = path.resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
(async () => {
  let browser;
  const results = [];
  try {
    fs.mkdirSync(output, { recursive: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const html = fs.readFileSync(path.join(dist, 'house/iwatsuki/index.html'), 'utf8');
    const styles = [...html.matchAll(/<link\b[^>]*>/g)].map(m => m[0]).filter(s => /stylesheet/.test(s)).join('');
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1100 } });
      await page.goto(base + '/house/iwatsuki/', { waitUntil: 'networkidle' });
      const actual = await page.evaluate(() => {
        const img = document.querySelector('img[alt="ワンルームタイプ"]');
        const prior = document.querySelector('img[alt="玄関ホール"]').closest('figure').getBoundingClientRect();
        const rect = img.getBoundingClientRect();
        return { imageWidth: rect.width, mainWidth: img.closest('main').getBoundingClientRect().width, top: rect.top, priorBottom: prior.bottom };
      });
      assert.ok(Math.abs(actual.imageWidth - actual.mainWidth) < 2, JSON.stringify(actual));
      assert.ok(actual.top >= actual.priorBottom, JSON.stringify(actual));
      await page.locator('img[alt="玄関ホール"]').evaluate(img => img.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await page.screenshot({ path: path.join(output, `iwatsuki-${width}.png`) });
      results.push({ width, actual });
      for (const side of ['left', 'right']) {
        for (const alias of ['++Full', 'Caption', '++Full|left', 'Caption|right', 'Caption|center', '++Small|120', 'Caption|120', '++Large|450', 'Caption|450']) {
          const body = `<figure class="image-captions-figure image-captions-${side}" style="width:317px;height:700px;--image-caption-width:317px"></figure>` + md.render(`![${alias}](${photo})`);
          await page.setContent(`<base href="${base}/">${styles}<main class="content">${body}</main>`);
          await page.locator('img').evaluate(img => img.decode());
          const measured = await page.evaluate(() => {
            const [prior, current] = document.querySelectorAll('figure');
            const a = prior.getBoundingClientRect(), b = current.getBoundingClientRect();
            return { top: b.top, priorTop: a.top, priorBottom: a.bottom, width: b.width, mainWidth: current.closest('main').getBoundingClientRect().width, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
          });
          const sized = /\|(120|450)$/.exec(alias);
          if (!sized) {
            assert.ok(Math.abs(measured.width - measured.mainWidth) < 2, JSON.stringify({ alias, measured }));
            assert.ok(measured.top >= measured.priorBottom, JSON.stringify({ alias, measured }));
          } else if (sized[1] === '120') {
            assert.ok(Math.abs(measured.width - 120) < 2, JSON.stringify({ alias, measured }));
            assert.ok(Math.abs(measured.top - measured.priorTop) < 2, JSON.stringify({ alias, measured }));
          } else {
            assert.ok(Math.abs(measured.width - Math.min(450, measured.mainWidth)) < 2, JSON.stringify({ alias, measured }));
            assert.ok(measured.top >= measured.priorBottom, JSON.stringify({ alias, measured }));
          }
          assert.equal(measured.overflow, false);
          results.push({ width, side, alias, ...measured });
        }
      }
      await page.close();
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(`Image Captions: ${results.length} browser checks passed.`);
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
