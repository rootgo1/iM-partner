const assert = require('node:assert/strict');
const A = require('../aftercare.js');
const D = require('../meeting-data.js');

const monthly = A.monthlyComparison(D);
assert.equal(monthly.complete, true);
assert.deepEqual([monthly.previous.start,monthly.previous.end], ['2026-07-01','2026-07-31']);
assert.deepEqual([monthly.current.start,monthly.current.end], ['2026-08-01','2026-08-31']);
for (const month of [monthly.previous, monthly.current]) {
  const rows = D.records.filter(row=>row.date>=month.start && row.date<=month.end);
  assert.equal(month.days,31);
  assert.equal(month.daily.length,31);
  assert.equal(month.sales,rows.reduce((n,row)=>n+row.netAmount,0),'월 매출은 모든 품목·시간의 판매행 합계');
  assert.equal(month.sales,month.daily.reduce((n,day)=>n+day.sales,0),'일별 합계와 월 전체 합계 일치');
  assert.equal(month.units,rows.reduce((n,row)=>n+row.netQuantity,0));
}
assert.equal(monthly.previous.sales,42538000);
assert.equal(monthly.current.sales,43085000);
assert.equal(monthly.delta,547000);
assert.equal(monthly.rate,547000/42538000*100);
assert.equal(monthly.axisMax,50000000,'두 월 매출은 같은 0원 시작 눈금 사용');
const oldStorage = global.localStorage;
try {
  global.localStorage={getItem:()=>null};
  const html=A.render(D);
  for (const month of [monthly.previous, monthly.current]) {
    assert.ok(html.includes('width:'+(month.sales/monthly.axisMax*100).toFixed(4)+'%'),'표시된 매출과 막대 길이 일치');
  }
  assert.match(html,/\+1\.3%/);
  assert.match(html,/547,000원 증가/);
  assert.doesNotMatch(html,/실행 전 7일|실행 후 7일/,'기본 화면 비교기간은 월간으로 고정');
} finally {
  if(oldStorage===undefined) delete global.localStorage; else global.localStorage=oldStorage;
}
const missing={...D,records:D.records.filter(row=>row.date!=='2026-08-31')};
assert.equal(A.monthlyComparison(missing).complete,false);
assert.equal(A.monthlyComparison(missing).current.sales,null,'누락된 말일은 0매출로 간주하지 않음');
assert.equal(A.monthlyComparison(missing).delta,null);
assert.equal(A.monthlyComparison(missing).rate,null);
assert.deepEqual(A.monthlyComparison(missing).current.missing,['2026-08-31']);
const absentReceipt={...D,transactions:D.transactions.filter(row=>row.date!=='2026-07-01')};
assert.equal(A.monthlyComparison(absentReceipt).previous.complete,false,'영수증 수집 누락도 비교 불가');
const zero={...D,records:[],transactions:[],coverage:D.coverage.map(day=>({...day,expectedRecords:0,expectedTransactions:0}))};
assert.equal(A.monthlyComparison(zero).complete,true,'수집 완료한 0매출은 정상');
assert.equal(A.monthlyComparison(zero).rate,null,'0원 분모는 증감률 계산하지 않음');
assert.equal(A.monthlyComparison(zero).delta,0);
assert.equal(A.monthlyComparison(zero).axisMax,1);
assert.throws(()=>A.monthlyComparison(D,'2026-13','2026-08'),/비교 월/);
const outside={...D,records:[...D.records,{date:'2026-09-01',hour:19,netAmount:999999999,netQuantity:999}]};
assert.equal(A.monthlyComparison(outside).delta,monthly.delta,'다른 달의 판매는 월간 비교에 포함하지 않음');
console.log('aftercare monthly: full calendar months, receipt totals, daily sums, zero-based bars, missing data and zero denominator passed');
