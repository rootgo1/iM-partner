'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  assert.ok(process.env.IM_PREVIEW_URL, 'IM_PREVIEW_URL에 승인된 localhost 미리보기 주소를 지정해 주세요.');
  const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const output = path.resolve(__dirname, '../../tmp/market-analysis-qa'); fs.mkdirSync(output, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const url = new URL('prototype/main-screen.html', process.env.IM_PREVIEW_URL).href;
    await page.goto(url + '#recovery');
    await page.evaluate(() => document.fonts.ready);
    assert.ok(page.url().endsWith('#market'));
    assert.equal(await page.locator('.ma-panel').count(), 4);
    assert.deepEqual(await page.locator('.ma-heading .ma-kicker').allTextContents(), ['01 / 상권분석', '02 / 상권분석', '03 / 상권분석', '04 / 상권분석']);
    assert.equal(await page.locator('#ma-observation, #ma-camera, #ma-comparison, #ma-dayType, [data-ma-chart="dwell"]').count(), 0);
    assert.equal(await page.locator('.ma-fixed-camera strong').innerText(), '매장 전면');
    assert.deepEqual(await page.locator('[data-ma-day]').allTextContents(), ['월', '화', '수', '목', '금', '토', '일']);
    assert.equal(await page.locator('[data-ma-detail="slot"]').count(), 36);
    const expected = await page.evaluate(() => {
      const result = IM_MARKET_DATA.analyze(IM_MEETING_DEMO.periods.month, { camera: 'front', days: [], comparison: 'weekday' });
      return { average: result.current.averagePerTenMinutes, count: result.current.count, hours: result.observedHours, slot: result.bySlot[0] };
    });
    assert.match(await page.locator('.ma-metric').first().innerText(), /10분당 통행 관측/);
    assert.match(await page.locator('.ma-metric').first().innerText(), new RegExp(expected.average.toLocaleString('ko-KR', { maximumFractionDigits: 1 }).replace('.', '\\.')));
    assert.match(await page.locator('.ma-quality-strip').innerText(), new RegExp(expected.hours.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '시간'));
    assert.ok(expected.count > 0 && Math.abs(expected.hours - expected.count / 6) < 1e-9);
    await page.screenshot({ path: path.join(output, 'market-overview-desktop.png') });
    await page.locator('#ma-day-1').click();
    await page.locator('#ma-day-3').click();
    assert.equal(await page.locator('#ma-day-1').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#ma-day-3').getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('.ma-scope').first().innerText(), /월·수/);
    const restrictedCount = await page.evaluate(() => IM_MARKET_DATA.analyze(IM_MEETING_DEMO.periods.month, { camera: 'front', days: [1, 3], comparison: 'weekday' }).current.count);
    assert.match(await page.locator('.ma-quality-strip').innerText(), new RegExp('분석 가능 ' + restrictedCount));
    await page.locator('[data-ma-reset]').click();
    await page.locator('[data-ma-jump="1"]').first().click();
    await page.selectOption('#ma-chartHour', '18');
    assert.equal(await page.locator('[data-ma-detail="slot"]').count(), 6);
    assert.match(await page.locator('[data-ma-detail="slot"]').first().innerText(), /18:00/);
    await page.locator('[data-ma-chart="entry"]').click();
    assert.equal(await page.locator('[data-ma-chart="entry"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-ma-detail="slot"]').first().click();
    await page.locator('#ma-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#ma-dialog-title').innerText(), /18:00~18:10/);
    assert.equal(await page.locator('#ma-dialog tbody tr').count(), 8);
    await page.locator('[data-ma-page="1"]').click();
    assert.match(await page.locator('.ma-pagination').innerText(), /2\//);
    await page.locator('[data-ma-close]').click();
    await page.selectOption('#ma-chartHour', 'all');
    assert.equal(await page.locator('[data-ma-detail="slot"]').count(), 36);
    const scroll = await page.locator('.ma-ten-minute-scroll').evaluate(el => ({ scroll: el.scrollHeight, visible: el.clientHeight }));
    assert.ok(scroll.scroll > scroll.visible);
    await page.screenshot({ path: path.join(output, 'market-ten-minute-desktop.png') });
    await page.locator('[data-ma-evidence]').first().click();
    await page.locator('#ma-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#ma-dialog-title').innerText(), /\d{2}:\d{2}~/);
    await page.keyboard.press('Escape');
    for (const [width, height] of [[1366, 768], [390, 844], [360, 800]]) {
      await page.setViewportSize({ width, height }); await page.goto(url + '?market-qa=' + width + '#market');
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'horizontal overflow at ' + width);
      const panels = page.locator('.ma-panel');
      for (let i = 0; i < 4; i++) {
        await panels.nth(i).evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
        const overflow = await panels.nth(i).evaluate(el => el.scrollWidth - el.clientWidth);
        assert.ok(overflow <= 2, width + ' panel ' + i + ' content overflow: ' + overflow);
        if (i === 1 || i === 0) await page.screenshot({ path: path.join(output, 'market-panel-' + i + '-' + width + '.png') });
      }
      assert.ok(!/NaN|Infinity|undefined/.test(await page.locator('#viewRoot').innerText()));
    }
    assert.deepEqual(errors, []);
    console.log('PASS market UI: four panels, fixed camera/comparison, multiple weekdays, ten-minute figures/36 slots, hour filtering, numeric drilldown and responsive layout');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
