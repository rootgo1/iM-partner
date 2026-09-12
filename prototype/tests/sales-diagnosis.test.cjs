'use strict';
const assert = require('node:assert/strict');
const D = require('../meeting-data.js');
const A = require('../sales-diagnosis-data.js');
const sum = (rows, key) => rows.reduce((n, row) => n + row[key], 0);
let cases = 0;
for (const period of Object.values(D.periods)) {
  for (const comparison of ['previous', 'weekday']) {
    for (const item of ['all', ...D.menu.map(row => row.id)]) {
      for (const hour of A.ranges.map(row => row.id)) {
        for (const dayType of ['all', 'weekday', 'weekend']) {
          const result = A.analyze(D, period, { comparison, item, hour, dayType });
          assert.equal(result.current.sales, sum(result.rows, 'netAmount'));
          assert.equal(result.current.sales, sum(result.products, 'sales'));
          assert.equal(result.current.sales, sum(result.slots, 'sales'));
          assert.equal(result.current.sales, sum(result.daily, 'sales'));
          assert.equal(result.current.units, sum(result.rows, 'netQuantity'));
          assert.equal(result.current.sales, D.records.filter(row => row.date >= period.start && row.date <= period.end && (item === 'all' || row.itemId === item) && row.hour >= result.range.start && row.hour < result.range.end && (dayType === 'all' || (dayType === 'weekend') === [0, 6].includes(A.weekday(row.date)))).reduce((n, row) => n + row.netAmount, 0));
          assert.ok(result.previousEnd < period.start, 'comparison must not overlap current period');
          if (comparison === 'weekday') assert.equal(A.weekday(result.previousStart), A.weekday(period.start));
          if (result.effects) {
            assert.ok(Math.abs(result.effects.quantity + result.effects.amount - (result.current.sales - result.previous.sales)) < .000001);
            assert.equal(sum(result.products, 'delta'), result.current.sales - result.previous.sales);
          }
          if (result.current.unitAmount != null) assert.equal(result.current.unitAmount, result.current.sales / result.current.units);
          assert.equal(result.finance.expense, D.analyze(period).expense, 'costs remain whole-store, irrespective of POS filters');
          assert.ok(result.heatmap.every(row => row.cells.every(cell => cell.average == null || Number.isFinite(cell.average))));
          cases++;
        }
      }
    }
  }
}
const missing = A.analyze(D, D.customPeriod('2026-07-01', '2026-07-07'));
assert.equal(missing.comparisonAvailable, false);
assert.equal(missing.previous, null);
assert.equal(missing.effects, null);
assert.equal(missing.actions.length, 0);
assert.ok(missing.daily.every(row => row.previous === null));
const partial = A.analyze(D, D.customPeriod('2026-07-15', '2026-08-15'));
assert.equal(partial.comparisonAvailable, false, 'partial previous periods must not masquerade as a complete comparison');
const none = A.analyze(D, D.customPeriod('2026-08-30', '2026-08-30'), { dayType: 'weekday' });
assert.equal(none.rows.length, 0);
assert.equal(none.current.average, null);
assert.equal(none.current.unitAmount, null);
assert.equal(none.actions.length, 0);
const zeroSource = { ...D, records: D.records.map(row => ({ ...row, netAmount: 0, netQuantity: 0 })) };
const zero = A.analyze(zeroSource, D.periods.month);
assert.equal(zero.current.sales, 0);
assert.equal(zero.current.unitAmount, null);
assert.equal(zero.effects, null);
assert.equal(A.change(10, 0), null);
const original = A.analyze(D, D.periods.month);
assert.equal(original.current.sales, D.analyze(D.periods.month).sales, 'default total agrees with home and existing reports');
assert.ok(original.actions.length > 0);
assert.ok(original.actions.every(action => action.kind !== 'item' || original.products.some(row => row.id === action.value && row.delta < 0)));
console.log('PASS ' + cases + ' filter/period combinations; reconciliation, exact effects, missing/partial/empty/zero cases, action evidence and whole-store expense scope');
