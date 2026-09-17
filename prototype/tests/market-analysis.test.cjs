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
