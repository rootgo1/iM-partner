'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const D = require('../meeting-data.js');
const A = require('../sales-diagnosis-data.js');
const source = fs.readFileSync(path.join(__dirname, '../sales-diagnosis.js'), 'utf8');

function mount(data = D) {
  const listeners = {}, nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', scrollTop: 0, focus() {}, setAttribute() {}, showModal() {}, close() {} });
    return nodes.get(id);
  };
  const document = { body: { append() {} }, addEventListener(type, fn) { listeners[type] = fn; }, getElementById: node,
    querySelector() { return null; }, createElement() { return node('dialog'); } };
  const window = { IM_MEETING_DEMO: data, IM_SALES_DATA: { ...A, currentRange: () => 'all' }, scrollY: 0, scrollTo() {} };
  vm.runInNewContext(source, { window, document });
  const ui = window.IM_SALES_DIAGNOSIS;
  let period = data.periods.month, html = '';
  ui.bind(() => { html = ui.render(period); });
  return {
    ui, html: () => html,
    render(value = period) { period = value; html = ui.render(period); return html; },
    change(key, value) { listeners.change({ target: { dataset: { sdFilter: key }, value } }); },
    multi(checked) { listeners.change({ target: { dataset: { sdMulti: '' }, checked } }); },
    day(value) {
      listeners.click({ target: { closest() { return { dataset: { sdDay: String(value) }, hasAttribute(name) { return name === 'data-sd-day'; } }; } } });
    }
  };
}

const page = mount();
const beforeRender = page.ui.getRecoveryContext(D.periods.month);
assert.equal(beforeRender.source, 'sales');
assert.equal(beforeRender.title, '매출진단');
assert.ok(beforeRender.findings.length > 0, 'strategy is available before the diagnosis view is visited');
assert.ok(beforeRender.findings.every(row => row.status === 'ready' && row.action && row.evidence && row.caveat));
const html = page.render();
assert.match(html, /data-view="secretary" data-recovery-tab="strategy"/);
assert.doesNotMatch(html, /품절·메뉴 노출·가격 변경 기록을 확인해 보세요|잘 팔린 시간과 준비 수량|운영 기록을 함께 확인하세요|판매 수량과 취소 내역을 함께 확인하세요/);
assert.match(html, /증감 원인은 확정하지 않습니다/);

page.change('category', 'food');
page.change('subcategory', 'grill');
page.change('hour', '19');
page.multi(true);
page.day(1);
page.day(5);
const filters = { category: 'food', subcategory: 'grill', hour: '19', days: [1, 5], comparison: 'weekday' };
const expected = A.analyze(D, D.periods.month, filters);
const filtered = page.ui.getRecoveryContext(D.periods.month);
assert.match(filtered.scope, /19시~20시/);
assert.match(filtered.scope, /월·금/);
assert.match(filtered.scope, new RegExp(expected.previousStart + ' ~ ' + expected.previousEnd));
assert.equal(filtered.findings.length, expected.actions.length);
expected.actions.forEach((action, index) => {
  assert.equal(filtered.findings[index].id, action.id);
  assert.equal(filtered.findings[index].action, action.task);
  assert.ok(filtered.findings[index].evidence.startsWith(action.evidence));
});
const snapshot = page.html();
const week = page.ui.getRecoveryContext(D.periods.week);
assert.match(week.scope, new RegExp(D.periods.week.start + ' ~ ' + D.periods.week.end));
assert.equal(page.html(), snapshot, 'reading another period does not redraw or replace the diagnosis');
assert.deepEqual(JSON.parse(JSON.stringify(page.ui.getRecoveryContext(D.periods.month))), JSON.parse(JSON.stringify(filtered)));

const unavailable = mount().ui.getRecoveryContext(D.customPeriod('2026-06-01', '2026-06-07'));
assert.ok(unavailable.reason);
assert.ok(unavailable.findings.length > 0);
assert.ok(unavailable.findings.every(row => row.status === 'insufficient' && row.action === ''));
const missingDay = '2026-08-10';
const partial = mount({ ...D, records: D.records.filter(row => row.date !== missingDay) }).ui.getRecoveryContext(D.periods.month);
assert.match(partial.reason, /일부 누락/);
assert.ok(partial.findings.every(row => row.status === 'insufficient' && row.action === ''));
const empty = mount();
empty.render(D.customPeriod('2026-08-30', '2026-08-30'));
empty.day(1);
const noDays = empty.ui.getRecoveryContext(D.customPeriod('2026-08-30', '2026-08-30'));
assert.equal(noDays.findings.length, 0);
assert.ok(noDays.reason);
const invalidSelection = mount();
invalidSelection.change('category', 'food');
invalidSelection.change('subcategory', 'soft');
assert.equal(invalidSelection.ui.getRecoveryContext(D.periods.month).findings.length, 0);

const strongerMonth = { ...D, records: D.records.map(row => row.date >= D.periods.month.start && row.date <= D.periods.month.end ? { ...row, netAmount: row.netAmount * 100, netQuantity: row.netQuantity * 100 } : row) };
const drinkPage = mount(strongerMonth);
drinkPage.change('category', 'drink');
const drinkContext = drinkPage.ui.getRecoveryContext(D.periods.month);
assert.ok(drinkContext.findings.length > 0);
assert.doesNotMatch(JSON.stringify(drinkContext), /구이류/);
assert.ok(drinkContext.findings.every(row => row.status === 'ready'));
const zeroBaseline = { ...D, records: D.records.map(row => row.date < D.periods.month.start ? { ...row, netAmount: 0, netQuantity: 0 } : row) };
const zero = mount(zeroBaseline).ui.getRecoveryContext(D.periods.month);
assert.match(zero.reason, /0 이하/);
assert.ok(zero.findings.every(row => row.status === 'insufficient' && row.action === ''));
console.log('PASS sales recovery: current filters and period, data-backed actions, diagnosis-only copy, no stale view mutation, missing/partial/zero data safeguards, and category-specific maintenance');
