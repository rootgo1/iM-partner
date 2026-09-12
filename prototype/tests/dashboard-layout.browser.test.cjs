'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const output = path.resolve(__dirname, '../../tmp/dashboard-layout-qa');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-09-12T15:06:00+09:00') });
    for (const [width, height] of [[1920,1080], [1536,864], [1440,900], [1280,720], [1024,768], [390,844], [320,844]]) {
      await page.setViewportSize({ width, height });
      await page.goto(pathToFileURL(path.resolve(__dirname, '../main-screen.html')).href);
      await page.evaluate(() => document.fonts.ready);
      assert.match(await page.locator('.v-finance-thermo-change').innerText(), /^▼ 8\.7° 낮음$/);
      assert.equal(await page.locator('.v-finance-thermo-updated').count(), 0);
      assert.ok(!(await page.locator('.v-market-metric').first().innerText()).includes('생성 자료'));
      assert.ok(await page.locator('.v-market-metric .v-index-arrow').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize) < parseFloat(getComputedStyle(node.parentElement).fontSize) * .6));
      assert.ok(!(await page.locator('.v-guidance-time').innerText()).includes('생성 POS'));
      assert.match(await page.locator('.v-guidance-result h3').innerText(), /\.$/);
      assert.equal(await page.locator('.v-dashboard-context h2').innerText(), '주변 상권 흐름');
      const inner = await page.locator('.v-screen-inner').evaluateAll(nodes => nodes.map(node => ({
        overflow: getComputedStyle(node).overflowY, extra: node.scrollHeight - node.clientHeight
      })));
      assert.ok(inner.every(row => row.overflow === 'visible' && row.extra <= 2), 'no inner scroll or clipping at ' + width + ': ' + JSON.stringify(inner));
      for (let section = 0; section < 3; section++) {
        await page.locator('.v-screen-section').nth(section).scrollIntoViewIfNeeded();
        if (width >= 1280) await page.locator('.v-screen-section').nth(section).screenshot({ path: path.join(output, width + '-section-' + section + '.png') });
      }
      const insight = page.locator('.v-dashboard-insight');
      assert.match(await insight.innerText(), /시간대 일평균 매출/);
      assert.ok(!(await insight.innerText()).includes('만만'));
      assert.ok(await insight.locator('.v-dashboard-insight-values strong').evaluateAll(nodes => nodes.every(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        return range.getBoundingClientRect().width <= node.clientWidth + 1;
      })), 'diagnosis amounts fit at ' + width);
      assert.equal(await insight.locator('.v-dashboard-insight-point').evaluate(node => getComputedStyle(node).overflowY), 'visible');
      await insight.screenshot({ path: path.join(output, width + '-insight.png') });
      const chart = page.locator('.v-comparison-chart');
      await chart.locator('button[data-series="sales"]').click();
      await chart.locator('button[data-series="traffic"]').click();
      for (const mode of ['weekday', 'hour']) {
        await chart.locator('[data-chart-mode="' + mode + '"]').click();
        assert.equal(await chart.locator('[data-chart-line][aria-pressed="true"]').count(), 2);
        assert.equal(await chart.locator('[data-chart-line="sales"]').getAttribute('aria-pressed'), 'true');
        assert.equal(await chart.locator('[data-chart-line="traffic"]').getAttribute('aria-pressed'), 'true');
      }
      await chart.locator('[data-chart-line="card"]').focus();
      await page.keyboard.press('Enter');
      assert.equal(await chart.locator('[data-chart-line][aria-pressed="true"]').count(), 3);
      await chart.locator('button[data-series="traffic"]').click();
      assert.equal(await chart.locator('[data-chart-line][aria-pressed="true"]').count(), 2);
      assert.equal(await chart.locator('[data-chart-line="sales"]').getAttribute('aria-pressed'), 'true');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (width >= 761) {
        await page.evaluate(() => { document.querySelector('#viewRoot').scrollTop = 0; window.IM_SMOOTH_SCROLL.mount(document.querySelector('#viewRoot')); });
        await page.locator('#dashboardBanner').hover();
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(700);
        assert.ok(await page.locator('#viewRoot').evaluate(node => node.scrollTop) > 100, 'wheel over banner at ' + width);
        await chart.scrollIntoViewIfNeeded();
        const before = await page.locator('#viewRoot').evaluate(node => node.scrollTop);
        await chart.locator('.v-chart').hover();
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(700);
        assert.ok(await page.locator('#viewRoot').evaluate(node => node.scrollTop) > before + 100, 'wheel over chart at ' + width);
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS 7 viewports: no inner scrolling/clipping, concise labels, daily averages, multi-select persists, keyboard and outer wheel');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
