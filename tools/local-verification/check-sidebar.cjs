// Called by check-layout.cjs against built pages; never modifies published notes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async function checkSidebar(page, base, output) {
  const results = [];
  for (const width of [390, 768, 820, 999, 1000, 1001, 1024, 1180, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle' });
    if (width < 1000) await page.getByRole('button', { name: 'メニューを開く', exact: true }).click();
    const nav = page.locator('.filetree-sidebar');
    await nav.waitFor({ state: 'visible' });
    const category = nav.locator('.foldername-wrapper').filter({ has: page.locator('a[href="/house/"]') });
    const work = nav.locator('a[href="/house/house_in_sawara/"]');
    if (await work.isVisible()) await category.locator('svg:visible').click();
    await work.waitFor({ state: 'hidden' });
    await category.locator('svg:visible').click();
    await work.waitFor({ state: 'visible' });
    // Expand every category to cover long project names outside the house list.
    const closedCategories = nav.locator('.foldername-wrapper > svg[data-lucide="chevron-right"]:visible');
    while (await closedCategories.count()) {
      await closedCategories.first().click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(100);
    const result = await page.evaluate(() => {
      const nav = document.querySelector('.filetree-sidebar');
      const category = nav.querySelector('a[href="/house/"]');
      const work = nav.querySelector('a[href="/house/house_in_sawara/"]');
      const icon = [...category.parentElement.querySelectorAll('svg')].find(e => e.getBoundingClientRect().height);
      const cr = category.getBoundingClientRect(), ir = icon.getBoundingClientRect();
      const banner = nav.querySelector('.hyodo-sidebar-banner img').getBoundingClientRect();
      const style = e => ({ size: getComputedStyle(e).fontSize, weight: getComputedStyle(e).fontWeight, line: getComputedStyle(e).lineHeight });
      const names = [...nav.querySelectorAll('.filelist a.filename')].filter(e => e.getBoundingClientRect().height);
      return { width: innerWidth, menuWidth: nav.getBoundingClientRect().width, wrapped: names.filter(e => e.getBoundingClientRect().height > parseFloat(getComputedStyle(e).lineHeight) + 1).map(e => e.textContent.trim()), category: style(category), work: style(work), banner: { width: banner.width, height: banner.height }, iconOffset: (ir.top + ir.height / 2) - (cr.top + cr.height / 2), overflow: document.documentElement.scrollWidth > innerWidth + 1, longest: names.sort((a,b) => b.textContent.length - a.textContent.length)[0]?.textContent.trim() };
    });
    assert.equal(result.category.size, '18px');
    assert.equal(result.category.weight, '700');
    assert.equal(result.work.size, '16px');
    assert.equal(result.work.weight, '400');
    assert.equal(result.banner.width, 240);
    assert.equal(result.banner.height, 80);
    assert.deepEqual(await nav.locator('.hyodo-sidebar-links p').evaluateAll(elements => elements.map(e => getComputedStyle(e).fontSize)), ['16px', '16px']);
    assert.ok(!result.overflow);
    if (width >= 1000) {
      assert.equal(result.menuWidth, 320);
      assert.deepEqual(result.wrapped, [], JSON.stringify(result));
    }
    if (width < 1000) assert.ok(Math.abs(result.iconOffset) < 1, JSON.stringify(result));
    if ([390, 1024, 1440].includes(width)) await page.screenshot({ path: path.join(output, `sidebar-open-${width}.png`) });
    // A long label and the last expanded work must remain reachable by scrolling.
    const longest = nav.getByRole('link', { name: result.longest, exact: true });
    await longest.scrollIntoViewIfNeeded();
    await longest.evaluate(e => {
      const nav = e.closest('.filetree-sidebar');
      if (innerWidth < 1000) nav.scrollLeft = nav.scrollWidth;
    });
    if (width < 1000) {
      const end = await longest.evaluate(e => ({ right: e.getBoundingClientRect().right, edge: e.closest('.filetree-wrapper').getBoundingClientRect().right }));
      assert.ok(end.right <= end.edge + 1, JSON.stringify(end));
    }
    const last = nav.locator('.filelist a.filename:visible').last();
    await last.scrollIntoViewIfNeeded();
    assert.ok(await last.isVisible());
    await work.click();
    await page.waitForURL('**/house/house_in_sawara/');
    if (width < 1000) {
      await page.getByRole('button', { name: 'メニューを開く', exact: true }).click();
      await page.getByRole('button', { name: 'メニューを閉じる', exact: true }).click();
      await nav.waitFor({ state: 'hidden' });
    }
    results.push(result);
  }
  fs.writeFileSync(path.join(output, 'sidebar-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ sidebarConditions: results.length }));
};
