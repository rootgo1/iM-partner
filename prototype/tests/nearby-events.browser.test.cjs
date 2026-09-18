'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const data = require('../data/daegu-festivals.json');
const base = process.env.IM_PREVIEW_URL || 'http://127.0.0.1:8896/';
const output = process.env.IM_QA_DIR || path.resolve(__dirname, '../../tmp/festival-qa');
const exact = event => event.locationAccuracy === 'venue';
const byName = name => data.events.find(event => event.name === name);
async function openMarket(page, scenario) {
  await page.goto(new URL('prototype/main-screen.html?festival-test=' + scenario + '#market', base).href, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-ne-event]').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function selectValue(page, selector, value) {
  await page.locator(selector).selectOption(value);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
}
async function ids(page) { return page.locator('[data-ne-event]').evaluateAll(nodes => nodes.map(node => node.dataset.neEvent)); }
async function assertCount(page, expected, label) {
  assert.equal(await page.locator('[data-ne-event]').count(), expected, label);
  assert.equal(await page.locator('[data-ne-count]').textContent(), expected + '개 행사', label + ': count agrees with the list');
}
async function assertPairedCards(page, label) {
  const boxes = await page.locator('.v-neighborhood-layout > .v-card').evaluateAll(cards => cards.map(card => {
    const { x, y, width, height } = card.getBoundingClientRect(); return { x, y, width, height };
  }));
  assert.equal(boxes.length, 2, label + ': chart and map are one pair');
  for (const property of ['y', 'width', 'height']) assert.ok(Math.abs(boxes[0][property] - boxes[1][property]) <= 1, label + ': matching ' + property);
}
function recordRequests(page, forbidden, sdkRequests, dataRequests) {
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/nearby-events') || url.hostname === 'apis.data.go.kr' || /visitkorea|knto\.or\.kr/.test(url.hostname)) forbidden.push(request.url());
    if (url.hostname === 'dapi.kakao.com') sdkRequests.push(request.url());
    if (url.pathname.endsWith('/data/daegu-festivals.json')) dataRequests.push(request.url());
  });
}
// Local adapter contract double. No real Kakao credential or tile service is used.
const mockedKakaoSdk = `
window.__kakaoQA = { maps: [], overlays: [], loads: 0, layouts: 0 };
window.kakao = { maps: {
  load(callback) { window.__kakaoQA.loads++; callback(); },
  LatLng: class { constructor(lat, lng) { this.lat = lat; this.lng = lng; } },
  Map: class { constructor(node, options) { this.node = node; this.options = options; window.__kakaoQA.maps.push(this); } panTo(point) { this.lastCenter = point; } addControl(control, position) { this.control = position; } relayout() { window.__kakaoQA.layouts++; } },
  CustomOverlay: class { constructor(options) { this.options = options; window.__kakaoQA.overlays.push(this); this.setMap(options.map); } setMap(map) { this.map = map; if (map) map.node.append(this.options.content); else this.options.content.remove(); } },
  ZoomControl: class {}, ControlPosition: { RIGHT: 'RIGHT' }
} };`;
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  const errors = [], forbidden = [], sdkRequests = [], dataRequests = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', timezoneId: 'Asia/Seoul' });
    await page.clock.setFixedTime(new Date('2026-09-18T10:16:00Z'));
    page.on('pageerror', error => errors.push(error.message));
    recordRequests(page, forbidden, sdkRequests, dataRequests);
    await openMarket(page, 'actual-csv');
    assert.equal(data.events.length, 46, 'the supplied CSV contains 46 deduplicated Daegu events');
    assert.equal(dataRequests.length, 1, 'one local JSON request loads the extracted CSV');
    assert.equal(await page.locator('[data-ne-period]').inputValue(), 'future');
    assert.equal(await page.locator('[data-ne-radius]').inputValue(), '5');
    await assertCount(page, 2, 'default future/5km');
    assert.deepEqual(await ids(page), [byName('제6회 떡볶이 페스티벌').id, byName('2026 금호강 바람소리길 축제').id], 'nearby records appear in distance order');
    assert.match(await page.locator('[data-ne-source]').innerText(), /전국문화축제표준데이터 · 대구 46건/);
    assert.match(await page.locator('.ne-location').innerText(), /예시 위치 기준/);
    assert.equal(await page.locator('[data-nearby-events] input[type="file"]').count(), 0);
    const iframe = page.locator('iframe[data-ne-map]');
    assert.equal(await iframe.count(), 1, 'an empty key uses the base map');
    assert.equal(new URL(await iframe.getAttribute('src')).hostname, 'www.openstreetmap.org');
    const selectedEvent = byName('2026 금호강 바람소리길 축제');
    const before = await iframe.getAttribute('src');
    await page.locator('[data-ne-event="' + selectedEvent.id + '"]').click();
    const selectedSource = await iframe.getAttribute('src');
    assert.notEqual(selectedSource, before, 'selecting a different venue moves the map');
    assert.equal(new URL(selectedSource).searchParams.get('marker'), selectedEvent.lat + ',' + selectedEvent.lng);
    const kakaoLink = decodeURIComponent(await page.locator('[data-ne-map-link]').getAttribute('href'));
    assert.ok(kakaoLink.startsWith('https://map.kakao.com/link/map/'));
    assert.ok(kakaoLink.endsWith(',' + selectedEvent.lat + ',' + selectedEvent.lng));
    assert.equal(await page.locator('[data-ne-event="' + selectedEvent.id + '"]').getAttribute('aria-pressed'), 'true');
    const detail = page.locator('.ne-detail');
    assert.equal(await detail.evaluate(node => node.open), false);
    await detail.locator('summary').click();
    assert.equal(await detail.evaluate(node => node.open), true);
    assert.match(await detail.innerText(), /자료 기준일/);
    assert.ok((await detail.innerText()).includes(selectedEvent.address));
    await detail.locator('summary').click();
    assert.equal(await detail.evaluate(node => node.open), false, 'long details collapse independently');
    for (const [radius, expected] of [['3', 1], ['5', 2], ['10', 5], ['all', 16]]) {
      await selectValue(page, '[data-ne-radius]', radius);
      await assertCount(page, expected, 'future/' + radius);
      const rows = await ids(page);
      assert.ok(rows.every(id => data.events.find(event => event.id === id).endDate >= '2026-09-18'), 'future excludes ended records');
      if (radius !== 'all') assert.ok(rows.every(id => exact(data.events.find(event => event.id === id))), 'distance filters exclude uncertain coordinates');
    }
    assert.equal(await page.locator('.ne-status-tag.ongoing').count(), 2);
    assert.equal(await page.locator('.ne-status-tag.upcoming').count(), 14);
    const uncertain = byName('2026 수성못페스티벌');
    assert.equal(uncertain.lat, null);
    const uncertainButton = page.locator('[data-ne-event="' + uncertain.id + '"]');
    assert.match(await uncertainButton.innerText(), /위치 확인 필요/);
    await uncertainButton.click();
    assert.equal(new URL(await iframe.getAttribute('src')).searchParams.get('marker'), '35.8714,128.6014', 'administrative coordinates are not plotted as the event venue');
    assert.ok(decodeURIComponent(await page.locator('[data-ne-map-link]').getAttribute('href')).includes('/link/search/대구 ' + uncertain.venue));
    assert.match(await page.locator('[data-ne-map-link]').innerText(), /장소 찾기/);
    await selectValue(page, '[data-ne-radius]', '10');
    assert.equal(await uncertainButton.count(), 0, 'uncertain venue appears only in Daegu-wide mode');
    await selectValue(page, '[data-ne-period]', 'all');
    for (const [radius, expected] of [['3', 2], ['5', 8], ['10', 18], ['all', 46]]) {
      await selectValue(page, '[data-ne-radius]', radius);
      await assertCount(page, expected, 'all records/' + radius);
    }
    assert.equal(await page.locator('.ne-status-tag.ended').count(), 30);
    await selectValue(page, '[data-ne-period]', 'future');
    await selectValue(page, '[data-ne-radius]', '5');
    await page.evaluate(() => { window.__originalNearbyMap = document.querySelector('[data-ne-map]'); });
    const beforeClockSource = await iframe.getAttribute('src');
    assert.match(await page.locator('.ma-observation-time').innerText(), /19:00~19:10/);
    await page.clock.setFixedTime(new Date('2026-09-18T10:26:00Z'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    assert.equal(await page.locator('[data-ma-clock]').innerText(), '19:26');
    assert.match(await page.locator('.ma-observation-time').innerText(), /19:10~19:20/);
    assert.ok(await page.evaluate(() => window.__originalNearbyMap === document.querySelector('[data-ne-map]')));
    assert.equal(await iframe.getAttribute('src'), beforeClockSource);
    assert.equal(dataRequests.length, 1, 'clock refresh reuses local event data');
    for (const width of [1440, 1366]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('.v-neighborhood-layout').scrollIntoViewIfNeeded();
      await assertPairedCards(page, width + 'px desktop');
      await page.screenshot({ path: path.join(output, 'festival-desktop-' + width + '.png') });
    }
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('[data-nearby-events]').scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal page overflow at ' + width);
      assert.ok(await page.locator('[data-nearby-events]').evaluate(card => card.scrollWidth <= card.clientWidth + 1), 'no event card overflow at ' + width);
      await page.screenshot({ path: path.join(output, 'festival-mobile-' + width + '.png') });
    }
    assert.deepEqual(sdkRequests, [], 'an empty key never requests the Kakao SDK');
    await page.close();
    const kakaoPage = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', timezoneId: 'Asia/Seoul' });
    await kakaoPage.clock.setFixedTime(new Date('2026-09-18T10:16:00Z'));
    await kakaoPage.addInitScript(() => { window.IM_MAP_CONFIG = { kakaoJavaScriptKey: 'qa-mock-only' }; });
    const mockedRequests = [];
    await kakaoPage.route('https://dapi.kakao.com/v2/maps/sdk.js?**', route => { mockedRequests.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'application/javascript', body: mockedKakaoSdk }); });
    kakaoPage.on('pageerror', error => errors.push(error.message));
    recordRequests(kakaoPage, forbidden, [], []);
    await openMarket(kakaoPage, 'mock-kakao-adapter');
    await kakaoPage.locator('.ne-kakao-pin').first().waitFor();
    assert.equal(mockedRequests.length, 1, 'configured adapter loads the mocked SDK once');
    assert.equal(new URL(mockedRequests[0]).searchParams.get('appkey'), 'qa-mock-only');
    assert.equal(await kakaoPage.locator('iframe[data-ne-map]').count(), 0);
    assert.equal(await kakaoPage.locator('.ne-store-pin').count(), 1);
    assert.equal(await kakaoPage.locator('.ne-kakao-pin').count(), 2);
    assert.equal(await kakaoPage.locator('[data-ne-attribution]').innerText(), '지도 · Kakao');
    await kakaoPage.locator('.ne-kakao-pin').nth(1).click();
    assert.equal(await kakaoPage.locator('[data-ne-event="' + selectedEvent.id + '"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await kakaoPage.evaluate(() => ({ lat: window.__kakaoQA.maps[0].lastCenter.lat, lng: window.__kakaoQA.maps[0].lastCenter.lng })), { lat: selectedEvent.lat, lng: selectedEvent.lng });
    assert.equal(await kakaoPage.locator('.ne-kakao-pin.is-selected').count(), 1);
    await selectValue(kakaoPage, '[data-ne-radius]', 'all');
    assert.equal(await kakaoPage.locator('.ne-kakao-pin').count(), data.events.filter(event => exact(event) && event.endDate >= '2026-09-18').length, 'uncertain venues never get a marker');
    assert.ok(await kakaoPage.evaluate(() => window.__kakaoQA.layouts > 0));
    await kakaoPage.close();
    assert.deepEqual(forbidden, [], 'no tourism or event API is requested');
    assert.deepEqual(errors, [], 'no browser runtime errors');
    console.log('PASS nearby events browser: real Daegu CSV, date/radius filters, selection/map links, uncertain venues, collapsible details, clock DOM retention, equal desktop cards and mobile overflow. Kakao adapter contract passed with a routed SDK double; real Kakao credentials, authorization and map tiles were not tested.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
