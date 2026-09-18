'use strict';
const assert = require('node:assert/strict');
const D = require('../market-analysis-data.js');
const stamp = value => new Date(value);
const at = '2026-09-18T10:10:00Z'; // 19:10 KST; only 19:00~19:10 has completed.
const live = D.getLiveSnapshot(stamp(at));
assert.equal(live.date, '2026-09-18');
assert.equal(live.slot.id, '19:00');
assert.equal(live.slot.label, '(19:00)');
assert.equal(live.status, 'available');
assert.equal(live.current.count, 1);
assert.equal(live.current.passers, D.rows.find(row => row.date === live.date && row.slotId === '19:00').passers);
assert.equal(live.baseline.days, 4);
assert.equal(live.sourceType, 'synthetic_demo');
assert.equal(live.camera.connected, false);
assert.match(live.sourceLabel, /실제 CCTV 미연결/);
assert.match(live.traffic.detail, /직전 4주 같은 요일.*4일.*20%/);
assert.equal(live.nextRefreshAt, '2026-09-18T10:20:00.000Z');
assert.deepEqual(live.byWeekday.map(row => row.id), ['1', '2', '3', '4', '5', '6', '0']);
assert.ok(live.byWeekday.every(row => row.days === 4 && row.averagePassers != null && row.entryRate != null));

// Once per completed ten minutes: an unfinished slot and later synthetic rows never leak into the current result.
const seen = new Set();
for (let minute = 0; minute < 60; minute++) {
  const now = stamp('2026-09-18T10:' + String(minute).padStart(2, '0') + ':35Z');
  const snapshot = D.getLiveSnapshot(now);
  const end = Date.parse(snapshot.date + 'T' + snapshot.slot.id + ':00+09:00') + 600000;
  assert.ok(end <= now.getTime());
  seen.add(snapshot.date + ':' + snapshot.slot.id);
}
assert.equal(seen.size, 6);
assert.equal(D.getLiveSnapshot(stamp('2026-09-18T10:09:59.999Z')).slot.id, '18:50');
assert.equal(D.getLiveSnapshot(stamp('2026-09-18T10:10:00.000Z')).slot.id, '19:00');
const withoutFuture = D.rows.filter(row => row.date < live.date || row.date === live.date && row.slotId <= '19:00');
assert.deepEqual(D.getLiveSnapshot(stamp(at), withoutFuture), live);
const beforeData = D.getLiveSnapshot(stamp('2026-05-01T10:10:00Z'));
assert.equal(beforeData.status, 'missing');
assert.equal(beforeData.current, null);
assert.equal(beforeData.baseline.days, 0);

// Missing, invalid, duplicate and partial latest intervals are unknown, not zero or stale prior observations.
const latest = row => row.date === live.date && row.slotId === live.slot.id;
const target = D.rows.find(latest);
const brokenSources = [
  D.rows.filter(row => !latest(row)),
  D.rows.map(row => latest(row) ? { ...row, status: 'missing', analyzedMinutes: 0 } : row),
  D.rows.map(row => latest(row) ? { ...row, analyzedMinutes: 5 } : row),
  D.rows.map(row => latest(row) ? { ...row, passers: null } : row),
  D.rows.map(row => latest(row) ? { ...row, entrants: null } : row),
  [...D.rows, target]
];
for (const source of brokenSources) {
  const snapshot = D.getLiveSnapshot(stamp(at), source);
  assert.equal(snapshot.current, null);
  assert.equal(snapshot.status, 'missing');
  assert.equal(snapshot.slot.id, '19:00');
  assert.equal(snapshot.traffic.level, 'unavailable');
}
const zero = D.getLiveSnapshot(stamp(at), D.rows.map(row => latest(row) ? { ...row, passers: 0, entrants: 0 } : row));
assert.equal(zero.current.passers, 0);
assert.equal(zero.current.entryRate, null);
assert.equal(zero.traffic.level, 'low');
const sparse = D.getLiveSnapshot(stamp(at), D.rows.filter(row => !(row.slotId === '19:00' && ['2026-09-11', '2026-09-04'].includes(row.date))));
assert.equal(sparse.baseline.days, 2);
assert.equal(sparse.baseline.averagePassers, null);
assert.equal(sparse.status, 'insufficient');
assert.ok(sparse.current);
assert.equal(sparse.traffic.level, 'unavailable');
const friday = sparse.byWeekday.find(row => row.id === '5');
assert.equal(friday.averagePassers, null);
assert.equal(friday.entryRate, null);
const zeroBaseline = D.getLiveSnapshot(stamp(at), D.rows.map(row => row.date < live.date && row.slotId === live.slot.id ? { ...row, passers: 0, entrants: 0 } : row));
assert.equal(zeroBaseline.status, 'insufficient');
assert.equal(zeroBaseline.traffic.level, 'unavailable');
for (const [passers, expected] of [[120, 'high'], [119, 'similar'], [100, 'similar'], [81, 'similar'], [80, 'low']]) {
  const uniform = D.rows.map(row => row.slotId === live.slot.id ? { ...row, passers: latest(row) ? passers : 100, entrants: 10 } : row);
  assert.equal(D.getLiveSnapshot(stamp(at), uniform).traffic.level, expected, 'traffic threshold at ' + passers);
}

