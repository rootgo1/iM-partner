'use strict';
// Usage: node server/import-daegu-festivals.cjs <source.csv> [prototype/data/daegu-festivals.json]
// Reads the source without changing it. No network or geocoding requests are made.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REQUIRED = ['축제명', '개최장소', '축제시작일자', '축제종료일자', '소재지도로명주소', '소재지지번주소', '위도', '경도', '데이터기준일자'];
const text = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
const isDaegu = value => /^대구(?:광역시|시)?(?:\s|$)/.test(text(value));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

function decodeCsv(bytes) {
  for (const encoding of ['utf-8', 'euc-kr']) {
    try { return { text: new TextDecoder(encoding, { fatal: true }).decode(bytes), encoding }; }
    catch (_) { /* National standard CSV downloads may use CP949 / EUC-KR. */ }
  }
  throw new Error('CSV 인코딩을 읽을 수 없습니다. UTF-8 또는 EUC-KR 파일을 사용하세요.');
}

function parseCsv(source) {
  source = String(source).replace(/^\uFEFF/, '');
  const rows = []; let row = [], value = '', quoted = false;
  const finish = () => { row.push(value); if (row.some(cell => cell.trim())) rows.push(row); row = []; value = ''; };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { value += '"'; i++; }
      else if (quoted || value.length === 0) quoted = !quoted;
      else value += char;
    } else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i++;
      finish();
    } else value += char;
  }
  if (quoted) throw new Error('CSV에 닫히지 않은 따옴표가 있습니다.');
  if (value || row.length) finish();
  if (!rows.length) throw new Error('CSV가 비어 있습니다.');
  const headers = rows.shift().map(text);
  const missing = REQUIRED.filter(name => !headers.includes(name));
  if (missing.length) throw new Error('필수 열이 없습니다: ' + missing.join(', '));
  if (new Set(headers).size !== headers.length) throw new Error('중복된 CSV 열 이름이 있습니다.');
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error('CSV ' + (index + 2) + '행의 열 개수가 다릅니다.');
    return Object.fromEntries(headers.map((name, i) => [name, text(values[i])]));
  });
}

