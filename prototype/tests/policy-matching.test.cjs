'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const policy = require('../policy-matching.js');
const profile = { region: '대구 중구', industry: '음식점', employees: 3, age: '' };
const base = { id: 'base', regionScope: 'daegu', region: '대구', industry: '소상공인', category: '경영', title: '가게 지원', agency: '지원기관', conditions: { regions: ['대구'], industries: [] }, status: 'period', startsAt: '2026-09-01', deadline: '2026-09-30' };
test('Date status uses the disclosed source date, including deadline and no invented budget end', () => {
  assert.deepEqual(policy.availability(base, '2026-09-18'), { label: 'D−12', tone: 'open', eligible: true, days: 12 });
  assert.equal(policy.availability(base, '2026-09-30').label, '오늘 마감');
  assert.equal(policy.availability(base, '2026-10-01').eligible, false);
  assert.equal(policy.availability(base, '2026-08-31').label, '접수 예정');
  assert.equal(policy.availability({ ...base, status: 'budget', deadline: null }, '2026-09-18').label, '잔여 예산 확인');
  assert.equal(policy.availability({ ...base, startsAt: null, deadline: null }, '2026-09-18').label, '접수 일정 확인');
});
test('Confirmed district, industry, employee and age mismatches are excluded while missing details remain unconfirmed', () => {
  const notices = [base,
    { ...base, id: 'district', conditions: { regions: ['대구'], districts: ['수성구'] } },
    { ...base, id: 'industry', conditions: { regions: ['대구'], industries: ['제조업'] } },
    { ...base, id: 'headcount', conditions: { regions: ['대구'], maxEmployees: 2 } },
    { ...base, id: 'age', conditions: { regions: ['대구'], minAge: 18, maxAge: 39 } },
    { ...base, id: 'closed', status: 'closed' }];
  assert.deepEqual(policy.recommendations(notices, profile, '2026-09-18').map(p => p.id).sort(), ['age', 'base']);
  assert.equal(policy.matches(notices[4], profile).find(row => row.name === '대표자 나이').status, '확인 필요');
  assert.equal(policy.matches(base, profile).find(row => row.name === '직원 수').status, '별도 조건 확인');
  assert.deepEqual(policy.recommendations(notices, { ...profile, age: 50 }, '2026-09-18').map(p => p.id), ['base']);
  assert.equal(policy.matches({ ...base, regionScope: 'nationwide', region: '전국', conditions: { regions: ['전국'] } }, { ...profile, region: '부산' })[0].status, '일치');
});
test('Selection caps at ten before searching, all notices remain accessible, fewer matches are never padded', () => {
  const items = Array.from({ length: 18 }, (_, i) => ({ ...base, id: String(i + 1).padStart(2, '0'), title: '공고 ' + (i + 1), priority: 20 - i, category: i === 15 ? '특수' : '경영' }));
  const selected = policy.recommendations(items, profile, '2026-09-18');
  assert.equal(selected.length, 10);
  assert.equal(policy.filter(selected, '공고 16', 'all').length, 0);
  assert.equal(policy.filter(selected, '', '특수').length, 0);
  assert.equal(policy.filter(items, '공고 16', 'all').length, 1);
  assert.equal(policy.filter(items, '', 'all').length, 18);
  assert.equal(policy.recommendations(items.slice(0, 3), profile, '2026-09-18').length, 3);
  assert.equal(items.length, 18);
});
