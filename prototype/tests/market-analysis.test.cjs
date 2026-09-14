'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../market-analysis-data.js');
const sum = (rows, key) => rows.reduce((n, row) => n + (row[key] || 0), 0);
const periods = [{ start: '2026-08-01', end: '2026-08-31' }, { start: '2026-08-27', end: '2026-09-02' }, { start: '2026-07-01', end: '2026-07-07' }, { start: '2026-08-30', end: '2026-08-30' }];
let cases = 0;
for (const period of periods) for (const camera of D.cameras) for (const dayType of ['all', 'weekday', 'weekend']) for (const comparison of ['previous', 'weekday']) {
  const r = D.analyze(period, { camera: camera.id, dayType, comparison });
  const valid = r.selected.filter(row => row.status === 'valid');
  assert.equal(r.current.passers, valid.length ? sum(valid, 'passers') : null);
  assert.equal(r.current.dwellers, valid.length ? sum(valid, 'dwellers') : null);
  assert.equal(r.current.entrants, camera.entry && valid.length ? sum(valid, 'entrants') : null);
  assert.equal(r.current.entryRate, D.ratio(r.current.entrants, r.current.passers));
  assert.equal(r.current.dwellRate, D.ratio(r.current.dwellers, r.current.passers));
  assert.equal(r.observedHours, valid.length * 2);
  assert.equal(r.current.count + r.unavailable.length, r.expected);
  assert.equal(sum(r.bySlot, 'passers'), r.current.passers || 0);
  assert.equal(sum(r.current.dwellBins.map(n => ({ n })), 'n'), r.current.dwellers || 0);
  assert.equal((r.current.directionA || 0) + (r.current.directionB || 0), r.current.passers || 0);
  if (r.comparison) assert.ok(r.complete && r.oldComplete);
  else assert.ok(r.bySlot.every(row => row.previous === null));
  if (comparison === 'weekday') assert.equal(D.weekday(r.previousStart), D.weekday(period.start));
  assert.ok(r.previousEnd < period.start);
  assert.ok(r.insights.every(insight => r.bySlot.some(slot => slot.id === insight.slotId && slot.count > 0)));
  cases++;
}
const month = D.analyze(periods[0]);
assert.ok(month.comparable);
assert.equal(month.peak.id, '18');
assert.ok(month.insights.some(row => row.id === 'entry-change'));
const partial = D.analyze(periods[0], { camera: 'alley' });
assert.equal(partial.unavailable.length, 2);
assert.equal(partial.comparable, false);
assert.equal(partial.current.entryRate, null);
assert.ok(partial.current.records.every(row => row.status === 'valid'));
assert.equal(D.analyze(periods[0], { comparison: 'weekday' }).comparable, false);
assert.equal(D.analyze(periods[0], { camera: 'gate' }).insights.length, 0);
assert.equal(D.analyze(periods[3], { dayType: 'weekday' }).current.passers, null);
const zero = D.analyze(periods[0], {}, D.rows.map(row => ({ ...row, passers: 0, dwellers: 0, entrants: 0, dwellShort: 0, dwellMedium: 0, dwellLong: 0, dwellSeconds: 0, directionA: 0, directionB: 0 })));
assert.equal(zero.current.passers, 0);
assert.equal(zero.current.entryRate, null);
assert.equal(zero.peak, null);
assert.equal(zero.insights.length, 0);
const missingDate = D.analyze(periods[0], {}, D.rows.filter(row => row.date !== '2026-08-10'));
assert.equal(missingDate.unavailable.length, 6);
assert.equal(missingDate.comparable, false);
// Numeric counts are observations, not inferred buyers or demographic labels.
for (const row of D.rows.filter(row => row.status === 'valid')) {
  assert.ok(row.passers >= row.dwellers && (row.entrants == null || row.passers >= row.entrants));
  assert.equal(row.directionA + row.directionB, row.passers);
  assert.equal(row.dwellShort + row.dwellMedium + row.dwellLong, row.dwellers);
}
const root = path.resolve(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'meeting-ui.js'), 'utf8');
const pdf = fs.readFileSync(path.join(root, 'report-pdf.js'), 'utf8');
assert.match(ui, /market: '상권분석'/);
assert.match(ui, /recovery: 'market'/);
assert.ok(!ui.includes('data-view="recovery"'));
assert.ok(!ui.includes("case 'start-recovery'"));
assert.match(pdf, /line\('회복전략 리포트'/);
// Protect the requested secretary scope: only report labels, no changed logic/content.
const baselinePath = path.resolve(root, '../tmp/market-analysis-baseline/meeting-ui.js');
if (fs.existsSync(baselinePath)) {
  const before = fs.readFileSync(baselinePath, 'utf8');
  const section = text => text.slice(text.indexOf('  function secretary()'), text.indexOf('  function field('));
  const renamed = section(before).replaceAll('PDF 요약본으로', '회복전략 리포트로').replaceAll('최종 요약 PDF', '회복전략 리포트 PDF').replaceAll('요약본 생성 중…', '회복전략 리포트 생성 중…').replaceAll('최종 요약본 분석이 완료되었습니다.', '회복전략 리포트가 생성되었습니다.').replaceAll('iM파트너_분석요약.pdf', 'iM파트너_회복전략_리포트.pdf');
  assert.equal(section(ui), renamed);
  const answer = text => text.slice(text.indexOf('  function answer('), text.indexOf('  function appendChat('));
  assert.equal(answer(ui), answer(before));
  assert.equal(pdf, fs.readFileSync(path.resolve(root, '../tmp/market-analysis-baseline/report-pdf.js'), 'utf8').replace("line('내 가게 분석 요약'", "line('회복전략 리포트'"));
}
console.log('PASS ' + cases + ' CCTV period/site/filter combinations; weighted ratios, direction/dwell reconciliation, missing/occluded/zero/out-of-view states, route migration and secretary naming-only scope');
