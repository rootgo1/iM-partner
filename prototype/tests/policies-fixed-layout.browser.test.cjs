'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const data = require('../policy-data.js');
const matching = require('../policy-matching.js');
const profile = require('../meeting-data.js').profile;
const selected = matching.recommendations(data.items, profile, data.checkedAt);
const base = process.env.IM_PREVIEW_URL || 'http://127.0.0.1:8897/';
const url = new URL('prototype/main-screen.html?policy-fixed-qa#policies', base).href;
const out = process.env.IM_QA_DIR || path.resolve(__dirname, '../../tmp/policies-fixed-qa');
const sizes = [[1440, 900], [1366, 768], [1280, 720], [1100, 720], [390, 844], [360, 640]];
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function assertFixed(page, label) {
  const problems = await page.evaluate(() => {
    const issues = [];
    const containers = [document.documentElement, document.body, document.querySelector('#viewRoot'), document.querySelector('#viewRoot .v-screen-section'), document.querySelector('.v-policy-workspace')];
    for (const node of containers) {
      if (!node) continue;
      const name = node.id || node.className || node.tagName;
      if (node.scrollHeight > node.clientHeight + 1) issues.push(name + ': vertical content overflow ' + node.scrollHeight + '/' + node.clientHeight);
      if (node.scrollWidth > node.clientWidth + 1) issues.push(name + ': horizontal content overflow ' + node.scrollWidth + '/' + node.clientWidth);
      if (node.scrollTop > 1) issues.push(name + ': external scrollTop=' + node.scrollTop);
    }
    const rectWithin = (r, b) => r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
    const controls = document.querySelectorAll('.v-policy-controls button, .v-policy-controls input, .v-policy-controls select, .v-policy-actions button, .v-policy-actions a, .v-policy-arrow, .v-policy-pagination button, .v-policy-footer button');
    for (const node of controls) {
      const rect = node.getBoundingClientRect();
      const name = node.id || node.dataset.action || node.textContent.trim().slice(0, 20);
      if (!rect.width || !rect.height) { issues.push(name + ': hidden main control'); continue; }
      if (!rectWithin(rect, { left: 0, right: innerWidth, top: 0, bottom: innerHeight })) issues.push(name + ': outside viewport');
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const css = getComputedStyle(parent);
        if (/(hidden|clip|auto|scroll)/.test(css.overflowY) && !rectWithin(rect, parent.getBoundingClientRect())) { issues.push(name + ': clipped by ' + (parent.id || parent.className)); break; }
      }
      const point = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (point && !node.contains(point) && point !== node) issues.push(name + ': covered by ' + (point.id || point.className));
    }
    for (const card of document.querySelectorAll('[data-policy-card]')) {
      const actions = card.querySelector('.v-policy-actions').getBoundingClientRect();
      const previous = card.querySelector('.v-policy-actions').previousElementSibling;
      if (previous && getComputedStyle(previous).display !== 'none' && previous.getBoundingClientRect().bottom > actions.top + 1) issues.push(card.dataset.policyCard + ': content overlaps actions');
      if (card.scrollHeight > card.clientHeight + 1) issues.push(card.dataset.policyCard + ': card content overflow');
      const blocks = [...card.children].filter(node => getComputedStyle(node).display !== 'none');
      for (let i = 1; i < blocks.length; i++) {
        const previousBottom = Math.max(blocks[i - 1].getBoundingClientRect().bottom, ...[...blocks[i - 1].querySelectorAll('h3,p,dt,dd')].filter(node => node.getClientRects().length && getComputedStyle(node).display !== 'none').map(node => node.getBoundingClientRect().bottom));
        if (previousBottom > blocks[i].getBoundingClientRect().top + 1) issues.push(card.dataset.policyCard + ': ' + blocks[i - 1].className + ' overlaps ' + blocks[i].className);
      }
    }
    return issues;
  });
  assert.deepEqual(problems, [], label);
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    for (const [width, height] of sizes) {
      const label = width + 'x' + height;
      await page.setViewportSize({ width, height });
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      await settle(page);
      const pageSize = width > 1050 ? 3 : 1;
      assert.equal(await page.locator('[data-policy-card]').count(), pageSize, label + ': responsive recommendation count');
      await assertFixed(page, label + ' recommendations');
      await page.screenshot({ path: path.join(out, 'recommended-' + label + '.png') });
      const seen = [];
      for (let offset = 0; offset < selected.length; offset += pageSize) {
        seen.push(...await page.locator('[data-policy-card]').evaluateAll(nodes => nodes.map(node => node.dataset.policyCard)));
        await assertFixed(page, label + ' cards at ' + offset);
        if (offset + pageSize < selected.length) await page.locator('[data-action="policy-next"]').click();
      }
      assert.deepEqual(seen, selected.map(item => item.id), label + ': all recommendations reachable');
      await page.locator('[data-policy-page="0"]').click();
      await page.locator('[data-policy-card] [data-policy]').first().click();
      assert.ok(await page.locator('#policyModal').evaluate(dialog => dialog.open), label + ': full details remain accessible');
      await page.keyboard.press('Escape');
      await page.locator('[data-action="open-policy-basis"]').click();
      assert.ok(await page.locator('#policyModal').evaluate(dialog => dialog.open), label + ': criteria accessible without expanding page');
      await page.keyboard.press('Escape');
      await assertFixed(page, label + ' after dialog');
      await page.locator('[data-policy-view="all"]').click();
      await settle(page);
      const list = page.locator('#policyNoticeList');
      assert.equal(await list.getAttribute('role'), 'region');
      assert.equal(await list.getAttribute('tabindex'), '0');
      assert.equal(await page.locator('[data-policy-row]').count(), data.items.length);
      const scroll = await list.evaluate(node => ({ height: node.clientHeight, scrollHeight: node.scrollHeight, overflow: getComputedStyle(node).overflowY }));
      assert.ok(scroll.height >= 120 && scroll.scrollHeight > scroll.height, label + ': useful internal list viewport');
      assert.match(scroll.overflow, /auto|scroll/, label + ': list scroll enabled');
      await assertFixed(page, label + ' all notices');
      await page.screenshot({ path: path.join(out, 'all-' + label + '.png') });
      const bounds = await list.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.wheel(0, 500);
      await page.waitForFunction(() => document.querySelector('#policyNoticeList').scrollTop > 0);
      await assertFixed(page, label + ' list wheel only');
      await list.focus();
      await page.keyboard.press('End');
      await page.waitForFunction(() => { const node = document.querySelector('#policyNoticeList'); return node.scrollHeight - node.clientHeight - node.scrollTop < 2; });
      const lastVisible = await list.evaluate(node => {
        const viewport = node.getBoundingClientRect();
        const actions = node.lastElementChild.querySelector('.v-policy-list-actions').getBoundingClientRect();
        return actions.top >= viewport.top - 1 && actions.bottom <= viewport.bottom + 1;
      });
      assert.ok(lastVisible, label + ': last notice actions reachable with keyboard');
      await assertFixed(page, label + ' list keyboard only');
      await page.screenshot({ path: path.join(out, 'all-last-' + label + '.png') });
      await page.keyboard.press('Home');
      await page.waitForFunction(() => document.querySelector('#policyNoticeList').scrollTop < 2);
      await page.locator('#policySearch').fill(data.items[data.items.length - 1].title);
      assert.equal(await page.locator('[data-policy-row]').count(), 1, label + ': searches whole corpus');
      await assertFixed(page, label + ' filtered list');
      await page.locator('#policySearch').fill('');
      await page.locator('#policyCategory').selectOption(selected[0].category);
      assert.equal(await page.locator('[data-policy-row]').count(), data.items.filter(item => item.category === selected[0].category).length);
      await page.locator('#policyCategory').selectOption('all');
      await page.locator('#policySearch').fill('일치하는 공고가 없는 검색어');
      assert.equal(await page.locator('[data-policy-row]').count(), 0);
      await assertFixed(page, label + ' empty list');
      await page.locator('#policySearch').fill('');
      await page.locator('[data-policy-view="recommended"]').click();
      await assertFixed(page, label + ' recommendation return');
      await page.locator('#mainNavigation [data-view="analysis"]').evaluate(node => node.click());
      assert.equal(await page.locator('html.policies-fixed-layout, .app-shell.policies-fixed-view').count(), 0, label + ': fixed styles removed outside policies');
      assert.ok(await page.evaluate(() => [document.scrollingElement, document.querySelector('#viewRoot')].some(node => node.scrollHeight > node.clientHeight + 1)), label + ': analysis scrolling restored');
    }
    assert.deepEqual(errors, []);
    console.log('PASS fixed policy workspace: six viewports, unclipped recommendation actions, every carousel item, internally scrolling full list by wheel/keyboard, filters, dialogs and restored diagnosis scrolling');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
