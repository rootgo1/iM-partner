'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeCsv, parseCsv, isoDate, belongsToDaegu, safeWebsite, convertRecords } = require('../../server/import-daegu-festivals.cjs');

const sample = overrides => ({
  '축제명': '지역 축제', '개최장소': '산격대교 하단 일원', '축제시작일자': '2026-09-19', '축제종료일자': '2026-09-20',
  '축제내용': '음악, 공연', '주관기관명': '대구축제위원회', '전화번호': '053-000-0000', '홈페이지주소': 'https://example.org/',
  '소재지도로명주소': '대구광역시 북구 산격동 1477-1', '소재지지번주소': '', '위도': '35.90943011', '경도': '128.6039524',
  '데이터기준일자': '2026-07-01', '제공기관명': '대구광역시 북구', ...overrides
});
const csv = rows => {
  const headers = Object.keys(rows[0]);
  const escape = value => '"' + String(value || '').replaceAll('"', '""') + '"';
  return '\uFEFF' + [headers, ...rows.map(row => headers.map(header => row[header]))].map(row => row.map(escape).join(',')).join('\r\n');
};

test('CSV preserves comma, quoted text and multiline fields, supporting UTF-8 and EUC-KR', () => {
  const row = sample({ '축제내용': '첫째 줄, "인사"\n둘째 줄' });
  const raw = csv([row]);
  const decoded = decodeCsv(Buffer.from(raw));
  assert.equal(decoded.encoding, 'utf-8');
  assert.equal(parseCsv(decoded.text)[0]['축제내용'], '첫째 줄, "인사" 둘째 줄');
  assert.deepEqual(decodeCsv(Buffer.from([0xb0, 0xa1])), { encoding: 'euc-kr', text: '가' });
  assert.throws(() => parseCsv('a,b\n1,2'), /필수 열/);
  assert.throws(() => parseCsv(raw + '\r\n"unfinished'), /따옴표/);
  assert.throws(() => parseCsv(raw + '\r\n1,2'), /열 개수/);
});

test('Daegu venue addresses take priority over an organizer or provider name', () => {
  assert.equal(belongsToDaegu(sample()), true);
  assert.equal(belongsToDaegu(sample({ '소재지도로명주소': '서울특별시 중구 세종대로 110' })), false);
  assert.equal(belongsToDaegu(sample({ '소재지도로명주소': '', '소재지지번주소': '대구광역시 군위군 군위읍 용대리 424' })), true);
  assert.equal(belongsToDaegu(sample({ '소재지도로명주소': '', '소재지지번주소': '' })), true);
  assert.equal(belongsToDaegu(sample({ '소재지도로명주소': '', '소재지지번주소': '', '위도': '', '경도': '' })), false);
});

test('Real source years stay unchanged; invalid dates and reverse ranges are rejected', () => {
  assert.equal(isoDate('2024-02-29'), '2024-02-29');
  assert.equal(isoDate('2026-02-29'), null);
  const result = convertRecords([
    sample({ '축제시작일자': '2023-04-08', '축제종료일자': '2023-04-08' }),
    sample({ '축제시작일자': '2026-02-29' }),
    sample({ '축제종료일자': '2026-09-18' })
  ]);
  assert.equal(result.events[0].startDate, '2023-04-08');
  assert.equal(result.metadata.invalidRows, 2);
});

test('Merge same festival and dates, keeping original venue coordinates over newer administrative points', () => {
  const result = convertRecords([
    sample({ '축제명': '금호강 바람소리길축제', '축제종료일자': '2026-09-19' }),
    sample({ '축제명': '2026 금호강 바람소리길 축제', '축제종료일자': '2026-09-19', '소재지도로명주소': '대구광역시 북구 옥산로 65', '위도': '35.8856843', '경도': '128.5827802', '데이터기준일자': '2026-07-30' }),
    sample({ '축제명': '금호강 바람소리길축제', '축제시작일자': '2025-09-19', '축제종료일자': '2025-09-19' })
  ]);
  assert.equal(result.events.length, 2);
  const event = result.events.find(event => event.startDate === '2026-09-19');
  assert.equal(event.lat, 35.90943011);
  assert.equal(event.locationAccuracy, 'venue');
  assert.equal(event.sourceUpdatedAt, '2026-07-30');
  assert.equal(event.sourceCount, 2);
  assert.equal(event.sourceRecords[1].locationAccuracy, 'reference');
  assert.equal(result.metadata.duplicateRowsRemoved, 1);
  assert.equal(convertRecords([...result.events].slice(0, 0)).metadata.eventCount, 0);
});

test('Administrative and absent coordinates never become a nearby festival point', () => {
  const reference = convertRecords([sample({ '소재지도로명주소': '대구광역시 수성구 달구벌대로 2450', '개최장소': '수성못 일원' })]).events[0];
  assert.equal(reference.locationAccuracy, 'reference');
  assert.equal(reference.lat, null);
  assert.equal(reference.lng, null);
  assert.equal(reference.address, '');
  assert.ok(reference.rawAddress.includes('달구벌대로'));
  assert.equal(reference.referenceLat, 35.90943011);
  const missing = convertRecords([sample({ '위도': '', '경도': '' })]).events[0];
  assert.equal(missing.locationAccuracy, 'unavailable');
  assert.equal(missing.lat, null);
  const outside = convertRecords([sample({ '위도': '37.5', '경도': '127' })]).events[0];
  assert.equal(outside.lat, null);
  assert.equal(outside.sourceRecords[0].lat, 37.5);
});

test('Only safe web links are retained and generated IDs are stable across input order', () => {
  assert.equal(safeWebsite('javascript:alert(1)'), '');
  assert.equal(safeWebsite('https://user:pass@example.org'), '');
  assert.equal(safeWebsite('www.example.org'), 'https://www.example.org/');
  const a = sample(), b = sample({ '축제명': '다른 축제', '축제시작일자': '2027-01-01', '축제종료일자': '2027-01-01' });
  assert.deepEqual(convertRecords([a, b]).events.map(row => row.id), convertRecords([b, a]).events.map(row => row.id));
});

test('Bundled Daegu dataset keeps provenance, excludes administrative markers and preserves historical years', () => {
  const data = require('../data/daegu-festivals.json');
  assert.equal(data.metadata.totalSourceRows, 1305);
  assert.equal(data.metadata.matchedSourceRows, 56);
  assert.equal(data.metadata.eventCount, data.events.length);
  assert.equal(new Set(data.events.map(row => row.id)).size, data.events.length);
  assert.deepEqual(data.metadata.eventYears, ['2023', '2024', '2025', '2026', '2027']);
  assert.equal(data.events.reduce((sum, event) => sum + event.sourceCount, 0), 56);
  assert.ok(data.events.some(row => row.rawAddress.includes('군위군')));
  for (const event of data.events) {
    assert.ok(event.sourceRecords.every(row => row.address.startsWith('대구')));
    assert.equal(event.sourceCount, event.sourceRecords.length);
    if (event.locationAccuracy !== 'venue') assert.deepEqual([event.lat, event.lng], [null, null]);
    else assert.ok(event.lat > 35.55 && event.lat < 36.5 && event.lng > 128.25 && event.lng < 129.05);
  }
  const chimac = data.events.filter(row => row.name.includes('치맥') && row.startDate.startsWith('2026'));
  assert.equal(chimac.length, 1);
  assert.equal(chimac[0].sourceCount, 2);
  assert.ok(chimac[0].address.includes('공원순환로'));
  assert.equal(data.events.find(row => row.name.includes('수성못페스티벌')).lat, null);
});
