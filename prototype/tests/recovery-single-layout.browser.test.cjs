'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const base = process.env.IM_PREVIEW_URL ? new URL('prototype/main-screen.html', process.env.IM_PREVIEW_URL).href : pathToFileURL(path.resolve(__dirname, '../main-screen.html')).href;
const output = process.env.IM_QA_DIR || path.resolve(__dirname, '../../tmp/recovery-single-qa');
const viewports = [[1440,900],[1366,768],[1280,720],[1440,700],[768,900],[390,844],[360,800],[360,640]];

async function fixedCanvas(page, label) {
  const metrics = await page.evaluate(() => {
    const root = document.querySelector('#viewRoot');
    const card = document.querySelector('.v-recovery-panel:not([hidden]) > article');
    const rect = card.getBoundingClientRect();
    return {
      docWidth:document.documentElement.scrollWidth, docHeight:document.documentElement.scrollHeight,
      width:innerWidth, height:innerHeight, pageY:scrollY,
      rootWidth:root.clientWidth, rootScrollWidth:root.scrollWidth,
      rootHeight:root.clientHeight, rootScrollHeight:root.scrollHeight, rootY:root.scrollTop,
      cardHeight:rect.height, cardBottom:rect.bottom, cardTop:rect.top,
      cardScrollHeight:card.scrollHeight, cardClientHeight:card.clientHeight
    };
  });
  assert.ok(metrics.docWidth <= metrics.width + 1, label + ': no page horizontal overflow ' + JSON.stringify(metrics));
  assert.ok(metrics.docHeight <= metrics.height + 1, label + ': no page vertical overflow ' + JSON.stringify(metrics));
  assert.ok(metrics.rootScrollWidth <= metrics.rootWidth + 1, label + ': no content horizontal overflow');
  assert.ok(metrics.rootScrollHeight <= metrics.rootHeight + 1, label + ': no content vertical overflow ' + JSON.stringify(metrics));
  assert.ok(metrics.cardBottom <= metrics.height + 1, label + ': card stays inside viewport');
  assert.ok(metrics.cardTop >= 0 && metrics.cardHeight > 150, label + ': useful card height');
  assert.ok(metrics.cardScrollHeight <= metrics.cardClientHeight + 1, label + ': outer card does not clip/scroll content ' + JSON.stringify(metrics));
  assert.equal(metrics.rootY, 0, label + ': root remains at top');
  assert.equal(metrics.pageY, 0, label + ': page remains at top');
  assert.equal(await page.locator('.v-recovery-panel:not([hidden]) > article').count(), 1, label + ': one content card');
  return metrics;
}

async function visibleInCanvas(page, selector, label) {
  const target = page.locator(selector);
  assert.ok(await target.isVisible(), label + ': visible');
  const rect = await target.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(rect.y >= -1 && rect.x >= -1 && rect.y + rect.height <= viewport.height + 1 && rect.x + rect.width <= viewport.width + 1, label + ': inside viewport ' + JSON.stringify(rect));
}

