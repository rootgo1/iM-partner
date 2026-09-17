'use strict';
const assert = require('node:assert/strict');
const D = require('../meeting-data.js');
const now = new Date('2026-09-12T19:00:00+09:00');
const total = (rows, key) => rows.reduce((n, r) => n + r[key], 0);
const g = D.guidance(19, now);
assert.equal(g.period.start, '2026-08-14');
assert.equal(g.period.end, '2026-09-12');
assert.equal(g.count, 30);
const rows = D.records.filter(row => row.date >= g.period.start && row.date <= g.period.end);
assert.equal(g.average, total(rows.filter(row => row.hour === 19), 'netAmount') / 30, 'hourly guidance adds all six ten-minute bins');
assert.ok(Math.abs(g.share - total(rows.filter(row => row.hour === 19), 'netAmount') / total(rows, 'netAmount') * 100) < 1e-10);
const hours = [17, 18, 19, 20, 21, 22].map(hour => D.guidance(hour, now));
assert.ok(Math.abs(total(hours,'share')-100)<1e-10);
assert.ok(hours.every(row=>row.checks.length===2));
const opening = D.guidance(17, now);
assert.equal(opening.opening, true);
assert.match(opening.title, /첫 손님/);
assert.match(opening.text, /40~60분/);
assert.match(opening.text, /한산함을 뜻하지 않습니다/);
assert.notEqual(opening.checks[0].title, D.guidance(19, now).checks[0].title);
assert.match(D.guidance(22,now).checks[1].title,/다음 영업일/);
assert.equal(D.guidance(2,now).average,null);
assert.equal(D.guidance(19,new Date('2026-06-15T19:00:00+09:00')).average,null);
assert.equal(D.guidance(19,new Date('2026-05-31T19:00:00+09:00')).average,null);
assert.ok(!g.text.includes('7일'));
console.log('PASS rolling 30-day average, six hourly shares, opening payment lag, two contextual actions and missing data');

const c = D.neighborhoodInsights(now);
assert.equal(c.weekdayLabel,'토요일');
assert.equal(c.count,5, 'Aug 15/22/29 and Sep 5/12 are the five Saturdays in this window');
assert.deepEqual(c.slots.map(row => row.label), ['17~19시', '19~21시', '21~23시']);
const local = D.area.filter(row=>row.date>=c.period.start && row.date<=c.period.end && new Date(row.date+'T00:00:00Z').getUTCDay()===6);
const stores = D.merchantSales.filter(row=>row.date>=c.period.start && row.date<=c.period.end && new Date(row.date+'T00:00:00Z').getUTCDay()===6);
assert.equal(c.traffic,total(local,'traffic')/5);
assert.equal(c.consumption,total(stores,'amount')/5);
assert.equal(c.merchantCount,4);
assert.equal(D.neighborhoodInsights(new Date('2026-09-12T15:00:00Z')).weekdayLabel,'일요일');
assert.equal(D.neighborhoodInsights(new Date('2026-06-15T19:00:00+09:00')).slots.length,0);
console.log('PASS same-weekday cohorts, three two-hour aggregates, participating store scope and Seoul date rollover');

const insight = D.salesInsight(D.periods.month, now);
const analysis = D.analyze(D.periods.month);
const slot = analysis.slots.find(row => row.hour === 19);
assert.equal(insight.salesAverage, slot.sales / 31);
assert.equal(insight.storefrontAverage, slot.storefront / 31);
assert.equal(insight.share, slot.sales / analysis.sales * 100);
assert.equal(D.salesInsight(D.periods.month, new Date('2026-09-12T23:00:00+09:00')).status, 'off_hours');
assert.equal(D.salesInsight(D.periods.month, new Date('2026-09-12T22:59:00+09:00')).status, 'available');
assert.equal(D.salesInsight(D.periods.month, new Date('2026-09-12T16:59:00+09:00')).status, 'off_hours');
assert.equal(D.salesInsight({start:'2027-01-01',end:'2027-01-31',previousStart:'2026-12-01',previousEnd:'2026-12-31'}, now).status, 'no_data');
console.log('PASS current two-hour diagnosis: observed-day averages, same-period share, missing data and off-hours');

// Zero sales and missing collection are separate states; an empty amount cannot create a share.
const amounts = D.records.map(row => row.netAmount);
try {
  D.records.forEach(row => { row.netAmount = 0; });
  const zero = D.guidance(19, now);
  assert.equal(zero.count, 30);
  assert.equal(zero.average, null);
  assert.equal(zero.share, null);
  assert.equal(D.salesInsight(D.periods.month, now).status, 'no_data');
} finally { D.records.forEach((row, index) => { row.netAmount = amounts[index]; }); }
console.log('PASS zero sales do not manufacture hourly percentages or operating recommendations');
