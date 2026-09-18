'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const base = process.env.IM_PREVIEW_URL
  ? new URL('prototype/main-screen.html', process.env.IM_PREVIEW_URL).href
  : pathToFileURL(path.resolve(__dirname, '../main-screen.html')).href;
const output = process.env.IM_QA_DIR || path.resolve(__dirname, '../../tmp/monthly-revision-qa');
const disclosure = '시연용 생성 데이터 기반 · iM파트너 서비스 프로토타입 화면입니다.';

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function cardScopes(page, prefix) {
  const rows = await page.locator('#viewRoot .' + prefix + '-scope').evaluateAll(nodes => nodes.map(node => {
    const card = node.closest('article');
    const before = node.previousElementSibling;
    return {
      text: node.textContent.trim(), inCard: !!card,
      last: card && card.lastElementChild === node,
      followsContent: !before || node.getBoundingClientRect().top >= before.getBoundingClientRect().bottom - 1
    };
  }));
  assert.ok(rows.length >= 4, prefix + ': analysis cards expose their own scope');
  rows.forEach((row, index) => {
    assert.ok(row.inCard && row.last && row.followsContent, prefix + ' scope is at card bottom ' + index + ': ' + JSON.stringify(row));
    assert.match(row.text, /^기간: .+ \/ .+/, prefix + ': consistent period and slash separators');
  });
}

