// Run after npm run build. Requires Playwright; defaults to installed Microsoft Edge.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const project = path.resolve(__dirname, '../..');
const dist = path.join(project, 'dist');
const output = path.join(project, '.cache/image-grid-gap-check');
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
async function measure(page, selector = '.image-grid-captions') {
    return page.locator(selector).evaluateAll(rows => rows.map(row => {
        const rect = row.getBoundingClientRect();
        const items = [...row.querySelectorAll(':scope > figure')];
        const images = items.map(item => item.querySelector('img'));
        return {
            width: rect.width, configuredGap: Number(row.dataset.gap), gap: parseFloat(getComputedStyle(row).gap),
            columns: Number(row.dataset.columns), ready: row.dataset.ready,
            visible: items.every(item => !item.hidden),
            widths: items.map(item => item.getBoundingClientRect().width),
            heights: images.map(img => img.getBoundingClientRect().height),
            ratios: images.map(img => img.naturalWidth / img.naturalHeight),
            rightError: Math.abs(items.at(-1).getBoundingClientRect().right - rect.right),
            captions: items.map(item => {
                const caption = item.querySelector('figcaption');
                if (!caption) return null;
                const horizontal = element => {
                    const style = getComputedStyle(element);
                    return ['paddingLeft', 'paddingRight', 'marginLeft', 'marginRight'].map(key => parseFloat(style[key]));
                };
                return { spacing: horizontal(caption), width: caption.getBoundingClientRect().width,
                    children: [...caption.children].map(horizontal) };
            }),
        };
    }));
}
function verify(rows) {
    assert.ok(rows.length, 'Expected at least one image grid');
    for (const row of rows) {
        const label = JSON.stringify(row);
        assert.equal(row.ready, 'true', label);
        assert.ok(row.visible, label);
        assert.equal(row.widths.length, row.columns, label);
        const expected = row.width <= 375 ? row.configuredGap / 2 : row.width >= 720 ? row.configuredGap :
            row.configuredGap / 2 + (row.width - 375) * row.configuredGap / 690;
        assert.ok(Math.abs(row.gap - expected) < 0.001, label);
        assert.ok(Math.abs(row.widths.reduce((a, b) => a + b, 0) + row.gap * (row.columns - 1) - row.width) < 0.2, label);
        assert.ok(row.rightError < 0.2, label);
        row.widths.forEach((width, i) => {
            assert.ok(width > 0 && row.heights[i] > 0, label);
            assert.ok(Math.abs(row.heights[i] - row.heights[0]) < 0.1, label);
            assert.ok(Math.abs(width / row.heights[i] - row.ratios[i]) < 0.002, label);
        });
    }
}
function verifyCaptions(rows, viewport) {
    for (const row of rows) row.captions.forEach((caption, index) => {
        if (!caption) return;
        const expected = viewport <= 674 ? [index === 0 ? 9 : 0, index === row.columns - 1 ? 9 : 0, 0, 0] : [0, 0, 0, 0];
        assert.deepEqual(caption.spacing, expected, `Caption ${index} at ${viewport}: ${JSON.stringify(row)}`);
        assert.ok(Math.abs(caption.width - row.widths[index]) < 0.1, 'Padding must stay inside the figure width');
        caption.children.forEach(spacing => assert.deepEqual(spacing, [0, 0, 0, 0]));
    });
}
async function createFixture(page, columns, configuredGap, omittedCaptions = []) {
    await page.evaluate(({ columns, configuredGap, omittedCaptions }) => {
        document.getElementById('gap-fixture')?.remove();
        const row = document.createElement('div');
        row.id = 'gap-fixture';
        row.className = 'image-grid-captions';
        row.dataset.columns = String(columns);
        row.dataset.gap = String(configuredGap);
        row.style.width = '858px';
        for (let i = 0; i < columns; i++) {
            const figure = document.createElement('figure');
            figure.className = 'image-grid-captions__item';
            const image = document.createElement('img');
            image.className = 'image-grid-captions__image';
            image.src = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${i % 2 ? 600 : 300}" height="450"><rect width="100%" height="100%" fill="silver"/></svg>`);
            figure.append(image);
            if (!omittedCaptions.includes(i)) {
                const caption = document.createElement('figcaption');
                caption.className = 'image-grid-captions__caption';
                for (const [tag, text] of [['h3', `写真${i + 1}の見出し`], ['p', '複数行に折り返す説明文です。画像の幅の中に収まることを確認します。'], ['p', '二つ目の段落です。']]) {
                    const block = document.createElement(tag);
                    block.textContent = text;
                    caption.append(block);
                }
                figure.append(caption);
            }
            row.append(figure);
        }
        document.querySelector('main').prepend(row);
    }, { columns, configuredGap, omittedCaptions });
}
async function settled(page, selector = '.image-grid-captions') {
    await page.waitForFunction(selector => [...document.querySelectorAll(selector)].every(row => {
        const width = row.getBoundingClientRect().width;
        const max = Number(row.dataset.gap);
        const expected = width <= 375 ? max / 2 : width >= 720 ? max : max / 2 + (width - 375) * max / 690;
        const items = [...row.querySelectorAll(':scope > figure')];
        const occupied = items.reduce((sum, item) => sum + item.getBoundingClientRect().width, 0) + expected * (items.length - 1);
        return row.dataset.ready === 'true' && Math.abs(parseFloat(getComputedStyle(row).gap) - expected) < 0.001 &&
            items.every(item => !item.hidden) && Math.abs(occupied - width) < 0.2;
    }), selector);
    // ResizeObserver updates width, height and gap in the same callback.
}
(async () => {
    fs.mkdirSync(output, { recursive: true });
    const results = [];
    let browser;
    try {
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const base = `http://127.0.0.1:${server.address().port}`;
        browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        // Keep CDN UI dependencies available, but never send test analytics.
        await page.route('**/*', route => /googletagmanager\.com|google-analytics\.com|doubleclick\.net/.test(new URL(route.request().url()).hostname) ? route.abort() : route.continue());
        for (const route of ['/house/ph-6x6/', '/house/honbasu/']) {
            const response = await page.goto(base + route, { waitUntil: 'load' });
            assert.equal(response.status(), 200, route);
            await page.locator('.image-grid-captions img').evaluateAll(images => images.forEach(img => img.loading = 'eager'));
            await page.waitForFunction(() => [...document.querySelectorAll('.image-grid-captions img')].every(img => img.complete && img.naturalWidth));
            for (const width of [320, 374, 375, 376, 390, 393, 480, 600, 674, 675, 719, 720, 721, 768, 820, 999, 1000, 1024, 1440, 375, 1440]) {
                await page.setViewportSize({ width, height: 1000 });
                await settled(page);
                const rows = await measure(page);
                verify(rows);
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} ${width}: overflow`);
                verifyCaptions(rows, width);
                results.push({ route, viewport: width, rows });
                if ([375, 393, 768, 1440].includes(width)) {
                    await page.locator('.image-grid-captions').first().scrollIntoViewIfNeeded();
                    await page.screenshot({ path: path.join(output, `${route.split('/')[2]}-${width}.png`) });
                    if (route === '/house/ph-6x6/' && width === 393) {
                        await page.locator('.image-grid-captions[data-columns="2"]').first().scrollIntoViewIfNeeded();
                        await page.screenshot({ path: path.join(output, 'ph-6x6-two-393.png') });
                    }
                }
            }
            const zoom = page.locator('.image-grid-captions__zoom').first();
            await zoom.focus();
            await zoom.click();
            await page.locator('.image-grid-captions__lightbox:not([hidden])').waitFor();
            await page.keyboard.press('Escape');
            await page.locator('.image-grid-captions__lightbox').waitFor({ state: 'hidden' });
        }
        // Only browser memory contains fixtures; no notes or published inputs are written.
        await page.setViewportSize({ width: 1440, height: 1000 });
        for (const columns of [2, 3, 4]) {
            for (const configuredGap of [0, 8, 18]) {
                await createFixture(page, columns, configuredGap);
                for (const width of [858, 720, 719.5, 600, 480, 375.5, 375, 320, 720, 375, 858]) {
                    await page.locator('#gap-fixture').evaluate((row, width) => row.style.width = `${width}px`, width);
                    await settled(page, '#gap-fixture');
                    const rows = await measure(page, '#gap-fixture');
                    verify(rows);
                    verifyCaptions(rows, 1440);
                    results.push({ fixture: true, columns, configuredGap, width, rows });
                }
            }
        }
        // Keep the same fixture while crossing the mobile boundary and returning.
        for (const columns of [2, 3, 4]) {
            for (const omittedCaptions of [[], [0], [columns - 1], [0, columns - 1]]) {
                await createFixture(page, columns, 18, omittedCaptions);
                await page.locator('#gap-fixture').evaluate(row => row.style.width = '100%');
                for (const viewport of [375, 393, 674, 675, 768, 1440, 375]) {
                    await page.setViewportSize({ width: viewport, height: 1000 });
                    await settled(page, '#gap-fixture');
                    const rows = await measure(page, '#gap-fixture');
                    verify(rows);
                    verifyCaptions(rows, viewport);
                    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Fixture overflow');
                    results.push({ captionFixture: true, columns, omittedCaptions, viewport, rows });
                    if (columns === 4 && omittedCaptions.length === 0 && viewport === 393) {
                        await page.locator('#gap-fixture').scrollIntoViewIfNeeded();
                        await page.screenshot({ path: path.join(output, 'four-captions-393.png') });
                    }
                }
            }
        }
        assert.deepEqual(errors, [], 'Uncaught browser errors');
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
        console.log(`Passed ${results.length} page/fixture conditions; screenshots and measurements: ${output}`);
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
