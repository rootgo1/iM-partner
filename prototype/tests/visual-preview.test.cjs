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
  const navigationIconSystem = await page.evaluate(() => {
    const active = document.querySelector('#mainNavigation .nav-item.active');
    const inactive = document.querySelector('#mainNavigation .nav-item:not(.active)');
    const icon = active.querySelector('.nav-icon');
    const svg = active.querySelector('svg');
    const activeDot = getComputedStyle(active.querySelector('.nav-icon'), '::after');
    const inactiveDot = getComputedStyle(inactive.querySelector('.nav-icon'), '::after');
    const activeLabel = active.querySelector('.nav-label').getBoundingClientRect();
    const inactiveLabel = inactive.querySelector('.nav-label').getBoundingClientRect();
    return {
      iconWidth: icon.getBoundingClientRect().width,
      iconHeight: icon.getBoundingClientRect().height,
      svgWidth: svg.getBoundingClientRect().width,
      strokeWidth: svg.getAttribute('stroke-width'),
      activeDotOpacity: Number(activeDot.opacity),
      inactiveDotOpacity: Number(inactiveDot.opacity),
      labelAlignmentDelta: Math.abs(activeLabel.left - inactiveLabel.left)
    };
  });
  assert.equal(navigationIconSystem.iconWidth, 32);
  assert.equal(navigationIconSystem.iconHeight, 32);
  assert.equal(navigationIconSystem.svgWidth, 23);
  assert.equal(navigationIconSystem.strokeWidth, '1.75');
  assert.ok(navigationIconSystem.activeDotOpacity >= .95, 'active navigation icon needs a clear lime accent');
  assert.ok(navigationIconSystem.inactiveDotOpacity <= .25, 'inactive navigation dots should stay subtle');
  assert.ok(navigationIconSystem.labelAlignmentDelta <= .5, 'active indicator must not shift navigation labels');
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
  await page.locator('#profileMenuButton').click();
  assert.equal(await page.locator('#profileMenu').isVisible(), true);
  const collapsedProfileMenu = await page.locator('#profileMenu').evaluate(menu => {
    const box = menu.getBoundingClientRect();
    const topElement = document.elementFromPoint(box.left + box.width / 2, box.top + 32);
    return {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      fullyInViewport: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
      paintedAboveMain: Boolean(topElement && menu.contains(topElement))
    };
  });
  assert.equal(collapsedProfileMenu.fullyInViewport, true, 'collapsed profile menu must stay inside the viewport');
  assert.equal(collapsedProfileMenu.paintedAboveMain, true, 'collapsed profile menu must be painted above the main content');
  await page.screenshot({ path: path.join(output, 'sidebar-collapsed-profile-menu-1920.png'), fullPage: false });
  await page.locator('#profileMenuButton').click();
  await page.getByRole('button', { name: '파트너 메뉴 펼치기' }).click();
  await page.waitForFunction(() => Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width - 238) < 1);
  assert.equal(await page.locator('.metric-card').count(), 4);
  assert.equal(await page.locator('#viewRoot > .v-screen-section').count(), 4);
  assert.equal(await page.locator('#viewRoot > .v-screen-section').first().locator('.v-dashboard-lead').count(), 1);
  assert.equal(await page.locator('#viewRoot > .v-screen-section').first().locator('.metric-card').count(), 4);
  assert.equal(await page.locator('#viewRoot > .v-screen-section').first().locator('.metric-card.primary').count(), 0);
  assert.equal(await page.locator('#viewRoot > .v-screen-section').nth(1).locator('.metric-card').count(), 0);
  assert.equal(await page.locator('#viewRoot > .v-screen-section').nth(1).locator('.v-dashboard-support').count(), 1);
  assert.equal(await page.locator('#viewRoot > .v-screen-section').nth(2).locator('.v-dashboard-decision').count(), 1);
  assert.equal(await page.locator('#pageHeading').isHidden(), true);
  assert.equal(await page.locator('#dataNotice').isHidden(), true);
  const sectionLayout = await page.evaluate(() => {
    const root = document.querySelector('#viewRoot');
    const first = root.querySelector('.v-screen-section');
    const sections = [...root.querySelectorAll(':scope > .v-screen-section')];
    return {
      rootHeight: root.clientHeight,
      sectionHeight: first.getBoundingClientRect().height,
      sectionBackgrounds: [...new Set(sections.map(section => getComputedStyle(section).backgroundColor))],
      sectionShadows: [...new Set(sections.map(section => getComputedStyle(section).boxShadow))],
      snap: getComputedStyle(root).scrollSnapType,
      enhanced: root.classList.contains('is-lenis-enhanced'),
      lenisVersion: window.lenis?.version,
      lenisSnap: window.lenis?.snap === true,
      scrollMode: root.dataset.scrollMode
    };
  });
  assert.ok(Math.abs(sectionLayout.rootHeight - sectionLayout.sectionHeight) <= 1, 'each desktop section must occupy one content viewport');
  assert.equal(sectionLayout.sectionBackgrounds.length, 1, 'all sections must share one canvas color without alternating gray bands');
  assert.deepEqual(sectionLayout.sectionShadows, ['none'], 'sections must not use straight inset shadow dividers');
  assert.equal(sectionLayout.snap, 'none');
  assert.equal(sectionLayout.enhanced, true);
  assert.equal(sectionLayout.lenisVersion, '1.3.26');
  assert.equal(sectionLayout.lenisSnap, false);
  assert.equal(sectionLayout.scrollMode, 'lenis-single-settle');
  assert.equal(await page.locator('#dashboardPeriodSelect').count(), 0);
  assert.equal(await page.locator('h1:visible').count(), 1);
  assert.equal(await page.locator('#dashboardCustomPeriod').count(), 0);
  const expenseMetric = page.locator('.metric-card').filter({ hasText: '총지출' });
  assert.match(await expenseMetric.innerText(), /▲ 7\.2% 증가/);
  assert.equal(await expenseMetric.locator('.trend-caution').count(), 1);
  assert.equal(await expenseMetric.locator('.trend-up').count(), 0);
  assert.match(await page.locator('#viewRoot').innerText(), /생성 데이터 기반 시연/);
  await page.screenshot({ path: path.join(output, 'dashboard-1920.png'), fullPage: false });

  const rootBox = await page.locator('#viewRoot').boundingBox();
  assert.ok(rootBox, 'full-page scroll area must be visible');
  await page.mouse.move(rootBox.x + rootBox.width * .55, rootBox.y + rootBox.height * .55);
  await page.mouse.wheel(0, 900);
  await page.waitForFunction(() => {
    const root = document.querySelector('#viewRoot');
    return root.scrollTop >= root.clientHeight * .95;
  });
  await page.waitForFunction(() => {
    const root = document.querySelector('#viewRoot');
    return Math.abs(root.scrollTop - root.clientHeight) <= 2 && !root.classList.contains('lenis-scrolling');
  }, null, { timeout: 2500 });
  const wheelPosition = await page.evaluate(() => {
    const root = document.querySelector('#viewRoot');
    const section = root.querySelector('.v-screen-section');
    return { page: root.scrollTop / root.clientHeight, snapStop: getComputedStyle(section).scrollSnapStop };
  });
  assert.ok(wheelPosition.page >= .995 && wheelPosition.page <= 1.005, 'Lenis wheel input must settle on the next section');
  assert.equal(wheelPosition.snapStop, 'normal');
  await page.mouse.wheel(0, 900);
  await page.waitForFunction(() => {
    const root = document.querySelector('#viewRoot');
    return root.scrollTop >= root.clientHeight * 1.95;
  });
  await page.waitForFunction(() => {
    const root = document.querySelector('#viewRoot');
    return Math.abs(root.scrollTop - root.clientHeight * 2) <= 2 && !root.classList.contains('lenis-scrolling');
  }, null, { timeout: 2500 });
  await page.evaluate(() => {
    const root = document.querySelector('#viewRoot');
    root.scrollTop = 0;
    window.IM_SMOOTH_SCROLL.mount(root);
  });
  await page.waitForTimeout(80);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(90);
  const beforeReverse = await page.locator('#viewRoot').evaluate(root => root.scrollTop);
  await page.mouse.wheel(0, -900);
  await page.waitForFunction(() => {
    const root = document.querySelector('#viewRoot');
    return root.scrollTop <= 2 && !root.classList.contains('lenis-scrolling');
  }, null, { timeout: 2500 });
  assert.ok(beforeReverse > 0, 'scroll must begin without an artificial input delay');
  await page.evaluate(() => { document.querySelector('#viewRoot').scrollTop = 0; });

  const resetSectionScroll = async () => {
    await page.evaluate(() => {
      const root = document.querySelector('#viewRoot');
      root.scrollTop = 0;
      window.IM_SMOOTH_SCROLL.mount(root);
    });
    await page.waitForTimeout(80);
  };
  const startScrollTrace = async () => {
    await page.evaluate(() => {
      clearInterval(window.__imScrollTraceTimer);
      const root = document.querySelector('#viewRoot');
      window.__imScrollTrace = [];
      window.__imScrollTraceTimer = setInterval(() => {
        window.__imScrollTrace.push({ time: performance.now(), top: root.scrollTop });
      }, 12);
    });
  };
  const finishScrollTrace = async () => page.evaluate(() => {
    clearInterval(window.__imScrollTraceTimer);
    return window.__imScrollTrace || [];
  });
  const largestBackwardStep = trace => trace.reduce((largest, point, index) => {
    if (!index) return largest;
    return Math.max(largest, trace[index - 1].top - point.top);
  }, 0);

  await resetSectionScroll();
  await startScrollTrace();
  for (let index = 0; index < 16; index++) {
    await page.mouse.wheel(0, 48);
    await page.waitForTimeout(18);
  }
  await page.waitForFunction(() => {
    const root = document.querySelector('#viewRoot');
    return Math.abs(root.scrollTop - root.clientHeight) <= 2 && !root.classList.contains('lenis-scrolling');
  }, null, { timeout: 2500 });
  const continuousDownTrace = await finishScrollTrace();
  assert.ok(largestBackwardStep(continuousDownTrace) <= 2, 'continuous wheel input must not pull the page back toward the previous section');

  await resetSectionScroll();
  await startScrollTrace();
  for (let index = 0; index < 6; index++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(180);
  }
  await page.waitForFunction(() => {
    const root = document.querySelector('#viewRoot');
    const page = root.scrollTop / root.clientHeight;
    return Math.abs(page - Math.round(page)) <= .002 && !root.classList.contains('lenis-scrolling');
  }, null, { timeout: 2500 });
  const spacedWheelTrace = await finishScrollTrace();
  const spacedWheelBackwardStep = largestBackwardStep(spacedWheelTrace);
  const spacedWheelBackwardIndex = spacedWheelTrace.findIndex((point, index) => index && spacedWheelTrace[index - 1].top - point.top === spacedWheelBackwardStep);
  assert.ok(spacedWheelBackwardStep <= 2, 'spaced mouse-wheel notches must continue toward one section without tugging backward: ' + JSON.stringify(spacedWheelTrace.slice(Math.max(0, spacedWheelBackwardIndex - 3), spacedWheelBackwardIndex + 4)));

  await resetSectionScroll();
  await startScrollTrace();
  for (let index = 0; index < 12; index++) {
    await page.mouse.wheel(0, 46);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(170);
  const reverseInput = await page.evaluate(() => ({ time: performance.now(), top: document.querySelector('#viewRoot').scrollTop }));
  await page.mouse.wheel(0, -620);
  await page.waitForFunction(() => {
    const root = document.querySelector('#viewRoot');
    return root.scrollTop <= 2 && !root.classList.contains('lenis-scrolling');
  }, null, { timeout: 2500 });
  const interruptedTrace = await finishScrollTrace();
  const afterReverse = interruptedTrace.filter(point => point.time >= reverseInput.time + 35);
  assert.ok(afterReverse.some(point => point.time <= reverseInput.time + 180 && point.top < reverseInput.top - 4), 'reverse input must interrupt section settling without a lock delay');
  const firstFallingPoint = afterReverse.findIndex(point => point.top < reverseInput.top - 4);
  assert.ok(firstFallingPoint >= 0);
  const rebound = afterReverse.slice(firstFallingPoint).reduce((largest, point, index, points) => {
    if (!index) return largest;
    return Math.max(largest, point.top - points[index - 1].top);
  }, 0);
  assert.ok(rebound <= 2, 'interrupted settling must not rebound toward the abandoned section');

  await page.getByRole('button', { name: '매출진단', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#pageTitle')?.textContent.includes('상권의 기회와 가게의 매출'));
  assert.equal(await page.locator('#pageHeading').isHidden(), true);
  assert.equal(await page.locator('#dataNotice').isHidden(), true);
  assert.equal(await page.locator('#viewRoot > .v-screen-section').count(), 6);
  assert.equal(await page.locator('#sectionPeriodSelect').isVisible(), true);
  assert.equal(await page.locator('#sectionPeriodSelect').inputValue(), 'month');
  assert.match(await page.locator('#viewRoot').innerText(), /월세/);
  assert.match(await page.locator('#viewRoot').innerText(), /품목별 판매 실적/);
  assert.match(await page.locator('#viewRoot').innerText(), /요일 × 시간대 매출/);
  assert.equal(await page.locator('#viewRoot .sd-panel').count(), 6);
  assert.equal(await page.locator('#mainNavigation .nav-item').count(), 5);
  assert.equal(await page.locator('.topbar .profile, .topbar .logout-link').count(), 0);
  assert.equal(await page.locator('.topbar .data-chip').count(), 0);
  assert.equal(await page.locator('#profileInitials').innerText(), '소현');
  const opticalProductGap = await page.locator('.ai-toggle .im-product-name').evaluate(label => {
    const latin = label.firstElementChild.getBoundingClientRect();
    const korean = label.lastElementChild.getBoundingClientRect();
    return korean.left - latin.right;
  });
  assert.ok(opticalProductGap > 0 && opticalProductGap <= 3, 'iM product names need a subtle optical gap without a text space');

  await page.locator('#profileMenuButton').click();
  assert.equal(await page.locator('#profileMenu').isVisible(), true);
  const profileMenuBox = await page.locator('#profileMenu').boundingBox();
  assert.ok(profileMenuBox && profileMenuBox.x >= 0 && profileMenuBox.y >= 0, 'profile menu must stay inside the viewport');
  await page.screenshot({ path: path.join(output, 'sidebar-profile-menu-1920.png'), fullPage: false });
  await page.locator('#profileMenu [data-view="profile"]').click();
  await page.waitForFunction(() => location.hash === '#profile');
  assert.equal(await page.locator('#profileMenu').isHidden(), true);

  await page.getByRole('link', { name: 'iM파트너 메인 페이지로 이동' }).click();
  await page.waitForFunction(() => location.hash === '#dashboard');
  assert.ok((await page.locator('#bannerTitle').innerText()).length > 0, 'rotating banner remains populated after returning home');
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

  await page.getByRole('button', { name: 'iM비서', exact: true }).first().click();
  assert.equal(await page.locator('.v-secretary-layout > .v-decision-action').count(), 1);
  await page.getByRole('button', { name: '시간대별 운영 전략을 정리해 주세요.' }).click();
  await page.getByRole('button', { name: '최종 요약 PDF 만들기' }).click();
  await page.locator('#pdfLink').waitFor({ state: 'visible' });
  assert.match(await page.locator('#pdfLink').getAttribute('href'), /^blob:/);

  await page.getByRole('button', { name: '지원사업', exact: true }).click();
  assert.equal(await page.locator('.v-policy-decision > .v-decision-action').count(), 1);
  assert.equal(await page.locator('.v-policy-overview').count(), 1);
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
  await page.waitForSelector('.v-dashboard-insight');
  const mobile = await page.evaluate(() => {
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      enhanced: document.querySelector('#viewRoot').classList.contains('is-lenis-enhanced')
    };
  });
  assert.ok(mobile.overflow <= 1, 'mobile horizontal overflow: ' + mobile.overflow);
  assert.equal(mobile.enhanced, false, 'mobile must retain native scrolling');
  await page.screenshot({ path: path.join(output, 'dashboard-390.png'), fullPage: false });
  await page.locator('.insight-card').first().screenshot({ path: path.join(output, 'insight-card-390.png') });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(url + '?qa=reduced-motion#dashboard', { waitUntil: 'load' });
  await page.waitForSelector('#viewRoot > .v-screen-section');
  const reducedMotion = await page.evaluate(() => {
    const root = document.querySelector('#viewRoot');
    return { enhanced: root.classList.contains('is-lenis-enhanced'), snap: getComputedStyle(root).scrollSnapType };
  });
  assert.equal(reducedMotion.enhanced, false, 'reduced-motion preference must disable Lenis smoothing');
  assert.match(reducedMotion.snap, /y/, 'reduced-motion preference must retain native section snapping');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.setViewportSize({ width: 1366, height: 768 });
  const densityViews = ['dashboard', 'analysis', 'recovery', 'policies', 'secretary', 'profile'];
  const densityShots = new Set(['dashboard-3', 'analysis-1', 'analysis-2', 'analysis-4', 'analysis-6', 'recovery-4', 'policies-1']);
  for (const view of densityViews) {
    await page.goto(url + '?qa=density#' + view, { waitUntil: 'load' });
    await page.waitForSelector('#viewRoot > .v-screen-section');
    const count = await page.locator('#viewRoot > .v-screen-section').count();
    for (let index = 0; index < count; index++) {
      await page.evaluate(i => {
        const root = document.querySelector('#viewRoot');
        root.scrollTop = i * root.clientHeight;
      }, index);
      await page.waitForTimeout(80);
      const fit = await page.locator('#viewRoot > .v-screen-section').nth(index).evaluate(section => {
        const inner = section.querySelector('.v-screen-inner');
        return {
          verticalOverflow: inner.scrollHeight - inner.clientHeight,
          scrollable: ["auto", "scroll"].includes(getComputedStyle(inner).overflowY),
          horizontalOverflow: inner.scrollWidth - inner.clientWidth
        };
      });
      assert.ok(fit.verticalOverflow <= 2 || fit.scrollable, view + ' section ' + (index + 1) + ' has nested vertical overflow: ' + fit.verticalOverflow);
      assert.ok(fit.horizontalOverflow <= 2, view + ' section ' + (index + 1) + ' has horizontal overflow: ' + fit.horizontalOverflow);
      const shotKey = view + '-' + (index + 1);
      if (densityShots.has(shotKey)) await page.screenshot({ path: path.join(output, 'density-' + shotKey + '-1366.png'), fullPage: false });
    }
  }

  const loginUrl = pathToFileURL(path.resolve(__dirname, '../login-preview/index.html')).href;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(loginUrl + '?qa=guest-clean', { waitUntil: 'load' });
  assert.equal(await page.locator('.guest-nav, [data-login-required], .preview-art').count(), 0);
  assert.equal(await page.locator('.guest-header .brand').count(), 1);
  assert.equal(await page.getByRole('link', { name: '데모 시작', exact: true }).count(), 0);
  assert.equal(await page.locator('.value-panel img').count(), 0);
  const guestOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(guestOverflow <= 1, 'guest desktop horizontal overflow: ' + guestOverflow);
  await page.screenshot({ path: path.join(output, 'guest-clean-1440.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(loginUrl + '?qa=guest-clean-mobile', { waitUntil: 'load' });
  const guestMobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(guestMobileOverflow <= 1, 'guest mobile horizontal overflow: ' + guestMobileOverflow);
  assert.equal(await page.locator('.preview-art').count(), 0);
  await page.screenshot({ path: path.join(output, 'guest-clean-390.png'), fullPage: false });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS iM Bank-style font, consolidated navigation, profile menu, clean guest entry, smooth scrolling and responsive layouts');
  } finally {
    if (browser) await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
