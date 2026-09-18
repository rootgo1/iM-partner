'use strict';
const assert = require('node:assert/strict');
const S = require('../meeting-data.js');
const D = require('../market-analysis-data.js');
const Sales = require('../sales-diagnosis-data.js');
const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] || 0), 0);
assert.equal(D.rows, S.cctvRows, 'CCTV source must be shared, not independently fabricated');
assert.equal(D.slots.length, 36);
assert.equal(D.slots[0].id, '17:00');
assert.equal(D.slots.at(-1).label, '22:50~23:00');
assert.equal(S.profile.age, '');
assert.equal(S.profile.ageBand, '50대');
assert.equal(S.profile.address, '');
assert.equal(S.business.fictional, true);
const periods = [S.periods.month, S.periods.week, S.customPeriod('2026-06-01', '2026-06-07'), S.customPeriod('2026-08-30', '2026-08-30')];
let cases = 0;
for (const period of periods) for (const days of [[], [1, 3, 5], [0, 6], [2]]) for (const comparison of ['weekday', 'previous']) {
  const r = D.analyze(period, { days, comparison }), valid = r.selected.filter(row => row.status === 'valid');
  assert.equal(r.current.passers, valid.length ? sum(valid, 'passers') : null);
  assert.equal(r.current.entrants, valid.length ? sum(valid, 'entrants') : null);
  assert.equal(r.current.entryRate, D.ratio(r.current.entrants, r.current.passers));
  assert.equal(r.current.purchaseRate, D.ratio(r.current.validPayments, r.current.entrants));
  assert.equal(r.current.averagePerTenMinutes, valid.length ? sum(valid, 'passers') / valid.length : null);
  assert.equal(r.observedHours, valid.length / 6);
  assert.equal(r.current.count + r.unavailable.length, r.expected);
  assert.equal(sum(r.bySlot, 'passers'), r.current.passers || 0);
  assert.equal(r.current.dwellBins.reduce((a, b) => a + b, 0), r.current.dwellers || 0);
  assert.equal((r.current.directionA || 0) + (r.current.directionB || 0), r.current.passers || 0);
  if (comparison === 'weekday') assert.equal(D.weekday(r.previousStart), D.weekday(period.start));
  assert.ok(r.previousEnd < period.start);
  assert.ok(!r.comparison || (r.complete && r.oldComplete));
  assert.deepEqual(r.byWeekday.map(row => row.id), ['1', '2', '3', '4', '5', '6', '0']);
  const sales = Sales.analyze(S, period, { days, comparison });
  assert.equal(r.current.netSales || 0, sales.current.sales, 'selected dates reconcile between CCTV and POS');
  assert.equal(r.current.validPayments || 0, sales.current.transactions);
  cases++;
}
const august = D.analyze(S.periods.month);
assert.equal(august.current.netSales, 43085000);
assert.equal(august.current.validPayments, 867);
assert.equal(august.observedHours, 31 * 6);
assert.equal(august.comparable, true);
assert.equal(august.byHour.length, 6);
assert.equal(sum(august.byHour, 'passers'), august.current.passers);
for (const row of august.byHour) {
  const expected = august.current.records.filter(record => Number(record.slotId.slice(0, 2)) === Number(row.id));
  assert.equal(row.days, 31);
  assert.equal(row.averagePassers, sum(expected, 'passers') / 31);
  assert.equal(row.entryRate, D.ratio(sum(expected, 'entrants'), sum(expected, 'passers')));
  assert.equal(row.count, 31 * 6);
}
const currentMonth = D.analyze({ start: '2026-09-01', end: '2026-09-18' }, { timeWindow: '19-21' });
assert.equal(currentMonth.current.count, 18 * 12);
assert.equal(currentMonth.expected, 18 * 12);
assert.ok(currentMonth.complete && currentMonth.comparable);
assert.match(D.recoveryContext(currentMonth).scope, /2026-09-01~2026-09-18.*19:00~21:00/);
for (const [stamp, expectedWindow] of [['2026-09-18T07:59:00Z', 'all'], ['2026-09-18T08:00:00Z', '17-19'], ['2026-09-18T09:59:00Z', '17-19'], ['2026-09-18T10:00:00Z', '19-21'], ['2026-09-18T12:00:00Z', '21-23'], ['2026-09-18T14:00:00Z', 'all']]) {
  assert.equal(D.defaultTimeWindow(new Date(stamp)), expectedWindow, 'KST two-hour boundary ' + stamp);
}
for (const window of D.timeWindows) {
  const selected = D.analyze(S.periods.month, { days: [1, 3], timeWindow: window.id });
  assert.equal(selected.bySlot.length, window.id === 'all' ? 36 : 12);
  assert.equal(selected.expected, selected.dates.length * selected.bySlot.length);
  assert.ok(selected.selected.every(row => row.hour >= window.start && row.hour < window.end || selected.selectedSlots.some(slot => slot.id === row.slotId && slot.hour >= window.start && slot.hour < window.end)));
  assert.equal(sum(selected.bySlot, 'passers'), selected.current.passers);
  assert.equal(sum(selected.byWeekday, 'passers'), selected.current.passers);
  assert.equal(selected.current.netSales, sum(selected.current.records, 'netSales'));
  assert.match(D.recoveryContext(selected).scope, new RegExp(window.start + ':00~' + window.end + ':00'));
  assert.ok(selected.complete && selected.comparable);
}
const earlyOnlySource = D.rows.filter(row => row.date !== '2026-08-10' || row.slotId !== '22:00');
assert.equal(D.analyze(S.periods.month, { timeWindow: '17-19' }, earlyOnlySource).complete, true, 'missing data outside the selected window do not invalidate it');
const lateIncomplete = D.analyze(S.periods.month, { timeWindow: '21-23' }, earlyOnlySource);
assert.equal(lateIncomplete.unavailable.length, 1);
assert.equal(lateIncomplete.complete, false);
assert.equal(lateIncomplete.comparison, null);
assert.equal(lateIncomplete.byWeekday.find(row => row.id === '1').days, 4);
assert.equal(lateIncomplete.byHour.find(row => row.id === '22').days, 30, 'one missing ten-minute record excludes that date from the hour average');
assert.equal(lateIncomplete.byHour.find(row => row.id === '21').days, 31, 'complete other hours retain all dates');
assert.ok(lateIncomplete.byHour.every(row => row.previous === null), 'incomplete coverage withholds period comparisons');
assert.ok(D.recoveryContext(lateIncomplete).findings.every(item => item.status === 'insufficient' && item.action === ''));
const removeDate = '2026-08-10';
const missing = D.analyze(S.periods.month, {}, D.rows.filter(row => row.date !== removeDate));
assert.equal(missing.unavailable.length, 36);
assert.equal(missing.comparable, false);
assert.equal(missing.byWeekday.find(row => row.id === '1').days, 4, 'one missing Monday is excluded from Monday daily averages');
const target = D.rows.find(row => row.date === removeDate);
for (const status of ['missing', 'occluded']) {
  const partial = D.analyze(S.periods.month, {}, D.rows.map(row => row.id === target.id ? { ...row, status, analyzedMinutes: 0 } : row));
  assert.equal(partial.unavailable.length, 1);
  assert.equal(partial.comparison, null);
  assert.equal(partial.current.count, 31 * 36 - 1);
}
const partialMinutes = D.analyze(S.periods.month, {}, D.rows.map(row => row.id === target.id ? { ...row, analyzedMinutes: 5 } : row));
assert.equal(partialMinutes.unavailable.length, 1, 'partially observed bins are excluded rather than treated as a complete ten minutes');
const zero = D.analyze(S.periods.month, {}, D.rows.map(row => ({ ...row, passers: 0, dwellers: 0, entrants: 0, validPayments: 0, netSales: 0, directionA: 0, directionB: 0, dwellShort: 0, dwellMedium: 0, dwellLong: 0, dwellSeconds: 0 })));
assert.equal(zero.current.entryRate, null);
assert.equal(zero.current.purchaseRate, null);
assert.equal(zero.current.customerAverage, null);
assert.equal(zero.peak, null);
assert.equal(zero.insights.length, 0);
const marketRecovery = D.recoveryContext(august);
assert.equal(marketRecovery.source, 'market');
assert.equal(marketRecovery.title, '상권분석');
assert.match(marketRecovery.scope, /2026-08-01~2026-08-31 · 모든 요일/);
assert.deepEqual(marketRecovery.findings.map(item => item.id), august.insights.map(item => 'market-' + item.id));
for (const [index, finding] of marketRecovery.findings.entries()) {
  assert.equal(finding.title, august.insights[index].title);
  assert.ok(finding.evidence.includes(august.insights[index].text), 'actions retain the exact diagnostic numbers');
  assert.equal(finding.status, 'ready');
  assert.ok(finding.action.length > 0);
  assert.match(finding.caveat, /생성한 CCTV/);
}
const selectedRecovery = D.recoveryContext(D.analyze(S.periods.month, { days: [3, 1] }));
assert.match(selectedRecovery.scope, /월·수/);
assert.notDeepEqual(selectedRecovery.findings.map(item => item.evidence), marketRecovery.findings.map(item => item.evidence), 'selected weekdays change recovery evidence');
const missingRecovery = D.recoveryContext(missing);
assert.ok(missingRecovery.findings.length > 0);
assert.ok(missingRecovery.findings.every(item => item.status === 'insufficient' && item.action === '' && item.caveat.includes('관측 누락')));
assert.ok(!missingRecovery.findings.some(item => item.id === 'market-entry-change'), 'incomplete periods never claim a decline');
const missingPreviousRecovery = D.recoveryContext(D.analyze(S.periods.month, {}, D.rows.filter(row => row.date !== august.previousStart)));
assert.ok(missingPreviousRecovery.findings.every(item => item.status === 'ready' && item.caveat.includes('증감 비교는 보류')));
assert.ok(!missingPreviousRecovery.findings.some(item => item.id === 'market-entry-change'));
const noObservationRecovery = D.recoveryContext(D.analyze({ start: '2030-01-01', end: '2030-01-02' }));
assert.deepEqual(noObservationRecovery.findings, []);
assert.match(noObservationRecovery.reason, /관측 자료가 없습니다/);
assert.deepEqual(D.recoveryContext(zero).findings, []);
assert.match(D.recoveryContext(zero).reason, /통행이 0건/);
const linesByReceipt = new Map(), paidBySlot = new Map(), entriesBySlot = new Map();
for (const row of S.records) linesByReceipt.set(row.transactionId, (linesByReceipt.get(row.transactionId) || 0) + row.netAmount);
for (const transaction of S.transactions) {
  assert.equal(transaction.netAmount, linesByReceipt.get(transaction.id));
  assert.ok(transaction.enteredAt < transaction.paidAt, 'the fictional entry precedes payment; ten-minute ratios are not individual conversion rates');
  const paymentKey = transaction.date + ':' + transaction.slotId, entryKey = transaction.date + ':' + transaction.entrySlotId;
  entriesBySlot.set(entryKey, (entriesBySlot.get(entryKey) || 0) + transaction.partySize);
  if (transaction.status === 'paid') {
    const summary = paidBySlot.get(paymentKey) || { count: 0, amount: 0 };
    summary.count++; summary.amount += transaction.netAmount; paidBySlot.set(paymentKey, summary);
  } else assert.equal(transaction.netAmount, 0);
}
for (const row of D.rows) {
  const key = row.date + ':' + row.slotId, payments = paidBySlot.get(key) || { count: 0, amount: 0 };
  assert.equal(row.validPayments, payments.count);
  assert.equal(row.netSales, payments.amount);
  assert.ok(row.entrants >= (entriesBySlot.get(key) || 0));
  assert.ok(row.passers >= row.dwellers && row.dwellers >= row.entrants);
  assert.equal(row.directionA + row.directionB, row.passers);
  assert.equal(row.dwellShort + row.dwellMedium + row.dwellLong, row.dwellers);
}
const recovery = S.analyzeRecovery();
const recoveryDay = D.analyze(S.customPeriod(recovery.analysisDate, recovery.analysisDate));
assert.equal(sum(recovery.slots, 'netSales'), recoveryDay.current.netSales);
assert.equal(sum(recovery.slots, 'validPayments'), recoveryDay.current.validPayments);
const finance = S.financialIndex(new Date('2026-09-03T09:00:00Z'));
const daily = S.analyze({ start: finance.start, end: finance.asOf }).daily;
assert.equal(finance.value, daily.reduce((total, row) => total + Math.max(0, Math.min(100, 100 - row.expense / row.sales * 100)), 0) / 30);
assert.equal(S.financialIndex(new Date('2026-06-10T09:00:00Z')).value, null);
console.log('PASS ' + cases + ' CCTV filter cases; 10-minute accounting, 122-day receipt/entry reconciliation, missing and zero data, shared recovery, and 30-day financial reference');
