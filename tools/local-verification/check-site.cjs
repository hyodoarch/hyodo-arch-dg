const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const matter = require('gray-matter');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const project = path.resolve(__dirname, '../..');
const dist = path.join(project, 'dist');
const output = path.join(project, '.cache/site-check');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.json': 'application/json', '.woff2': 'font/woff2' };
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const routes = [...new Set(files(path.join(project, 'src/site/notes')).filter(p => p.endsWith('.md')).map(p => matter(fs.readFileSync(p, 'utf8')).data.permalink).filter(Boolean).concat('/tags/和風/'))];
const server = http.createServer((req, res) => {
  try {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(dist, '.' + requested);
    if (file !== dist && !file.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
(async () => {
  fs.mkdirSync(output, { recursive: true });
  let browser;
  const results = [];
  try {
    if (!process.env.VERIFY_BASE) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = process.env.VERIFY_BASE || `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      for (const route of routes) {
        const errors = [];
        const onError = error => errors.push(error.message);
        page.on('pageerror', onError);
        const response = await page.goto(new URL(encodeURI(route), base + '/').href, { waitUntil: 'networkidle', timeout: 60000 });
        await page.locator('img').evaluateAll(imgs => imgs.forEach(img => img.loading = 'eager'));
        await page.waitForFunction(() => [...document.images].every(img => img.complete), undefined, { timeout: 30000 });
        const result = await page.evaluate(() => ({
          title: document.title,
          brokenImages: [...document.images].filter(img => !img.naturalWidth).map(img => img.getAttribute('src')),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          office: !!document.querySelector('.hyodo-office-info'),
          backToTop: !!document.querySelector('.hyodo-back-to-top'),
          backlinks: document.querySelectorAll('.backlinks').length,
          graphLabelSize: getComputedStyle(document.body).getPropertyValue('--dg-graph-label-size').trim(),
          unrendered: /\{%\s*noteTags|\{\{\s*title\s*\}\}/.test(document.querySelector('main')?.innerText || ''),
          userStyles: [...document.querySelectorAll('link[rel=stylesheet]')].map(el => el.getAttribute('href')).filter(href => href?.includes('/styles/user/')),
        }));
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        if (result.backToTop) {
          await page.locator('.hyodo-back-to-top').click();
          await page.waitForFunction(() => window.scrollY < 2);
        }
        if (route === '/' || route === '/projects/ushibori_dozo/' || route === '/事務所案内/アクセス/') await page.screenshot({ path: path.join(output, `${process.env.VERIFY_BASE ? 'remote' : 'local'}-${width}-${route === '/' ? 'home' : route === '/projects/ushibori_dozo/' ? 'dozo' : 'access'}.png`), fullPage: true });
        page.off('pageerror', onError);
        const checked = { route, width, status: response.status(), ...result, errors };
        checked.passed = checked.status === 200 && !result.brokenImages.length && !result.overflow && result.office && result.backToTop && !result.backlinks && result.graphLabelSize === '24' && !result.unrendered && result.userStyles.some(p => p.includes('hyodo-footer.css')) && !errors.length;
        results.push(checked);
        console.log(JSON.stringify(checked));
      }
      await page.close();
    }
    fs.writeFileSync(path.join(output, process.env.VERIFY_BASE ? 'remote.json' : 'local.json'), JSON.stringify({ base, results }, null, 2));
    const failed = results.filter(r => !r.passed);
    console.log(JSON.stringify({ checked: results.length, failed: failed.length }));
    if (failed.length) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
