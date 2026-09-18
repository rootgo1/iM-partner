'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const D = require('../meeting-data.js');
const A = require('../sales-diagnosis-data.js');
(async () => {
  const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const NativeDate = Date, now = NativeDate.parse('2026-09-18T10:05:00Z');
      window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
    });
    const base = process.env.IM_PREVIEW_URL ? new URL('prototype/main-screen.html', process.env.IM_PREVIEW_URL).href : pathToFileURL(path.resolve(__dirname, '../main-screen.html')).href;
    await page.goto(base + '#analysis');
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('#viewRoot > .v-screen-section').count(), 4);
    assert.deepEqual(await page.locator('.sd-section-heading h2').allTextContents(), ['매출 요약', '일별 매출 진단', '요일별 진단', '품목별 진단', '지출 진단']);
    assert.equal(await page.locator('#sd-panel-daily-weekly').evaluate(el => el.querySelector('#sd-panel-movement').closest('.v-screen-section') === el.querySelector('#sd-panel-timing').closest('.v-screen-section')), true, 'daily and weekday diagnosis share one screen section');
    assert.deepEqual(await page.locator('#sd-hour option').evaluateAll(rows => rows.map(row => row.value)), ['all', ...Array.from({ length: 12 }, (_, index) => String(index + 12))]);
    assert.match(await page.locator('#sd-hour option[value="12"]').innerText(), /12시~13시/);
    assert.match(await page.locator('#sd-hour option[value="23"]').innerText(), /23시~24시/);
    assert.equal(await page.locator('.sd-kicker,.sd-heatmap,.sd-effects,#sectionPeriodSelect').count(), 0);
    assert.match(await page.locator('.sd-period-line').innerText(), /2026-08-01 ~ 2026-08-31/);
    assert.equal(await page.locator('#sd-panel-movement article').count(), 1);
    assert.equal(await page.locator('#sd-panel-timing article').count(), 1);
    assert.equal(await page.locator('.sd-trend').getAttribute('viewBox'), '0 0 560 344');
    assert.match(await page.locator('.sd-metrics').innerText(), /순이익/);
    const expected = A.analyze(D, D.periods.month, { hour: 'all', comparison: 'weekday' });
    const initialSummary = await page.locator('.sd-metrics').innerText();
    assert.deepEqual(await page.locator('.sd-metrics .metric-value').allTextContents(), [expected.current.sales, expected.current.average, expected.finance.delta, expected.current.customerAverage].map(value => Math.round(value).toLocaleString('ko-KR') + '원'));
    assert.equal(await page.locator('#sd-hour option[value="all"]').innerText(), '전체');
    assert.match(await page.locator('.v-diagnosis-filter-summary span').innerText(), /전체 품목 \/ 19시~20시 \/ 모든 요일/);
    assert.equal(await page.locator('.sd-period-line').evaluate(el => el.parentElement.classList.contains('sd-monthly-context')), true);
    assert.match(await page.locator('.sd-metrics').innerText(), new RegExp(expected.current.sales.toLocaleString('ko-KR')));
    const originalCosts = await page.locator('#sd-panel-expenses').innerText();
    for (const row of expected.expenseBreakdown.purchases) {
      const difference = row.previous == null ? null : row.amount - row.previous;
      if (!difference) continue;
      const change = page.locator('[data-sd-purchase="' + row.id + '"] td:last-child span');
      assert.match(await change.innerText(), difference > 0 ? /▲ .* 증가/ : /▼ .* 감소/);
      assert.equal(await change.evaluate(el => getComputedStyle(el).color), difference > 0 ? 'rgb(178, 56, 56)' : 'rgb(24, 118, 83)', 'purchase change uses the same rise/fall colors as sales');
    }
    if (!(await page.locator('#sd-category').isVisible())) await page.locator('[data-sd-toggle]').click();
    await page.selectOption('#sd-category', 'food');
    await page.selectOption('#sd-subcategory', 'grill');
    await page.locator('[data-sd-day="1"]').click();
    await page.locator('[data-sd-day="5"]').click();
    assert.deepEqual(await page.locator('[data-sd-day][aria-pressed="true"]').evaluateAll(rows => rows.map(row => row.dataset.sdDay)), ['5']);
    await page.locator('[data-sd-multi]').check();
    await page.locator('[data-sd-day="1"]').click();
    const filtered = A.analyze(D, D.periods.month, { category: 'food', subcategory: 'grill', hour: '19', days: [1,5], comparison: 'weekday' });
    assert.equal(await page.locator('.sd-metrics').innerText(), initialSummary, 'monthly summary remains stable while detailed sales filters change');
    assert.match(await page.locator('#sd-panel-movement .sd-scope').innerText(), /구이류.*19시~20시.*월·금/);
    assert.equal(await page.locator('#sd-panel-expenses').innerText(), originalCosts, 'POS filters must not alter whole-store expense analysis');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-sd-export]').click()]);
    const csv = fs.readFileSync(await download.path(), 'utf8');
    assert.ok(csv.startsWith('\uFEFF'));
    const csvRows = csv.trimEnd().split('\r\n').slice(1).map(line => line.slice(1,-1).split('","'));
    assert.equal(csvRows.length, filtered.rows.length);
    assert.equal(csvRows.reduce((sum,row) => sum + Number(row[15]), 0), filtered.current.sales);
    assert.ok(csvRows.every(row => /^19:[0-5]0$/.test(row[10])));
    const item = filtered.products[0].id;
    await page.locator('[data-sd-expand="'+item+'"]').click();
    await page.locator('#sd-insight-'+item+' [data-sd-detail]').click();
    assert.equal(await page.locator('#sd-dialog').evaluate(el => el.open), true);
    assert.match(await page.locator('#sd-dialog-title').innerText(), /판매 근거/);
    await page.locator('[data-sd-close]').click();
    await page.locator('[data-sd-weekday="5"]').click();
    await page.locator('.sd-weekday-detail summary').click();
    assert.match(await page.locator('.sd-weekday-detail').innerText(), /금요일 일평균 매출/);
    for (const [width,height] of [[1440,900],[1366,768],[390,844]]) {
      await page.setViewportSize({width,height});
      await page.reload();
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), width + ' document width');
      for (let index = 0; index < 4; index++) {
        const section = page.locator('#viewRoot > .v-screen-section').nth(index);
        await section.evaluate(el => el.scrollIntoView({behavior:'instant',block:'start'}));
        const geometry = await section.evaluate(el => { const inner = el.querySelector('.v-screen-inner'); return { x: inner.scrollWidth - inner.clientWidth, y: inner.scrollHeight - inner.clientHeight, overflow: getComputedStyle(inner).overflowY }; });
        assert.ok(geometry.x <= 2, width + '/'+index+' content width');
        assert.ok(geometry.y <= 2 || ['auto','scroll'].includes(geometry.overflow), width + '/'+index+' accessible height');
      }
      if (process.env.IM_SALES_SCREENSHOTS) {
        await page.locator('#sd-panel-summary').evaluate(el=>el.scrollIntoView({behavior:'instant',block:'start'}));
        fs.mkdirSync(process.env.IM_SALES_SCREENSHOTS,{recursive:true});
        await page.screenshot({path:path.join(process.env.IM_SALES_SCREENSHOTS,'sales-summary-'+width+'.png')});
        await page.locator('#sd-panel-expenses').evaluate(el=>el.scrollIntoView({behavior:'instant',block:'start'}));
        fs.mkdirSync(process.env.IM_SALES_SCREENSHOTS,{recursive:true});
        await page.screenshot({path:path.join(process.env.IM_SALES_SCREENSHOTS,'sales-expenses-'+width+'.png')});
        await page.locator('#sd-panel-movement').evaluate(el=>el.scrollIntoView({behavior:'instant',block:'start'}));
        await page.screenshot({path:path.join(process.env.IM_SALES_SCREENSHOTS,'sales-trend-'+width+'.png')});
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS sales browser: four sections with combined daily/weekday diagnosis, hourly filters, matched purchase change colors, filtered CSV, evidence modal, whole-store costs, and three viewports');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
