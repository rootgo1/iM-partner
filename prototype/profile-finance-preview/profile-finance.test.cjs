'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browserCandidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ];
  const executablePath = browserCandidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executablePath, 'An installed Chrome or Edge browser is required');

  const output = path.resolve(__dirname, '../../tmp/profile-finance-preview-qa');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath });

  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });

    const url = pathToFileURL(path.resolve(__dirname, 'index.html')).href;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('.ipf-profile-finance__button');

    assert.equal(await page.locator('#previewProfilePopover').isVisible(), true);
    assert.equal(await page.locator('#previewProfileTrigger').getAttribute('aria-expanded'), 'true');
    assert.equal((await page.locator('#previewTemperatureBadge').innerText()).trim(), '51.9°');
    assert.equal(await page.locator('#previewTemperatureBadge').evaluate(node => node.tagName), 'SPAN');
    assert.equal(await page.locator('#previewTemperatureBadge').getAttribute('role'), null);
    const compactSummaryText = await page.locator('.ipf-profile-finance__button').innerText();
    assert.match(compactSummaryText, /금융 체온계/);
    assert.match(compactSummaryText, /매출·지출 기반 참고 온도/);
    assert.match(compactSummaryText, /연결 데이터 2\/4/);
    assert.match(compactSummaryText, /전월보다 8\.8° 낮음/);
    assert.doesNotMatch(compactSummaryText, /현금잔액|2026년|경영 참고용/);
    assert.match(await page.locator('.ipf-profile-finance__button').getAttribute('aria-label'), /금융 체온계로 이동/);
    assert.match(await page.locator('.ipf-profile-finance__button').getAttribute('aria-label'), /4개 중 2개 연결/);
    assert.match(await page.locator('.ipf-profile-finance__button').getAttribute('aria-label'), /8\.8도 낮음/);

    const textContrast = await page.evaluate(() => {
      const rgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const luminance = value => {
        const channels = rgb(value).map(channel => {
          const normalized = channel / 255;
          return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const ratio = (foreground, background) => {
        const first = luminance(foreground), second = luminance(background);
        return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
      };
      const button = getComputedStyle(document.querySelector('.ipf-profile-finance__button'));
      return ['.ipf-profile-finance__heading strong', '.ipf-profile-finance__basis', '.ipf-profile-finance__status', '.ipf-profile-finance__trend']
        .map(selector => {
          const style = getComputedStyle(document.querySelector(selector));
          const background = style.backgroundColor === 'rgba(0, 0, 0, 0)' ? button.backgroundColor : style.backgroundColor;
          return ratio(style.color, background);
        });
    });
    assert.ok(textContrast.every(ratio => ratio >= 4.5), 'compact summary contrast: ' + textContrast.join(', '));

    const compactFit = await page.locator('.ipf-profile-finance__button').evaluate(node => ({
      overflow: node.scrollWidth - node.clientWidth
    }));
    assert.ok(compactFit.overflow <= 1, 'compact component horizontal overflow: ' + compactFit.overflow);

    await page.locator('.ipf-profile-finance__button').click();
    const eventDetail = await page.evaluate(() => window.__lastProfileFinanceEvent);
    assert.equal(eventDetail.target, 'finance-thermometer');
    assert.equal(eventDetail.source, 'profile-menu');
    assert.equal(eventDetail.storeProfileId, null);
    assert.equal(eventDetail.analysisRunId, null);
    assert.equal(await page.evaluate(() => window.__profileFinanceEventCount), 1);
    assert.match(await page.locator('#previewEventNotice').innerText(), /이동 요청이 전달/);

    await page.locator('.ipf-profile-finance__button').press('Enter');
    await page.locator('.ipf-profile-finance__button').press('Space');
    assert.equal(await page.evaluate(() => window.__profileFinanceEventCount), 3);
    await page.getByRole('button', { name: '내 프로필 관리', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__profileFinanceEventCount), 3);

    await page.getByRole('button', { name: '연결 4/4', exact: true }).click();
    assert.equal((await page.locator('#previewTemperatureBadge').innerText()).trim(), '51.9°');
    assert.match(await page.locator('.ipf-profile-finance__button').innerText(), /연결 데이터 4\/4/);
    assert.match(await page.locator('.ipf-profile-finance__button').getAttribute('aria-label'), /4개 중 4개 연결/);

    await page.getByRole('button', { name: '연결 없음', exact: true }).click();
    const unavailableText = await page.locator('.ipf-profile-finance__button').innerText();
    assert.equal((await page.locator('#previewTemperatureBadge').innerText()).trim(), '측정 전');
    assert.match(unavailableText, /연결 데이터 0\/4/);
    assert.match(unavailableText, /비교 자료 없음/);
    assert.match(await page.locator('.ipf-profile-finance__button').getAttribute('aria-label'), /4개 중 0개 연결/);
    assert.doesNotMatch(await page.locator('#previewTemperatureBadge').innerText(), /0(?:\.0)?[%°]?/);

    await page.getByRole('button', { name: '연결 2/4', exact: true }).click();
    await page.locator('.ipf-profile-finance__button').click();
    assert.equal(await page.evaluate(() => window.__profileFinanceEventCount), 4, 'update must not duplicate event listeners');

    const temperatureGate = await page.evaluate(() => {
      const base = {
        status: 'complete', measuredCount: 4, totalCount: 4,
        metric: { label: '지출 부담', value: 48.1, unit: '%' }
      };
      const invalid = window.IMProfileFinance.normalize(Object.assign({}, base, {
        temperature: { value: 36.8, statusLabel: '예시', ruleVersion: 'v1' }
      }));
      const valid = window.IMProfileFinance.normalize(Object.assign({}, base, {
        temperature: { value: 36.8, statusLabel: '예시', ruleVersion: 'v1', scoringDefinition: 'verified-definition-id', dataStatus: 'available' }
      }));
      const partial = window.IMProfileFinance.normalize(Object.assign({}, base, {
        status: 'partial', measuredCount: 2,
        temperature: { value: 36.8, statusLabel: '예시', ruleVersion: 'v1', scoringDefinition: 'verified-definition-id', dataStatus: 'available' }
      }));
      const nullValue = window.IMProfileFinance.normalize(Object.assign({}, base, {
        temperature: { value: null, statusLabel: '예시', ruleVersion: 'v1', scoringDefinition: 'verified-definition-id', dataStatus: 'available' }
      }));
      const definitionPending = window.IMProfileFinance.normalize(Object.assign({}, base, {
        temperature: { value: 36.8, statusLabel: '예시', ruleVersion: 'v1', scoringDefinition: 'verified-definition-id', dataStatus: 'definition_pending' }
      }));
      const referenceBase = Object.assign({}, base, { status: 'partial', measuredCount: 2 });
      const validReference = window.IMProfileFinance.normalize(Object.assign({}, referenceBase, {
        referenceTemperature: { value: 51.9, delta: -8.8, deltaUnit: '°', deltaLabel: '전월보다', basisLabel: '매출·지출 기반 참고 온도', ruleVersion: 'expense-ratio-reference-v1', scoringDefinition: '100 - 매출 대비 지출률', dataStatus: 'reference' }
      }));
      const invalidReference = window.IMProfileFinance.normalize(Object.assign({}, referenceBase, {
        referenceTemperature: { value: 51.9, basisLabel: '매출·지출 기반 참고 온도', dataStatus: 'reference' }
      }));
      const unavailableReference = window.IMProfileFinance.normalize(Object.assign({}, referenceBase, {
        status: 'unavailable', measuredCount: 0,
        referenceTemperature: { value: 51.9, basisLabel: '매출·지출 기반 참고 온도', ruleVersion: 'expense-ratio-reference-v1', scoringDefinition: '100 - 매출 대비 지출률', dataStatus: 'reference' }
      }));
      const menuHost = document.createElement('div');
      const sentinel = document.createElement('span');
      sentinel.id = 'mount-sentinel';
      menuHost.append(sentinel);
      document.body.append(menuHost);
      const menuComponent = window.IMProfileFinance.mount(menuHost, base, { buttonRole: 'menuitem', after: sentinel });
      const repeatedComponent = window.IMProfileFinance.mount(menuHost, Object.assign({}, base, { status: 'partial', measuredCount: 2 }));
      const buttonRole = menuHost.querySelector('button').getAttribute('role');
      const sentinelPreserved = menuHost.querySelector('#mount-sentinel') === sentinel;
      const ownedCount = menuHost.querySelectorAll('[data-ipf-owned="true"]').length;
      const sameController = repeatedComponent === menuComponent;
      menuComponent.update(Object.assign({}, base, {
        status: 'partial', measuredCount: 2,
        metric: { label: '지출 부담', value: 48.1, unit: '%', delta: -8.8, deltaUnit: '%p', deltaLabel: '전월보다' }
      }));
      const negativeDeltaText = menuHost.querySelector('.ipf-profile-finance__button').getAttribute('aria-label');
      menuComponent.destroy();
      const sentinelAfterDestroy = menuHost.querySelector('#mount-sentinel') === sentinel;
      menuHost.remove();
      return { invalid: invalid.temperature, valid: valid.temperature, partial: partial.temperature, nullValue: nullValue.temperature, definitionPending: definitionPending.temperature, validReference: validReference.referenceTemperature, invalidReference: invalidReference.referenceTemperature, unavailableReference: unavailableReference.referenceTemperature, buttonRole, sentinelPreserved, sentinelAfterDestroy, ownedCount, sameController, negativeDeltaText };
    });
    assert.equal(temperatureGate.invalid, null, 'temperature must stay hidden without a scoring definition');
    assert.equal(temperatureGate.valid.value, 36.8);
    assert.equal(temperatureGate.partial, null, 'temperature must stay hidden while measurement is partial');
    assert.equal(temperatureGate.nullValue, null, 'null temperature must never become zero degrees');
    assert.equal(temperatureGate.definitionPending, null, 'definition_pending must never display a temperature');
    assert.equal(temperatureGate.validReference.value, 51.9);
    assert.equal(temperatureGate.validReference.delta, -8.8);
    assert.equal(temperatureGate.invalidReference, null, 'reference temperature requires a declared formula');
    assert.equal(temperatureGate.unavailableReference, null, 'reference temperature stays hidden without connected data');
    assert.equal(temperatureGate.buttonRole, 'menuitem');
    assert.equal(temperatureGate.sentinelPreserved, true, 'mount must preserve existing host children');
    assert.equal(temperatureGate.sentinelAfterDestroy, true, 'destroy must remove only component-owned content');
    assert.equal(temperatureGate.ownedCount, 1, 'repeated mount must not duplicate the component');
    assert.equal(temperatureGate.sameController, true, 'repeated mount must return the existing controller');
    assert.match(temperatureGate.negativeDeltaText, /비교 자료 없음/);

    await page.screenshot({ path: path.join(output, 'profile-finance-desktop-1366.png'), fullPage: false });
    await page.locator('.ipf-preview-sidebar').screenshot({ path: path.join(output, 'profile-finance-component-244.png') });

    await page.locator('#previewProfileTrigger').click();
    assert.equal(await page.locator('#previewProfilePopover').isHidden(), true);
    assert.equal(await page.locator('#previewProfileTrigger').getAttribute('aria-expanded'), 'false');
    await page.locator('#previewProfileTrigger').click();
    await page.waitForFunction(() => document.activeElement.classList.contains('ipf-profile-finance__button'));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#previewProfilePopover').isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'previewProfileTrigger');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url + '?mobile=1', { waitUntil: 'load' });
    await page.waitForSelector('.ipf-profile-finance__button');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, 'mobile horizontal overflow: ' + overflow);
    const targetSize = await page.locator('.ipf-profile-finance__button').evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    assert.ok(targetSize.width >= 44 && targetSize.height >= 44);
    await page.screenshot({ path: path.join(output, 'profile-finance-mobile-390.png'), fullPage: true });

    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(url + '?compact=1', { waitUntil: 'load' });
    await page.waitForSelector('.ipf-profile-finance__button');
    const compactOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const componentOverflow = await page.locator('.ipf-profile-finance__button').evaluate(node => node.scrollWidth - node.clientWidth);
    assert.ok(compactOverflow <= 1, '320px viewport horizontal overflow: ' + compactOverflow);
    assert.ok(componentOverflow <= 1, '320px component horizontal overflow: ' + componentOverflow);

    const standaloneStyles = await page.evaluate(() => {
      document.querySelector('link[href="./preview.css"]').disabled = true;
      const button = document.querySelector('.ipf-profile-finance__button');
      const badge = document.querySelector('#previewTemperatureBadge');
      return {
        buttonFont: getComputedStyle(button).fontFamily,
        buttonBoxSizing: getComputedStyle(button).boxSizing,
        badgeBoxSizing: getComputedStyle(badge).boxSizing
      };
    });
    assert.match(standaloneStyles.buttonFont, /iM Noto Sans KR/);
    assert.equal(standaloneStyles.buttonBoxSizing, 'border-box');
    assert.equal(standaloneStyles.badgeBoxSizing, 'border-box');

    assert.deepEqual(errors, []);
    console.log('PASS isolated profile finance status, event contract, states, keyboard and responsive layout');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
