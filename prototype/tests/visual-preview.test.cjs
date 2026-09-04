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
  assert.equal(await page.locator('.metric-card').count(), 4);
  assert.match(await page.locator('#viewRoot').innerText(), /생성 데이터 기반 시연/);
  await page.screenshot({ path: path.join(output, 'dashboard-1920.png'), fullPage: false });

  await page.getByRole('button', { name: '매출·지출 분석', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#pageTitle')?.textContent.includes('매출과 남는 돈'));
  assert.match(await page.locator('#viewRoot').innerText(), /월세/);
  assert.match(await page.locator('#viewRoot').innerText(), /매입금액 TOP 3/);

  await page.getByRole('button', { name: '챗봇' }).click();
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
  await page.getByRole('button', { name: '챗봇' }).click();
  await page.waitForFunction(() => document.querySelector('#aiPanel')?.getBoundingClientRect().width >= 320);
  const tabletBox = await page.locator('#aiPanel').boundingBox();
  assert.ok(tabletBox && tabletBox.width >= 320 && tabletBox.width <= 560);
  await page.screenshot({ path: path.join(output, 'dashboard-chat-1024.png'), fullPage: false });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS browser render, seven-view interactions, chatbot, PDF, modal and 1024px layout');
  } finally {
    if (browser) await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
