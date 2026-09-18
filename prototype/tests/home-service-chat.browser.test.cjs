'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const url = process.env.IM_PREVIEW_URL ? new URL('prototype/main-screen.html', process.env.IM_PREVIEW_URL).href : pathToFileURL(path.resolve(__dirname, '../main-screen.html')).href;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:')) external.push(request.url()); });
    await page.clock.install({ time: new Date('2026-09-18T17:10:00+09:00') });
    await page.goto(url + '#dashboard');
    await page.evaluate(() => document.fonts.ready);
    const navLabels = await page.locator('#mainNavigation .nav-label').allTextContents();
    const bannerLabels = await page.locator('[data-banner-index]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label').replace(' 소개 배너', '')));
    assert.deepEqual(bannerLabels, navLabels.slice(1), 'every destination menu has exactly one banner');
    assert.equal(await page.locator('#bannerCount').innerText(), '1 / 4');
    await page.locator('[data-banner-index="3"]').click();
    assert.match(await page.locator('#bannerText').innerText(), /사후관리/);
    await page.locator('#bannerAction').click();
    assert.equal(new URL(page.url()).hash, '#recovery');
    await page.locator('#mainNavigation [data-view="dashboard"]').click();
    assert.doesNotMatch(await page.locator('.v-home-action-list').innerText(), /\d{2}:\d{2} 현재/);
    assert.equal(await page.locator('.v-home-guidance [data-view="secretary"]').count(), 0);
    assert.match(await page.locator('.v-home-action-list').innerText(), /첫 손님과 주문/);
    const atOpening = await page.locator('.v-home-action-list').innerText();
    await page.clock.setSystemTime(new Date('2026-09-18T19:10:00+09:00'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    assert.doesNotMatch(await page.locator('.v-home-action-list').innerText(), /\d{2}:\d{2} 현재/);
    assert.notEqual(await page.locator('.v-home-action-list').innerText(), atOpening, 'home actions follow the viewed KST hour');
    await page.clock.setSystemTime(new Date('2026-09-18T23:10:00+09:00'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    assert.match(await page.locator('.v-home-action-list').innerText(), /마감 결제|다음 영업/);
    assert.equal(await page.locator('.v-home-guide-facts').count(), 0, 'off-hours guidance cannot invent current sales');
    await page.clock.setSystemTime(new Date('2026-09-19T09:10:00+09:00'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    assert.match(await page.locator('.v-home-action-list').innerText(), /영업 전|첫 주문/);

    await page.locator('#aiToggle').click();
    assert.equal(await page.locator('.ai-suggestion').count(), 3);
    assert.deepEqual(await page.locator('.ai-suggestion').allTextContents(), ['매출진단에서는 무엇을 볼 수 있나요?', '상권분석은 무엇인가요?', '회복전략은 어떤 기능인가요?']);
    // FAQ must remain functional without reading the business-analysis engines.
    await page.evaluate(() => {
      window._faqOriginalAnalysis = [IM_MARKET_DATA.analyze, IM_SALES_DATA.analyze];
      IM_MARKET_DATA.analyze = IM_SALES_DATA.analyze = () => { throw new Error('Service FAQ must not analyze store data'); };
    });
    for (const [question, expected] of [
      ['회복전략은 어떤 기능인가요?', /매출진단과 상권분석 결과|사후관리/],
      ['우리 매출이 왜 떨어졌나요?', /서비스 이용 방법|매출진단·상권분석/],
      ['사후관리는 어디서 보나요?', /회복전략 메뉴의 사후관리 탭/]
    ]) {
      await page.locator('#aiInput').fill(question);
      await page.locator('#aiInput').press('Enter');
      const reply = await page.locator('#aiMessages .bot').last().innerText();
      assert.match(reply, expected);
      assert.ok(reply.length < 220, 'service help is concise');
      assert.ok(!/[\d,]+원|매출 [+-]?[\d.]+%/.test(reply), 'service help does not analyze store results');
    }
    await page.evaluate(() => { [IM_MARKET_DATA.analyze, IM_SALES_DATA.analyze] = window._faqOriginalAnalysis; delete window._faqOriginalAnalysis; });
    await page.locator('#aiClose').click();

    for (const view of ['analysis', 'market']) {
      await page.locator('#mainNavigation [data-view="' + view + '"]').click();
      assert.equal(await page.locator('#viewRoot #sectionPeriodSelect, #viewRoot #sectionCustomPeriod').count(), 0, view + ': no period selection');
      assert.match(await page.locator('#viewRoot').innerText(), /2026-08-01/);
      assert.match(await page.locator('#viewRoot').innerText(), /2026-08-31/);
      assert.ok(!(await page.locator('#viewRoot').innerText()).includes('2026-06-27~2026-07-27'));
    }
    await page.locator('#mainNavigation [data-view="secretary"]').click();
    assert.equal(await page.locator('.v-recovery-panel:not([hidden]) > article').count(), 1);
    assert.equal(await page.locator('#sectionPeriodSelect, .v-recovery-scope, [data-recovery-source]').count(), 0, 'strategy contains only the conversation');
    assert.match(await page.locator('.v-report-scope').innerText(), /생성 자료 기준/);
    await page.locator('#mainNavigation [data-view="analysis"]').click();
    await page.clock.setSystemTime(new Date('2026-10-01T09:10:00+09:00'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    assert.match(await page.locator('.sd-period-line').innerText(), /2026-09-01 ~ 2026-09-30/, 'open diagnosis moves to the last completed calendar month');
    await page.clock.setSystemTime(new Date('2026-11-01T09:10:00+09:00'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    assert.match(await page.locator('.sd-period-line').innerText(), /2026-10-01 ~ 2026-10-31/);
    assert.equal(await page.locator('[data-recovery-record]').count(), 0, 'the removed diagnosis action cards do not return on month changes');
    assert.ok(external.every(url => new URL(url).hostname.endsWith('openstreetmap.org')), 'only the requested public map may load externally');
    assert.deepEqual(errors, []);
    console.log('PASS home/service: four matching banners, KST contextual actions, three concise FAQ examples, no analysis/API dependency, monthly diagnosis windows, independent report period and month rollover');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