// Off-hours show a dated last scheduled interval, never the next day's generated values.
const beforeOpening = D.getLiveSnapshot(stamp('2026-09-18T07:59:59Z'));
assert.equal(beforeOpening.status, 'off_hours');
assert.equal(beforeOpening.date, '2026-09-17');
assert.equal(beforeOpening.slot.id, '22:50');
assert.match(beforeOpening.traffic.detail, /2026-09-17 22:50/);
const firstPending = D.getLiveSnapshot(stamp('2026-09-18T08:05:00Z'));
assert.equal(firstPending.status, 'insufficient');
assert.equal(firstPending.current, null);
assert.equal(firstPending.slot, null);
const firstDone = D.getLiveSnapshot(stamp('2026-09-18T08:10:00Z'));
assert.equal(firstDone.slot.id, '17:00');
assert.equal(firstDone.status, 'available');
const afterClosing = D.getLiveSnapshot(stamp('2026-09-18T14:00:00Z'));
assert.equal(afterClosing.status, 'off_hours');
assert.equal(afterClosing.date, '2026-09-18');
assert.equal(afterClosing.slot.id, '22:50');
assert.match(afterClosing.traffic.text, /운영시간 밖/);

// The monthly report uses the last complete KST calendar month, not the live snapshot's month.
const period = D.lastCompleteMonth(stamp(at));
assert.equal(period.start, '2026-08-01');
assert.equal(period.end, '2026-08-31');
assert.equal(D.lastCompleteMonth(stamp('2026-08-31T14:59:59Z')).start, '2026-07-01');
assert.equal(D.lastCompleteMonth(stamp('2026-08-31T15:00:00Z')).start, '2026-08-01');
assert.equal(D.lastCompleteMonth(stamp('2027-01-01T00:00:00Z')).end, '2026-12-31');
assert.equal(D.lastCompleteMonth(stamp('2028-03-01T00:00:00Z')).end, '2028-02-29');
const monthly = D.monthlySummary(stamp(at), { timeWindow: '19-21' });
assert.equal(monthly.period.start, '2026-08-01');
assert.equal(monthly.period.end, '2026-08-31');
assert.equal(monthly.timeWindow.id, 'all');
assert.equal(monthly.selectedSlots.length, 36);
assert.equal(monthly.current.netSales, 43085000);
assert.equal(monthly.summaryInsights, monthly.insights);
assert.ok(monthly.insights.length > 0);
assert.ok(monthly.insights.every(item => !/체류|머무/.test(JSON.stringify(item))));
const recovery = D.recoveryContext(monthly);
assert.match(recovery.scope, /2026-08-01~2026-08-31/);
assert.ok(recovery.findings.every(item => item.status === 'ready' && item.action.length));
assert.ok(recovery.findings.every(item => !/체류|머무/.test(JSON.stringify(item))));
const unavailableMonth = D.monthlySummary(stamp('2026-05-18T10:10:00Z'));
assert.equal(unavailableMonth.insights.length, 0, 'no filler to force a fixed three insights');
assert.equal(unavailableMonth.current.passers, null);
const partialMonth = D.monthlySummary(stamp(at), {}, D.rows.filter(row => row.date !== '2026-08-03'));
assert.equal(partialMonth.complete, false);
assert.ok(D.recoveryContext(partialMonth).findings.every(item => item.status === 'insufficient' && item.action === ''));
console.log('PASS live 10-minute KST boundaries, future/missing/duplicate guards, four-week baselines, off-hours, completed-month report and recovery evidence');
