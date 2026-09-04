'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
(async () => {
  let browser;
  try {
  const output = path.resolve(__dirname, '../../tmp/preview-qa');
  fs.mkdirSync(output, { recursive: true });
  const errors = [];
  const browserCandidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ];
  const executablePath = browserCandidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executablePath, 'An installed Chrome or Edge browser is required');
  browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const url = pathToFileURL(path.resolve(__dirname, '../main-screen.html')).href;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#viewRoot .metric-card');
  const fontState = await page.evaluate(async () => {
    await document.fonts.ready;
    const regular = await document.fonts.load('400 24px "iM Noto Sans KR"', '가게의 오늘');
    const medium = await document.fonts.load('500 24px "iM Noto Sans KR"', '회복 플랜');
    const bold = await document.fonts.load('700 24px "iM Noto Sans KR"', '회복 플랜');
    return {
      regularLoaded: regular.length > 0,
      mediumLoaded: medium.length > 0,
      boldLoaded: bold.length > 0,
      headingFamily: getComputedStyle(document.querySelector('#pageTitle')).fontFamily,
      brandFamily: getComputedStyle(document.querySelector('.topbar-brand')).fontFamily
    };
  });
  assert.equal(fontState.regularLoaded, true, 'Noto Sans KR Regular font must load');
  assert.equal(fontState.mediumLoaded, true, 'Noto Sans KR Medium font must load');
  assert.equal(fontState.boldLoaded, true, 'Noto Sans KR Bold font must load');
  assert.match(fontState.headingFamily, /iM Noto Sans KR/);
  assert.match(fontState.brandFamily, /iM Noto Sans KR/);
  const brandSymbols = await page.locator('img[src="./assets/brand/im-bank-symbol.png"]').evaluateAll(images => images.map(image => ({ complete: image.complete, width: image.naturalWidth, height: image.naturalHeight })));
  assert.equal(brandSymbols.length, 2);
  assert.ok(brandSymbols.every(image => image.complete && image.width === 512 && image.height === 263));
  const brandTypography = await page.evaluate(() => {
    const brand = document.querySelector('.topbar-brand');
    const name = document.querySelector('.topbar-brand-name');
    const latin = name.firstElementChild.getBoundingClientRect();
    const korean = name.lastElementChild.getBoundingClientRect();
    return {
      weight: getComputedStyle(brand).fontWeight,
      spacing: getComputedStyle(name).letterSpacing,
      scriptGap: korean.left - latin.right
    };
  });
  assert.equal(brandTypography.weight, '700');
  assert.ok(brandTypography.scriptGap > 0 && brandTypography.scriptGap < 4, 'iM and 파트너 need a small optical gap without a text space');
  const expandedBrand = await page.evaluate(() => {
    const logo = document.querySelector('.brand-mark').getBoundingClientRect();
    const toggle = document.querySelector('#sidebarToggle').getBoundingClientRect();
    const icon = document.querySelector('.toggle-icon').getBoundingClientRect();
    return {
      logoWidth: logo.width,
      logoHeight: logo.height,
      toggleWidth: toggle.width,
      toggleHeight: toggle.height,
      toggleRadius: getComputedStyle(document.querySelector('#sidebarToggle')).borderRadius,
      iconCenterDeltaX: Math.abs((icon.left + icon.width / 2) - (toggle.left + toggle.width / 2)),
      iconCenterDeltaY: Math.abs((icon.top + icon.height / 2) - (toggle.top + toggle.height / 2))
    };
  });
  assert.equal(expandedBrand.toggleRadius, '10px');
  assert.ok(expandedBrand.iconCenterDeltaX <= 1.5 && expandedBrand.iconCenterDeltaY <= 1.5, 'expanded chevron must be optically centered');
  await page.getByRole('button', { name: '파트너 메뉴 접기' }).click();
  await page.waitForFunction(() => Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width - 96) < 1);
  const collapsedBrand = await page.evaluate(() => {
    const logo = document.querySelector('.brand-mark').getBoundingClientRect();
    const toggleElement = document.querySelector('#sidebarToggle');
    const toggle = toggleElement.getBoundingClientRect();
    const icon = document.querySelector('.toggle-icon').getBoundingClientRect();
    const sidebar = document.querySelector('.sidebar').getBoundingClientRect();
    return {
      gap: toggle.left - logo.right,
      logoWidth: logo.width,
      logoHeight: logo.height,
      toggleWidth: toggle.width,
      toggleHeight: toggle.height,
      toggleRadius: getComputedStyle(toggleElement).borderRadius,
      iconCenterDeltaX: Math.abs((icon.left + icon.width / 2) - (toggle.left + toggle.width / 2)),
      iconCenterDeltaY: Math.abs((icon.top + icon.height / 2) - (toggle.top + toggle.height / 2)),
      toggleRight: toggle.right,
      sidebarRight: sidebar.right
    };
  });
  assert.ok(collapsedBrand.gap >= 7, 'collapsed logo and toggle need a visible gap');
  assert.ok(Math.abs(collapsedBrand.logoWidth - expandedBrand.logoWidth) < 0.1, 'logo width must stay consistent');
  assert.ok(Math.abs(collapsedBrand.logoHeight - expandedBrand.logoHeight) < 0.1, 'logo height must stay consistent');
  assert.ok(Math.abs(collapsedBrand.toggleWidth - expandedBrand.toggleWidth) < 0.1, 'toggle width must stay consistent');
  assert.ok(Math.abs(collapsedBrand.toggleHeight - expandedBrand.toggleHeight) < 0.1, 'toggle height must stay consistent');
  assert.equal(collapsedBrand.toggleRadius, expandedBrand.toggleRadius, 'toggle shape must stay consistent');
  assert.ok(collapsedBrand.iconCenterDeltaX <= 1.5 && collapsedBrand.iconCenterDeltaY <= 1.5, 'collapsed chevron must be optically centered');
  assert.ok(collapsedBrand.toggleRight <= collapsedBrand.sidebarRight + 1, 'collapsed toggle must stay inside sidebar');
  await page.locator('.sidebar').screenshot({ path: path.join(output, 'sidebar-collapsed-1920.png') });
  await page.getByRole('button', { name: '파트너 메뉴 펼치기' }).click();
  await page.waitForFunction(() => Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width - 238) < 1);
  assert.equal(await page.locator('.metric-card').count(), 4);
  const expenseMetric = page.locator('.metric-card').filter({ hasText: '총지출' });
  assert.match(await expenseMetric.innerText(), /▲ 7\.2% 증가/);
  assert.equal(await expenseMetric.locator('.trend-caution').count(), 1);
  assert.equal(await expenseMetric.locator('.trend-up').count(), 0);
  assert.match(await page.locator('#viewRoot').innerText(), /생성 데이터 기반 시연/);
  await page.screenshot({ path: path.join(output, 'dashboard-1920.png'), fullPage: false });

  await page.getByRole('button', { name: '매출·지출 분석', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#pageTitle')?.textContent.includes('매출과 남는 돈'));
  assert.match(await page.locator('#viewRoot').innerText(), /월세/);
  assert.match(await page.locator('#viewRoot').innerText(), /매입금액 TOP 3/);

  await page.getByRole('link', { name: 'iM파트너 메인 페이지로 이동' }).click();
  await page.waitForFunction(() => location.hash === '#dashboard');
  assert.match(await page.locator('#pageTitle').innerText(), /가게의 오늘/);
  assert.equal(await page.locator('.top-nav').count(), 0);

  await page.getByRole('button', { name: 'iM챗봇' }).click();
  const panel = page.locator('#aiPanel');
  await panel.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#aiPanel')?.getBoundingClientRect().width >= 320);
  const box = await panel.boundingBox();
  assert.ok(box && box.width >= 320);
  await page.locator('#aiInput').fill('현재 매출이 왜 떨어졌나요?');
  await page.locator('#aiForm').press('Enter');
  assert.match(await page.locator('#aiMessages').innerText(), /원인|요인 후보|확정 원인/);
  await page.screenshot({ path: path.join(output, 'finance-chat-1920.png'), fullPage: false });
  await page.locator('#aiClose').click();

  await page.getByRole('button', { name: 'AI 비서', exact: true }).first().click();
  await page.getByRole('button', { name: '시간대별 운영 전략을 정리해 주세요.' }).click();
  await page.getByRole('button', { name: '최종 요약 PDF 만들기' }).click();
  await page.locator('#pdfLink').waitFor({ state: 'visible' });
  assert.match(await page.locator('#pdfLink').getAttribute('href'), /^blob:/);

  await page.getByRole('button', { name: '정책·지원사업', exact: true }).click();
  await page.getByRole('button', { name: '예시 조건 보기' }).first().click();
  assert.equal(await page.locator('#policyModal').getAttribute('open'), '');
  await page.getByRole('button', { name: '공고 예시 닫기' }).click();

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(url + '?qa=tablet#dashboard', { waitUntil: 'load' });
  await page.waitForSelector('#viewRoot .metric-card');
  assert.equal(await page.locator('.metric-card').count(), 4);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, 'horizontal overflow: ' + overflow);
  await page.getByRole('button', { name: 'iM챗봇' }).click();
  await page.waitForFunction(() => document.querySelector('#aiPanel')?.getBoundingClientRect().width >= 320);
  const tabletBox = await page.locator('#aiPanel').boundingBox();
  assert.ok(tabletBox && tabletBox.width >= 320 && tabletBox.width <= 560);
  await page.screenshot({ path: path.join(output, 'dashboard-chat-1024.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url + '?qa=mobile#dashboard', { waitUntil: 'load' });
  await page.waitForSelector('.v-insight-copy span');
  const mobile = await page.evaluate(() => {
    const span = document.querySelector('.v-insight-copy span');
    const text = span.firstChild, start = text.data.indexOf('입니다.');
    const range = document.createRange();
    range.setStart(text, start); range.setEnd(text, start + '입니다.'.length);
    return { wordLines: range.getClientRects().length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  assert.equal(mobile.wordLines, 1, 'The ending word must not split across lines');
  assert.ok(mobile.overflow <= 1, 'mobile horizontal overflow: ' + mobile.overflow);
  await page.screenshot({ path: path.join(output, 'dashboard-390.png'), fullPage: false });
  await page.locator('.insight-card').first().screenshot({ path: path.join(output, 'insight-card-390.png') });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS iM Bank-style Noto Sans KR font, browser render, interactions, PDF, 1024px layout and natural 390px line wrapping');
  } finally {
    if (browser) await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
