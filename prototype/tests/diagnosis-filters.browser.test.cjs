'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const base = process.env.IM_PREVIEW_URL
  ? new URL('prototype/main-screen.html', process.env.IM_PREVIEW_URL).href
  : pathToFileURL(path.resolve(__dirname, '../main-screen.html')).href;
const marketTitles = ['상권 요약', '시간대·요일별 진단', '방문·결제 진단', '주변상권 진단'];

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function geometry(page) {
  return page.evaluate(() => {
    const root = document.getElementById('viewRoot');
    const dock = root.querySelector('.v-diagnosis-filter-dock');
    const box = dock.getBoundingClientRect();
    const header = document.querySelector('.topbar').getBoundingClientRect();
    const pointed = document.elementFromPoint(box.x + box.width / 2, box.y + Math.min(25, box.height / 2));
    return {
      top: box.top, bottom: box.bottom, headerBottom: Math.max(0, header.bottom),
      viewportHeight: innerHeight, scroll: root.scrollTop + window.scrollY,
      reachable: !!pointed && (pointed === dock || dock.contains(pointed)),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      headings: Array.from(root.querySelectorAll('.v-screen-section'), section => {
        const title = section.querySelector('h2');
        return { text: title.textContent, top: title.getBoundingClientRect().top };
      })
    };
  });
}
function assertDock(info, label) {
  assert.ok(info.top >= info.headerBottom - 1, label + ': dock clears the app header');
  assert.ok(info.top < info.headerBottom + 100, label + ': dock remains near the top');
  assert.ok(info.bottom <= info.viewportHeight + 1, label + ': dock stays in the viewport');
  assert.ok(info.reachable, label + ': dock controls are not covered');
  assert.ok(!info.overflow, label + ': no horizontal page overflow');
}
async function preserveScroll(page, action, label) {
  const before = (await geometry(page)).scroll;
  await action();
  await settle(page);
  const after = await geometry(page);
  assert.ok(Math.abs(after.scroll - before) <= 1, label + ': filter update retains the scroll position (' + before + ' → ' + after.scroll + ')');
  assertDock(after, label);
}
async function pointerClick(page, locator) {
  // Use the visible sticky control's coordinates: locator.click() can scroll
  // its original document position into the scroll-padding area before clicking.
  const box = await locator.boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= page.viewportSize().height + 1, 'filter control is visible before pointer input');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errors = [];
  try {
    for (const reducedMotion of ['reduce', 'no-preference']) {
      const page = await browser.newPage({ reducedMotion });
      page.on('pageerror', error => errors.push(error.message));
      for (const [width, height] of [[1440, 900], [1440, 700], [390, 844]]) {
        await page.setViewportSize({ width, height });
        for (const view of ['analysis', 'market']) {
          const label = `${view} ${width}x${height} ${reducedMotion}`;
          const prefix = view === 'analysis' ? 'sd' : 'ma';
          await page.goto(base + '?filter-test=' + width + '-' + height + '-' + view + '-' + reducedMotion + '#' + view);
          await page.evaluate(() => document.fonts.ready);
          await settle(page);
          assert.equal(await page.locator('#viewRoot > .v-diagnosis-filter-shell > .v-diagnosis-filter-dock').count(), 1, label + ': one shared dock spans every section');
          const sections = page.locator('#viewRoot > .v-screen-section');
          assert.equal(await sections.count(), 4, label + ': section structure is retained');
          if (view === 'market') assert.deepEqual((await geometry(page)).headings.map(row => row.text), marketTitles);
          for (let index = 0; index < 4; index++) {
            await sections.nth(index).evaluate(section => section.scrollIntoView({ block: 'start', behavior: 'instant' }));
            await settle(page);
            const info = await geometry(page);
            assertDock(info, label + ' section ' + index);
            assert.ok(info.headings[index].top >= info.bottom - 1, label + ': the section title clears the dock');
          }

          const toggle = page.locator(`[data-${prefix}-toggle]`);
          assert.equal(await toggle.isVisible(), true, label + ': collapse control is available at every size');
          assert.equal(await toggle.getAttribute('aria-expanded'), width > 1260 ? 'true' : 'false', label + ': desktop starts expanded and narrow layouts start collapsed');
          if (await toggle.getAttribute('aria-expanded') === 'false') {
            await pointerClick(page, toggle);
            await settle(page);
            assert.equal(await toggle.getAttribute('aria-expanded'), 'true', label + ': filters expand');
            assertDock(await geometry(page), label + ' expanded');
          }
          await sections.nth(1).evaluate(section => section.scrollIntoView({ block: 'start', behavior: 'instant' }));
          await settle(page);
          let info = await geometry(page);
          assert.ok(info.headings[1].top >= info.bottom - 1, label + ': expanded filters also leave the section title visible');
          const weekday = day => page.locator(`[data-${prefix}-day="${day}"]`);
          const multi = page.locator(view === 'analysis' ? '[data-sd-multi]' : '[data-ma-multiple]');
          await preserveScroll(page, () => pointerClick(page, weekday(1)), label);
          assert.equal(await weekday(1).getAttribute('aria-pressed'), 'true');
          assert.equal(await weekday('all').getAttribute('aria-pressed'), 'false');
          await preserveScroll(page, () => pointerClick(page, multi), label);
          await preserveScroll(page, () => pointerClick(page, weekday(3)), label);
          for (const day of [1, 3]) assert.equal(await weekday(day).getAttribute('aria-pressed'), 'true', label + ': multiple days stay selected');
          await preserveScroll(page, () => pointerClick(page, multi), label);
          assert.equal(await page.locator(`[data-${prefix}-day][aria-pressed="true"]`).count(), 1, label + ': single mode keeps one day');
          await preserveScroll(page, () => pointerClick(page, page.locator(`[data-${prefix}-reset]`)), label);
          assert.equal(await weekday('all').getAttribute('aria-pressed'), 'true', label + ': reset selects all days');
          assert.equal(await multi.isChecked(), false, label + ': reset disables multiple selection');
          assert.equal(await weekday(1).evaluate(button => button.getBoundingClientRect().height), 44, label + ': both docks share the same control height');
          await pointerClick(page, weekday(3));
          await settle(page);
          const expandedHeight = (await page.locator('.v-diagnosis-filter-dock').boundingBox()).height;
          await preserveScroll(page, () => pointerClick(page, toggle), label + ' collapse');
          assert.equal(await toggle.getAttribute('aria-expanded'), 'false', label + ': filters collapse again');
          assert.equal(await weekday(3).isVisible(), false, label + ': collapsed controls are hidden');
          assert.equal(await toggle.evaluate(button => document.activeElement === button), true, label + ': focus stays on the toggle after redraw');
          assert.match(await page.locator('.v-diagnosis-filter-summary').textContent(), /수/, label + ': collapsed summary retains the selected weekday');
          assert.ok((await page.locator('.v-diagnosis-filter-dock').boundingBox()).height < expandedHeight, label + ': collapsing frees vertical space');
          assertDock(await geometry(page), label + ' collapsed');
          await preserveScroll(page, () => page.keyboard.press('Enter'), label + ' keyboard expand');
          assert.equal(await toggle.getAttribute('aria-expanded'), 'true', label + ': Enter expands the focused toggle');
          assert.equal(await weekday(3).getAttribute('aria-pressed'), 'true', label + ': expansion keeps the filter selection');
          await preserveScroll(page, () => page.keyboard.press('Space'), label + ' keyboard collapse');
          assert.equal(await toggle.getAttribute('aria-expanded'), 'false', label + ': Space collapses the focused toggle');

          await sections.first().evaluate(section => section.scrollIntoView({ block: 'start', behavior: 'instant' }));
          await settle(page);
          const beforeWheel = (await geometry(page)).scroll;
          await page.mouse.move(width - 50, height - 90);
          await page.mouse.wheel(0, 1400);
          await page.waitForTimeout(850);
          info = await geometry(page);
          assert.ok(info.scroll > beforeWheel + 100, label + ': real wheel input advances the page');
          assertDock(info, label + ' wheel scroll');
        }
      }
      await page.close();
    }
    assert.deepEqual(errors, [], 'no browser runtime errors');
    console.log('PASS diagnosis filters: shared sticky docks across 4 sections, desktop/mobile collapse with selected summaries, keyboard and focus, weekday/multiple/reset, scroll restoration and both motion preferences');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