function isoDate(value) {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(raw + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === raw ? raw : null;
}

function number(value) { return text(value) && Number.isFinite(Number(value)) ? Number(value) : null; }
function coordinates(row) {
  const lat = number(row['위도']), lng = number(row['경도']);
  // Broad bounds include Daegu's Gunwi-gun. Geographic membership is decided by address, not this box.
  return lat !== null && lng !== null && lat >= 35.55 && lat <= 36.50 && lng >= 128.25 && lng <= 129.05 ? { lat, lng } : null;
}

function belongsToDaegu(row) {
  const road = text(row['소재지도로명주소']), parcel = text(row['소재지지번주소']);
  if (road || parcel) return isDaegu(road) || isDaegu(parcel);
  // An organizer alone does not establish a festival's location outside Daegu.
  return isDaegu(row['제공기관명']) && Boolean(coordinates(row));
}

function normalizeName(name) {
  let value = text(name).toLowerCase().replace(/20\d{2}\s*년?/g, '').replace(/제\s*\d+\s*회/g, '').replace(/\(feel\)/g, '').replace(/[^a-z0-9가-힣]/g, '');
  // Equivalent labels in this source; only merged when both start and end dates also match.
  const aliases = {
    '대덕제대구앞산축제': '대구앞산축제', '대구앞산축제대덕제': '대구앞산축제',
    '동구여름축제두두썸동': '동구여름축제', '달구벌목민관부임마을축제': '달구벌목민관축제'
  };
  return aliases[value] || value;
}

// These source addresses are repeatedly supplied for unrelated venues. Do not present
// the administrative registration point as the event location or calculate a distance from it.
const REFERENCE_ADDRESSES = [
  /달성군청로\s*33(?:\s|$)/, /학산로\s*45(?:\s|$)/, /달구벌대로\s*2450(?:\s|$)/,
  /옥산로\s*65(?:\s|$)/, /이천로\s*51(?:\s|$)/, /국채보상로\s*257(?:\s|$)/,
  /아양로\s*20[07](?:\s|$)/, /국채보상로139길\s*1(?:\s|$)/, /공평로\s*88(?:\s|$)/
];
function isReference(row) {
  const address = text(row['소재지도로명주소']);
  return REFERENCE_ADDRESSES.some(pattern => pattern.test(address)) && !/(?:구청|군청|시청)/.test(text(row['개최장소']));
}

function safeWebsite(value) {
  let raw = text(value);
  if (!raw) return '';
  if (/^www\./i.test(raw)) raw = 'https://' + raw;
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch (_) { return ''; }
}

function sourceRecord(row) {
  const point = coordinates(row);
  return {
    name: row['축제명'], venue: row['개최장소'],
    address: row['소재지도로명주소'] || row['소재지지번주소'] || '',
    lat: number(row['위도']), lng: number(row['경도']),
    locationAccuracy: isReference(row) ? 'reference' : point ? 'venue' : 'unavailable',
    provider: row['제공기관명'] || '', sourceUpdatedAt: isoDate(row['데이터기준일자'])
  };
}

function convertRecords(records, source = {}) {
  const selected = records.filter(belongsToDaegu);
  const groups = new Map(); let invalidRows = 0;
  for (const row of selected) {
    const start = isoDate(row['축제시작일자']), end = isoDate(row['축제종료일자']);
    if (!text(row['축제명']) || !start || !end || end < start) { invalidRows++; continue; }
    const key = [normalizeName(row['축제명']), start, end].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const events = [...groups.entries()].map(([key, rows]) => {
    // Keep the latest description/name. Location selection is independent: a real venue
    // point takes precedence over newer administrative coordinates.
    const newest = [...rows].sort((a, b) => text(b['데이터기준일자']).localeCompare(text(a['데이터기준일자'])));
    const info = newest[0];
    const locationRank = row => isReference(row) ? 0 : coordinates(row) ? 2 : 1;
    const locationRow = [...newest].sort((a, b) => locationRank(b) - locationRank(a))[0];
    const reference = isReference(locationRow), point = reference ? null : coordinates(locationRow);
    const rawPoint = coordinates(locationRow);
    const rawAddress = locationRow['소재지도로명주소'] || locationRow['소재지지번주소'] || '';
    const pick = field => text(newest.find(row => text(row[field]))?.[field]);
    return {
      id: 'daegu-' + digest(key).slice(0, 14), name: info['축제명'], venue: locationRow['개최장소'] || info['개최장소'],
      address: reference ? '' : rawAddress, rawAddress,
      startDate: info['축제시작일자'], endDate: info['축제종료일자'],
      lat: point?.lat ?? null, lng: point?.lng ?? null,
      locationAccuracy: reference ? 'reference' : point ? 'venue' : 'unavailable',
      locationNote: reference ? '행사장과 다른 등록 주소·좌표로 보여 지도와 거리 계산에서 제외했습니다.' : point ? 'CSV에 등록된 행사장 좌표입니다.' : '원본에 행사장 좌표가 없습니다.',
      referenceLat: reference ? rawPoint?.lat ?? null : null, referenceLng: reference ? rawPoint?.lng ?? null : null,
      description: pick('축제내용'), organizer: pick('주관기관명') || pick('주최기관명'), contact: pick('전화번호'),
      website: newest.map(row => safeWebsite(row['홈페이지주소'])).find(Boolean) || '',
      sourceUpdatedAt: isoDate(info['데이터기준일자']), sourceCount: rows.length, sourceRecords: rows.map(sourceRecord)
    };
  }).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name, 'ko'));
  const dates = events.flatMap(event => [event.startDate, event.endDate]).sort();
  const updated = selected.map(row => isoDate(row['데이터기준일자'])).filter(Boolean).sort();
  const years = [...new Set(events.map(event => event.startDate.slice(0, 4)))].sort();
  const accuracyCounts = Object.fromEntries(['venue', 'reference', 'unavailable'].map(kind => [kind, events.filter(event => event.locationAccuracy === kind).length]));
  return {
    metadata: {
      title: '대구 문화축제', sourceName: '전국문화축제표준데이터', sourceFile: source.file || '전국문화축제표준데이터.csv',
      sourceEncoding: source.encoding || '', sourceSha256: source.sha256 || '', region: '대구광역시',
      extractionCriteria: '도로명·지번 주소가 대구인 행. 두 주소가 없으면 대구 제공기관과 대구 범위 좌표가 모두 있는 행.',
      totalSourceRows: records.length, matchedSourceRows: selected.length, invalidRows,
      duplicateRowsRemoved: selected.length - invalidRows - events.length, eventCount: events.length,
      coordinateCounts: accuracyCounts, eventYears: years,
      dateRange: { start: dates[0] || null, end: dates.at(-1) || null },
      sourceUpdatedRange: { start: updated[0] || null, end: updated.at(-1) || null },
      notes: ['원본의 행사 연도와 일정을 유지합니다.', '이름 표기가 같은 행사와 명백한 이름 변형은 시작일·종료일이 모두 같을 때만 병합합니다.', '시청·구청 등 등록 지점으로 의심되는 좌표는 지도와 거리 계산에서 제외합니다.', '일부 축제는 여러 장소에서 열리며 지도는 원본에 등록된 한 지점을 보여줍니다.']
    }, events
  };
}

function importFile(input, output = path.resolve(__dirname, '../prototype/data/daegu-festivals.json')) {
  const bytes = fs.readFileSync(input), decoded = decodeCsv(bytes);
  const result = convertRecords(parseCsv(decoded.text), { file: path.basename(input), encoding: decoded.encoding, sha256: digest(bytes) });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return result;
}

if (require.main === module) {
  if (!process.argv[2]) { console.error('사용법: node server/import-daegu-festivals.cjs <source.csv> [output.json]'); process.exitCode = 1; }
  else {
    try { console.log(JSON.stringify(importFile(process.argv[2], process.argv[3]).metadata, null, 2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
module.exports = { decodeCsv, parseCsv, isoDate, belongsToDaegu, normalizeName, safeWebsite, convertRecords, importFile };
