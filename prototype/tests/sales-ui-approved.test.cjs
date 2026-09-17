'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const D = require('../meeting-data.js');
const A = require('../sales-diagnosis-data.js');
const listeners = {}, nodes = new Map();
let html = '', downloadBlob, downloadedName, period = D.periods.month;
const node = id => {
  if (!nodes.has(id)) nodes.set(id, { id, innerHTML: '', textContent: '', scrollTop: 0, focus() {}, setAttribute() {}, showModal() { this.open = true; }, close() { this.open = false; } });
  return nodes.get(id);
};
const document = {
  body: { append() {} },
  addEventListener(type, fn) { listeners[type] = fn; },
  getElementById: node,
  querySelector() { return null; },
  createElement(tag) { return tag === 'a' ? { click() { downloadedName = this.download; }, remove() {} } : node('sd-dialog'); }
};
const window = { IM_MEETING_DEMO: D, IM_SALES_DATA: A, scrollY: 0, scrollTo() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../sales-diagnosis.js'), 'utf8'), { window, document, Blob, URL: { createObjectURL(blob) { downloadBlob = blob; return 'blob:test'; }, revokeObjectURL() {} }, setTimeout() {} });
const ui = window.IM_SALES_DIAGNOSIS;
const render = () => { html = ui.render(period); };
ui.bind(render);
const click = (key, value = '') => {
  const dataset = { [key]: value }, attribute = 'data-' + key.replace(/[A-Z]/g, s => '-' + s.toLowerCase());
  const el = { dataset, hasAttribute(name) { return name === attribute; } };
  listeners.click({ target: { closest() { return el; } } });
};
const change = (key, value) => listeners.change({ target: { dataset: { sdFilter: key }, value } });
const rows = () => [...html.matchAll(/<tr data-sd-product="([^"]+)"/g)].map(match => match[1]);
render();
assert.equal((html.match(/class="sd-panel"/g) || []).length, 4);
assert.ok(!/sd-panel-actions|sd-panel-records|data-sd-jump|data-sd-check|sd-cash-status|id="sd-comparison"|id="sd-sort"/.test(html));
assert.match(html, /결제 객단가/);
assert.match(html, /매출 − 지출 차이/);
assert.match(html, new RegExp('총지출 <b>' + D.analyze(period).expense.toLocaleString('ko-KR') + '원'));
assert.match(html, /순이익이 아니며/);
assert.match(html, /17~19시/);
ui.setExtrasRenderer(() => '<p>운영 안내 연결 확인</p>');
render();
assert.match(html, /id="sd-relocated-extras"><p>운영 안내 연결 확인/);
change('category', 'food');
change('subcategory', 'grill');
change('hour', '19');
click('sdDay', '1');
click('sdDay', '5');
const filtered = A.analyze(D, period, { comparison: 'weekday', category: 'food', subcategory: 'grill', hour: '19', days: [1, 5] });
assert.match(html, new RegExp(filtered.current.sales.toLocaleString('ko-KR') + '원'));
assert.equal(rows().length, filtered.products.length);
assert.match(html, /선택 품목 금액 기준/);
click('sdSort', 'delta');
const ordered = (key, direction) => filtered.products.slice().sort((a, b) => {
  if (a[key] == null && b[key] == null) return a.label.localeCompare(b.label, 'ko');
  if (a[key] == null) return 1;
  if (b[key] == null) return -1;
  return direction * (a[key] - b[key]) || a.label.localeCompare(b.label, 'ko');
}).map(row => row.id);
assert.deepEqual(rows(), ordered('delta', 1));
click('sdSort', 'delta');
assert.deepEqual(rows(), ordered('delta', -1));
click('sdSort', 'rate');
assert.deepEqual(rows(), ordered('rate', 1));
click('sdSort', 'rate');
assert.deepEqual(rows(), ordered('rate', -1));
const item = filtered.products[0].id;
click('sdExpand', item);
assert.match(html, new RegExp('id="sd-insight-' + item + '" class="sd-product-insight"><td'));
assert.equal(node('sd-dialog').open, undefined, 'item insight must expand in its own row, not open a modal');
// A real evidence request carries both the kind and value.
listeners.click({ target: { closest() { return { dataset: { sdDetail: 'item', value: item }, hasAttribute(name) { return name === 'data-sd-detail'; } }; } } });
assert.equal(node('sd-dialog').open, true);
assert.match(node('sd-dialog-content').innerHTML, /판매 기록/);
click('sdWeekday', '5');
assert.match(html, /금요일 일평균 매출/);
click('sdDate', filtered.daily.find(row => row.sales != null).date);
assert.match(html, /이 날짜 판매 근거 보기/);
click('sdExport');
(async () => {
  const csv = Buffer.from(await downloadBlob.arrayBuffer()).toString('utf8');
  assert.ok(csv.startsWith('\uFEFF'), 'Korean CSV must include BOM');
  assert.match(downloadedName, /매출진단.*\.csv$/);
  const data = csv.trimEnd().split('\r\n').slice(1).map(line => line.slice(1, -1).split('","'));
  assert.equal(data.length, filtered.rows.length, 'export includes every matching record, beyond the visible page');
  assert.ok(data.every(row => row.length === 16));
  assert.equal(data.reduce((n, row) => n + Number(row[15]), 0), filtered.current.sales);
  assert.ok(data.every(row => /^19:[0-5]0$|^20:[0-5]0$/.test(row[10])), 'CSV preserves ten-minute source times within the selected two-hour range');
  assert.ok(data.every(row => row[5] === 'food/grill' && row[7] === '월·금'));
  click('sdReset');
  assert.equal(rows().length, D.menu.length);
  period = D.customPeriod('2026-06-01', '2026-06-01');
  render();
  assert.ok(!/NaN|Infinity/.test(html), 'empty or unavailable comparison must not create non-finite text');
  console.log('PASS sales UI: filters, numeric bidirectional sorting, inline evidence, weekday/date diagnosis, full filtered CSV totals and ten-minute times, four sections, and empty comparison');
})().catch(error => { console.error(error); process.exitCode = 1; });
