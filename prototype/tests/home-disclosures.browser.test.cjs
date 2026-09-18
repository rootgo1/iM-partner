'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = process.env.IM_PREVIEW_URL || 'http://127.0.0.1:8897/';
const out = path.resolve(__dirname, '../../tmp/monthly-policy-qa');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', timezoneId: 'Asia/Seoul' });
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-09-18T09:10:00+09:00'));
    await page.goto(new URL('prototype/main-screen.html#dashboard', base).href);
    await page.locator('[data-banner-index="1"]').click();
    assert.equal(await page.locator('#bannerText').innerText(), '매장 앞 통행과 입장을 살펴보고,\n주변상권 흐름과 상권 분석 결과를 확인해 보세요.');
    assert.ok((await page.locator('#viewRoot').innerText()).includes('상권분석 · 매장 앞 상권흐름'));
    assert.equal(await page.locator('.v-home-guidance-note').innerText(), '현재 시간에 맞춘 기본 운영 안내입니다.');
    await page.locator('#mainNavigation [data-view="analysis"]').click();
    await page.evaluate(() => document.fonts.ready);
    const definitions = page.locator('#sd-panel-summary details').first();
    const summary = definitions.locator('summary');
    await summary.click();
    assert.equal(await definitions.evaluate(node => node.open), true);
    assert.ok(await definitions.locator('.v-definition-list').isVisible());
    assert.ok(await definitions.locator('.v-definition-list > div').count() >= 3);
    const style = await summary.evaluate(node => { const s = getComputedStyle(node); return { font: s.fontSize, padding: s.padding, minHeight: s.minHeight }; });
    assert.deepEqual(style, { font: '13px', padding: '12px 16px', minHeight: '46px' });
    await page.screenshot({ path: path.join(out, 'monthly-summary-desktop.png') });
    await summary.click();
    assert.equal(await definitions.evaluate(node => node.open), false);
    const kinds = [];
    for (const view of ['analysis', 'market']) {
      await page.locator('#mainNavigation [data-view="' + view + '"]').click();
      if (view === 'market') await page.locator('.ne-detail summary').waitFor();
      const disclosures = page.locator('#viewRoot details');
      for (let index = 0; index < await disclosures.count(); index++) {
        const item = disclosures.nth(index);
        const first = item.locator('summary');
        const actual = await first.evaluate(node => { const s = getComputedStyle(node); return { font: s.fontSize, padding: s.padding, minHeight: s.minHeight }; });
        assert.deepEqual(actual, style, view + ': every disclosure follows the same header style');
        await item.evaluate(node => { node.open = true; });
        assert.ok(await item.evaluate(node => node.scrollWidth <= node.clientWidth + 1), view + ': content stays inside the disclosure');
        await item.evaluate(node => { node.open = false; });
        kinds.push(view);
      }
    }
    assert.ok(kinds.includes('analysis') && kinds.includes('market'));
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('#mainNavigation [data-view="analysis"]').evaluate(node => node.click());
      const panel = page.locator('#sd-panel-summary details').first();
      await panel.evaluate(node => { node.open = true; });
      assert.ok(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, 'monthly-definitions-' + width + '.png') });
    }
    assert.deepEqual(errors, []);
    console.log('PASS home copy and shared disclosures: requested text, concise definition rows, consistent headers, native open/close and responsive content');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
