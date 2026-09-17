'use strict';
const assert = require('node:assert/strict');
const D = require('../meeting-data.js');
const A = require('../sales-diagnosis-data.js');
const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] || 0), 0);
const selections = [{}, { days: [1, 3, 5] }, { days: ['0', '6'], hour: '21' }, { category: 'food' },
  { category: 'food', subcategory: 'grill' }, { category: 'food', subcategory: 'meal', hour: '19' },
  { category: 'drink', subcategory: 'soft' }, { item: 'pork-belly', days: [2, 4], hour: '17' },
  { item: 'ribs' }, { dayType: 'weekend' }, { category: 'food', subcategory: 'soft' }];
let cases = 0;
for (const period of Object.values(D.periods)) for (const comparison of ['weekday', 'previous']) for (const selection of selections) {
  const filters = { ...selection, comparison }, result = A.analyze(D, period, filters);
  const weekdaySet = new Set((filters.days || []).map(Number));
  const allowedItems = D.menu.filter(item => (!filters.item || item.id === filters.item) && (!filters.category || item.category === filters.category) && (!filters.subcategory || item.subcategory === filters.subcategory)).map(item => item.id);
  const expected = D.records.filter(row => row.date >= period.start && row.date <= period.end && allowedItems.includes(row.itemId)
    && row.hour >= result.range.start && row.hour < result.range.end && (!weekdaySet.size || weekdaySet.has(A.weekday(row.date)))
    && (filters.dayType !== 'weekend' || [0, 6].includes(A.weekday(row.date))));
  assert.equal(result.current.sales, sum(expected, 'netAmount'));
  assert.equal(result.current.sales, sum(result.products, 'sales'));
  assert.equal(result.current.sales, sum(result.slots, 'sales'));
  assert.equal(result.current.sales, sum(result.daily, 'sales'));
  assert.equal(result.current.sales, sum(result.rows, 'netAmount'));
  assert.equal(result.current.units, sum(expected, 'netQuantity'));
  const receiptIds = new Set(expected.filter(row => row.netAmount > 0).map(row => row.transactionId));
  assert.equal(result.current.transactions, receiptIds.size);
  assert.equal(result.current.customerAverage, receiptIds.size ? result.current.sales / receiptIds.size : null);
  assert.equal(result.current.average, result.dayCount ? result.current.sales / result.dayCount : null);
  assert.equal(result.finance.expense, D.analyze(period).expense, 'whole-store expenses are independent of all POS filters');
  assert.equal(result.finance.sales, D.analyze(period).sales, 'the financial difference uses whole-store sales');
  assert.ok(result.previousEnd < period.start);
  if (comparison === 'weekday') assert.equal(A.weekday(result.previousStart), A.weekday(period.start));
  if (result.effects) assert.ok(Math.abs(result.effects.quantity + result.effects.amount - result.effects.total) < .000001);
  assert.deepEqual(result.heatmap[0].cells.map(row => [row.hour, row.endHour]), [[17, 19], [19, 21], [21, 23]]);
  assert.ok(result.heatmap.every(day => day.cells.every(cell => cell.average == null || Number.isFinite(cell.average))));
  cases++;
}
const month = A.analyze(D, D.periods.month);
assert.equal(month.current.sales, 43085000, 'known shared August fixture');
assert.equal(month.current.transactions, 867);
assert.equal(month.current.sales, D.analyze(D.periods.month).sales);
assert.ok(month.current.transactions < sum(month.products, 'transactions'), 'a mixed receipt is counted once in the total, but once per matching product');
assert.ok(month.products.some(row => row.delta >= 0) && month.products.some(row => row.delta < 0), 'the fictional restaurant has mixed results, not an invented universal crisis');
const first = A.analyze(D, D.customPeriod('2026-06-01', '2026-06-07'));
assert.equal(first.comparisonAvailable, false);
assert.equal(first.previous, null);
assert.equal(first.effects, null);
const missingDate = '2026-08-10';
const partial = A.analyze({ ...D, records: D.records.filter(row => row.date !== missingDate) }, D.periods.month);
assert.deepEqual(partial.excludedDates, [missingDate]);
assert.equal(partial.dayCount, 30);
assert.equal(partial.currentComplete, false);
assert.equal(partial.previous, null);
assert.equal(partial.daily.find(row => row.date === missingDate).sales, null);
const zeroSaleDay = { ...D, records: D.records.filter(row => row.date !== missingDate),
  transactions: D.transactions.filter(row => row.date !== missingDate),
  coverage: D.coverage.map(row => row.date === missingDate ? { ...row, expectedRecords: 0, expectedTransactions: 0 } : row) };
const knownZero = A.analyze(zeroSaleDay, D.periods.month);
assert.equal(knownZero.currentComplete, true);
assert.equal(knownZero.dayCount, 31, 'a fully observed open day with no sales stays in the denominator');
assert.equal(knownZero.daily.find(row => row.date === missingDate).sales, 0);
const missingLine = A.analyze({ ...D, records: D.records.filter(row => row.id !== D.records.find(row => row.date === missingDate).id) }, D.periods.month);
assert.equal(missingLine.currentComplete, false, 'one missing receipt line makes the collection incomplete');
const missingPayment = A.analyze({ ...D, transactions: D.transactions.filter(row => row.id !== D.transactions.find(row => row.date === missingDate).id) }, D.periods.month);
assert.equal(missingPayment.currentComplete, false, 'a missing payment record must not inflate the per-receipt average');
const closed = A.analyze({ ...D, coverage: D.coverage.map(row => row.date === missingDate ? { ...row, open: false } : row) }, D.periods.month);
assert.equal(closed.dayCount, 30, 'closed days are excluded from the operating-day average');
const noSelectedDay = A.analyze(D, D.customPeriod('2026-08-30', '2026-08-30'), { days: [1] });
assert.equal(noSelectedDay.current.average, null);
assert.equal(noSelectedDay.current.customerAverage, null);
assert.equal(noSelectedDay.current.transactions, 0);
const zero = A.analyze({ ...D, records: D.records.map(row => ({ ...row, netAmount: 0, netQuantity: 0 })) }, D.periods.month);
assert.equal(zero.current.customerAverage, null);
assert.equal(zero.current.unitAmount, null);
assert.equal(zero.effects, null);
assert.equal(A.change(10, 0), null);
assert.equal(D.customPeriod('2026-09-31', '2026-09-31'), null);
for (const row of D.records) assert.equal(row.netAmount, row.netQuantity * row.unitPrice);
console.log('PASS ' + cases + ' sales period/filter cases; unique receipts, matching totals, zero-sale versus missing days, two-hour groups, and whole-store expenses');
