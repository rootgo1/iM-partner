'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../meeting-data.js');

const prototypeRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(prototypeRoot, 'main-screen.html'), 'utf8');
const ui = fs.readFileSync(path.join(prototypeRoot, 'meeting-ui.js'), 'utf8');
const menuCss = fs.readFileSync(path.join(prototypeRoot, 'meeting-preview.css'), 'utf8');
const component = fs.readFileSync(path.join(__dirname, 'profile-finance.js'), 'utf8');

assert.equal((html.match(/profile-finance-preview\/profile-finance\.css/g) || []).length, 1);
assert.equal((html.match(/profile-finance-preview\/profile-finance\.js/g) || []).length, 1);
assert.ok(!html.includes('profile-finance-preview/preview.css'));
assert.ok(html.indexOf('profile-finance-preview/profile-finance.js') < html.indexOf('<script src="./meeting-ui.js"></script>'));
assert.match(html, /id="profileMenuButton"[^>]+aria-label="이소현 프로필 메뉴"[^>]+aria-haspopup="menu"/);
assert.match(html, /id="profileMenuFinanceMount"/);
assert.match(html, /id="profileMenuTemperatureBadge"[^>]+>51\.9°<\/span>/);
assert.match(html, /id="profileTemperatureBadge"[^>]+>51\.9°<\/span>/);

assert.match(ui, /function profileFinanceSummary\(\)/);
assert.match(ui, /window\.IMProfileFinance\.mount\(mount, summary, \{ buttonRole: 'menuitem' \}\)/);
assert.match(ui, /const mount = \$\('#profileMenuFinanceMount'\)/);
assert.match(ui, /const menuBadge = \$\('#profileMenuTemperatureBadge'\)/);
assert.match(ui, /const triggerBadge = \$\('#profileTemperatureBadge'\)/);
assert.match(ui, /buttonRole: 'menuitem'/);
assert.match(ui, /temperature: null/);
assert.match(ui, /referenceTemperature:/);
assert.match(ui, /basisLabel: '일별 금융지수의 최근 30일 평균'/);
assert.match(ui, /dataStatus: 'reference'/);
assert.match(ui, /\['storeName', 'region', 'industry'\]\.every/);
assert.match(ui, /detail\.target !== 'finance-thermometer'/);
assert.match(ui, /navigate\('dashboard'\)/);
assert.match(ui, /#financeThermoTitle/);
assert.match(ui, /profileMenuItems\(\)/);
assert.match(ui, /event\.key === 'Home' \|\| event\.key === 'End'/);
assert.match(ui, /state\.profile\.name \+ ' 프로필 메뉴, 나의 금융 온도 '/);
assert.match(ui, /100 - value/);
assert.match(ui, /나의 금융 체온계/);
assert.match(ui, /연결 데이터 /);
assert.match(ui, /선택 기간 지출 ÷ 매출 × 100/);
assert.match(component, /label: '나의 금융 온도'/);
assert.match(component, /'연결 데이터 ' \+ summary\.measuredCount/);
assert.match(component, /summary\.temperature \|\| summary\.referenceTemperature/);
assert.match(component, /element\('strong', '', '금융 체온계'\)/);
assert.match(component, /element\('span', 'ipf-profile-finance__basis', basisText\)/);
assert.match(component, /element\('span', 'ipf-profile-finance__status', statusText\(summary\)\)/);
assert.match(component, /element\('span', 'ipf-profile-finance__trend', deltaText\(summary\)\)/);
assert.ok(!component.includes('ipf-profile-finance__value'));
assert.ok(!component.includes('ipf-profile-finance__legal'));
assert.ok(!component.includes('ipf-profile-finance__meta'));
assert.ok(!component.includes('ipf-profile-finance__notice'));
assert.ok(!component.includes("'내 가게 금융상태'"));

assert.match(menuCss, /\.sidebar-account-menu\s*\{[\s\S]*?max-height: calc\(100vh - 32px\);[\s\S]*?overflow-y: auto;/);
assert.match(menuCss, /\.sidebar-account-name-row\s*\{/);
assert.match(component, /if \(settings\.buttonRole === 'menuitem'\) host\.setAttribute\('role', 'none'\);/);

const current = D.financialIndex(new Date('2026-09-12T12:00:00+09:00'));
assert.equal(current.value.toFixed(1), '51.2');
assert.equal(current.previousValue.toFixed(1), '59.9');
assert.equal((current.value - current.previousValue).toFixed(1), '-8.7');
assert.equal(current.asOf, '2026-09-02');
assert.equal(current.stale, true);

console.log('PASS profile finance is integrated with verified demo metrics, guarded navigation, and accessible menu behavior');