async function fixedAftercare(page, label) {
  const metrics = await page.evaluate(() => {
    const root = document.getElementById('viewRoot');
    const card = document.querySelector('.v-aftercare');
    const rect = card.getBoundingClientRect();
    const visible = node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
    const overflowing = [card, ...card.querySelectorAll('*')].filter(node => visible(node) &&
      ['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1)
      .map(node => node.className.baseVal || node.className || node.tagName);
    for (const node of card.querySelectorAll('.v-month-chart, .v-month-bars, .v-month-row')) {
      const children = [...node.children];
      for (let i = 1; i < children.length; i++) {
        if (children[i-1].getBoundingClientRect().bottom > children[i].getBoundingClientRect().top + 1) overflowing.push(node.className + ': overlapping chart labels');
      }
      if (children.some(child => child.getBoundingClientRect().bottom > node.getBoundingClientRect().bottom + 1 || child.getBoundingClientRect().top < node.getBoundingClientRect().top - 1)) overflowing.push(node.className + ': clipped chart labels');
    }
    return {
      pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight,
      width: innerWidth, height: innerHeight, pageY: scrollY, rootY: root.scrollTop,
      rootWidth: root.clientWidth, rootScrollWidth: root.scrollWidth,
      rootHeight: root.clientHeight, rootScrollHeight: root.scrollHeight,
      cardTop: rect.top, cardBottom: rect.bottom, cardHeight: rect.height,
      cardClientHeight: card.clientHeight, cardScrollHeight: card.scrollHeight,
      overflowing
    };
  });
  assert.ok(metrics.pageWidth <= metrics.width + 1 && metrics.pageHeight <= metrics.height + 1, label + ': page fits viewport ' + JSON.stringify(metrics));
  assert.ok(metrics.rootScrollWidth <= metrics.rootWidth + 1 && metrics.rootScrollHeight <= metrics.rootHeight + 1, label + ': content has no outer overflow ' + JSON.stringify(metrics));
  assert.ok(metrics.cardTop >= -1 && metrics.cardBottom <= metrics.height + 1 && metrics.cardHeight > 150, label + ': single card fits viewport');
  assert.ok(metrics.cardScrollHeight <= metrics.cardClientHeight + 1, label + ': card does not clip content ' + JSON.stringify(metrics));
  assert.deepEqual(metrics.overflowing, [], label + ': no inner scrolling');
  assert.equal(metrics.pageY + metrics.rootY, 0, label + ': page and content stay at top');
  assert.equal(await page.locator('.v-recovery-panel:not([hidden]) > article').count(), 1, label + ': one content card');
  return metrics;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-09-18T19:20:00+09:00'));

    for (const view of ['dashboard', 'analysis', 'market', 'policies', 'recovery', 'recovery/aftercare', 'profile']) {
      await page.goto(base + '#' + view); await settle(page);
      assert.equal(await page.locator('#viewRoot .v-footer').count(), 1, view + ': one global disclosure');
      assert.equal((await page.locator('#viewRoot .v-footer').innerText()).trim(), disclosure, view + ': exact shared disclosure');
    }

    await page.goto(base + '#analysis'); await settle(page);
    await cardScopes(page, 'sd');
    const monthlySummary = await page.locator('.sd-metrics').innerText();
    const salesBefore = await page.locator('.sd-product-table').innerText();
    await page.locator('#sd-hour').selectOption('all');
    await page.locator('[data-sd-day="1"]').click(); await settle(page);
    assert.equal(await page.locator('.sd-metrics').innerText(), monthlySummary, 'whole-month KPIs and scope stay fixed when detail filters change');
    assert.notEqual(await page.locator('.sd-product-table').innerText(), salesBefore, 'detail data follows filters');
    assert.match(await page.locator('.sd-product-table').locator('xpath=ancestor::article').locator('.sd-scope').innerText(), /전체 시간 \/ 월$/);
    await cardScopes(page, 'sd');
    await page.locator('[data-sd-expand]').first().click();
    await page.locator('[data-sd-detail="item"]').first().click();
    await page.locator('#sd-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#sd-dialog .sd-scope').innerText(), /^기간: .* \/ 전체 시간 \/ 월$/);
    assert.ok(await page.locator('#sd-dialog tbody tr').count() > 0, 'filtered sale records remain accessible');
    await page.keyboard.press('Escape');

    await page.goto(base + '#market'); await settle(page);
    await cardScopes(page, 'ma');
    const currentObservation = await page.locator('.ma-live-metrics').innerText();
    const monthlyBefore = await page.locator('.ma-trend-charts').innerText();
    await page.locator('[data-ma-day="1"]').click(); await settle(page);
    assert.equal(await page.locator('.ma-live-metrics').innerText(), currentObservation, 'current ten-minute observations do not inherit monthly weekday filters');
    assert.notEqual(await page.locator('.ma-trend-charts').innerText(), monthlyBefore, 'monthly market details reflect selected weekdays');
    await cardScopes(page, 'ma');
    assert.match(await page.locator('.ma-trend-charts .ma-scope').first().innerText(), / \/ 월$/);
    await page.locator('[data-ma-detail="hour"]').first().click();
    await page.locator('#ma-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#ma-dialog .ma-scope').innerText(), /^기간: .* \/ 월$/);
    await page.keyboard.press('Escape');
    await page.locator('[data-ma-detail="live"]').click();
    await page.locator('#ma-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#ma-dialog').innerText(), /2026-09-18/);
    assert.equal(await page.locator('#ma-dialog tbody tr').count(), 1, 'live evidence remains one ten-minute record');
    await page.keyboard.press('Escape');

    for (const [width, height] of [[1920, 1080], [1366, 768], [1280, 720], [390, 844], [360, 640]]) {
      await page.setViewportSize({ width, height });
      await page.goto(base + '#recovery/aftercare');
      await page.evaluate(() => localStorage.removeItem(window.IM_AFTERCARE.KEY));
      await page.reload(); await settle(page);
      const label = width + 'x' + height;
      await fixedAftercare(page, label);
      assert.match(await page.locator('.v-aftercare').innerText(), /2026[.년/-]?\s*8|8월/, label + ': previous calendar month is shown');
      assert.match(await page.locator('.v-aftercare').innerText(), /2026[.년/-]?\s*7|7월/, label + ': month before previous is shown');
      assert.equal(await page.locator('.v-month-chart .v-month-bar').count(), 2, label + ': both month totals appear in the graph without execution records');
      assert.match(await page.locator('.v-month-row.is-previous').innerText(), /42,538,000원/, label + ': full July sales');
      assert.match(await page.locator('.v-month-row.is-current').innerText(), /43,085,000원/, label + ': full August sales');
      assert.match(await page.locator('.v-month-change').innerText(), /1\.3%[\s\S]*547,000원/, label + ': month-to-month change');
      const bars = await page.locator('.v-month-bar').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
      assert.ok(Math.abs(bars[1] / bars[0] - 43085000 / 42538000) < 0.002, label + ': bars use the same zero baseline and scale');
      if ([1920, 1366, 360].includes(width)) await page.screenshot({ path: path.join(output, 'aftercare-' + label + '.png') });
    }

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(base + '#recovery'); await settle(page);
    await page.locator('#reportInput').fill('매출과 지출, 저녁 시간 운영 준비를 함께 분석해 주세요.');
    await page.locator('#reportForm button[type="submit"]').click();
    await page.locator('[data-action="record-execution"]').click();
    assert.equal(await page.locator('#executionModal').evaluate(node => node.open), true, 'execution form still opens after analysis');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.IM_AFTERCARE.save({
      id: 'monthly-revision-check', date: '2026-09-03', startHour: 17, endHour: 23,
      actions: [{ id: 'check-menu', title: '저녁 메뉴 안내 확인', evidence: '메뉴별 시연 판매 기록 확인' }], note: '월간 비교 수정 후 기록 상세 검증'
    }));
    await page.locator('#recoveryTab-aftercare').click(); await settle(page);
    await fixedAftercare(page, 'with-execution-record');
    await page.locator('[data-aftercare-detail]').click();
    assert.equal(await page.locator('#aftercareRecordDialog').evaluate(node => node.open), true, 'saved execution details still open');
    assert.match(await page.locator('#aftercareRecordDialog').innerText(), /월간 비교 수정 후 기록 상세 검증/);
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, [], 'no browser JavaScript errors');
    console.log('PASS monthly revision: shared disclosure across seven routes, bottom card scopes and filtered evidence, fixed monthly summary, five no-scroll aftercare layouts, graphs without records, and execution modal preservation');
    console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