(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const page = await browser.newPage({reducedMotion:'reduce'});
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({time:new Date('2026-09-18T19:20:00+09:00')});
    for (const [width,height] of viewports) {
      await page.setViewportSize({width,height});
      await page.goto(base + '#recovery');
      await page.evaluate(() => { localStorage.removeItem(window.IM_AFTERCARE.KEY); });
      await page.reload(); await page.evaluate(() => document.fonts.ready);
      const prefix = width + 'x' + height;
      const initial = await fixedCanvas(page, prefix + '/strategy');
      assert.equal(await page.locator('[data-recovery-source], .v-recovery-period, .v-recovery-timing').count(), 0);
      await visibleInCanvas(page, '#reportInput', prefix + '/input');
      await visibleInCanvas(page, '#reportForm button[type="submit"]', prefix + '/submit');
      await page.locator('#recoveryTab-aftercare').click();
      const empty = await fixedCanvas(page, prefix + '/empty-aftercare');
      assert.ok(Math.abs(initial.cardHeight - empty.cardHeight) <= 1, prefix + ': tab content keeps equal height');
      await page.screenshot({path:path.join(output, prefix + '-aftercare-empty.png')});
      await page.locator('#recoveryTab-strategy').click();
      // Long conversations must scroll inside the log, while compose and PDF actions stay reachable.
      for (let i = 0; i < 4; i++) {
        await page.locator('#reportInput').fill('매출과 지출, 저녁 시간 운영 준비를 함께 분석해 주세요. ' + '추가 점검이 필요한 메뉴와 재고를 알려 주세요. '.repeat(8));
        await page.locator('#reportForm button[type="submit"]').click();
      }
      await fixedCanvas(page, prefix + '/long-chat');
      await visibleInCanvas(page, '#reportInput', prefix + '/long-chat-input');
      await visibleInCanvas(page, '#makePdfButton', prefix + '/PDF-action');
      assert.ok(await page.locator('#reportMessages').evaluate(node => node.scrollHeight > node.clientHeight), prefix + ': long chat has inner scrolling');
      assert.equal(await page.locator('#reportMessages').evaluate(node => getComputedStyle(node).scrollbarWidth), 'none', prefix + ': inner scrollbar is hidden');
      await page.locator('[data-action="record-execution"]').scrollIntoViewIfNeeded();
      await visibleInCanvas(page, '[data-action="record-execution"]', prefix + '/record-action');
      await fixedCanvas(page, prefix + '/scrolled-chat');
      await page.screenshot({path:path.join(output, prefix + '-strategy-ready.png')});
      await page.locator('[data-action="record-execution"]').click();
      assert.equal(await page.locator('#executionModal').evaluate(node => node.open), true, prefix + ': execution form opens');
      await page.locator('#executionForm button[type="submit"]').scrollIntoViewIfNeeded();
      await visibleInCanvas(page, '#executionForm button[type="submit"]', prefix + '/execution-save');
      await page.keyboard.press('Escape');
      await fixedCanvas(page, prefix + '/execution-closed');
      // A valid maximum-size record should keep the summary compact and all detail accessible.
      await page.evaluate(() => window.IM_AFTERCARE.save({
        id:'long-record', date:'2026-09-03', startHour:17, endHour:23,
        actions:Array.from({length:10}, (_,index) => ({id:'long-action-' + index, title:('점검 행동 ' + index + ' ').repeat(25).slice(0,160), evidence:'근거 확인 '.repeat(35), caveat:'전후 차이는 행동의 효과를 입증하지 않습니다.'})),
        note:'상세메모 '.repeat(100).slice(0,500)
      }));
      await page.locator('#recoveryTab-aftercare').click();
      const populated = await fixedCanvas(page, prefix + '/populated-aftercare');
      assert.ok(Math.abs(initial.cardHeight - populated.cardHeight) <= 1, prefix + ': populated aftercare keeps matched height');
      assert.ok(await page.locator('.v-aftercare-monthly-body').evaluate(node => node.scrollHeight <= node.clientHeight + 1), prefix + ': monthly comparison fits without inner scrolling');
      const metricLines = await page.locator('.v-month-row-head b').evaluateAll(nodes => nodes.map(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        return new Set(Array.from(range.getClientRects(), rect => Math.round(rect.y))).size;
      }));
      assert.deepEqual(metricLines, [1,1], prefix + ': monthly totals stay on one line');
      await visibleInCanvas(page, '[data-aftercare-detail]', prefix + '/record-details-button');
      await page.screenshot({path:path.join(output, prefix + '-aftercare-populated.png')});
      await page.locator('[data-aftercare-detail]').click();
      assert.equal(await page.locator('#aftercareRecordDialog').evaluate(node => node.open), true);
      assert.match(await page.locator('#aftercareRecordDialog').innerText(), /상세메모/);
      assert.equal(await page.locator('#aftercareRecordDialog .v-aftercare-detail-note').first().locator('p').textContent(), '상세메모 '.repeat(100).slice(0,500), prefix + ': full 500-character note is accessible');
      const dialogRect = await page.locator('#aftercareRecordDialog').boundingBox();
      assert.ok(dialogRect.x >= -1 && dialogRect.y >= -1 && dialogRect.x + dialogRect.width <= width + 1 && dialogRect.y + dialogRect.height <= height + 1, prefix + ': detail dialog fits viewport');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#aftercareRecordDialog').evaluate(node => node.open), false);
      await fixedCanvas(page, prefix + '/details-closed');
    }
    assert.deepEqual(errors, []);
    console.log('PASS recovery single-card layout: 8 viewports, fixed matching cards, empty/populated aftercare, long chat, persistent action access, hidden inner scrollbar and full long-record details');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
