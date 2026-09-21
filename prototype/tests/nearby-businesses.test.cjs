'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../nearby-events.js');
const B = require('../nearby-businesses.js');
const center = U.DEFAULT_LOCATION;

test('radius filters only same-industry locations, retains the boundary and excludes invalid coordinates', () => {
  const rows = B.fixtures(center);
  assert.deepEqual([.5, 1, 3, 5].map(radius => B.selectBusinesses(rows, center, radius).length), [1, 2, 5, 8]);
  const original = JSON.stringify(rows);
  const extras = [
    { ...rows[0], id: 'bakery', industry: '제과점' },
    { ...rows[0], id: 'invalid', lat: null },
    { ...rows[0], id: 'self' },
    { ...rows[0], id: 'boundary', lat: center.lat + (5 / 6371 * 180 / Math.PI), lng: center.lng }
  ];
  const selected = B.selectBusinesses([...rows, ...extras], { ...center, id: 'self' }, 5);
  assert.equal(selected.length, 9);
  assert.ok(selected.some(row => row.id === 'boundary'));
  assert.ok(selected.every((row, index) => !index || row.distanceKm >= selected[index - 1].distanceKm));
  assert.equal(JSON.stringify(rows), original);
  assert.equal(B.selectBusinesses(rows, center, 'all').length, 8, 'unsupported radius never expands beyond 5km');
});

test('pin distance on the drawing agrees with geographic distance, including a moved sample center', () => {
  for (const p of [center, { lat: 35.84, lng: 128.58 }]) {
    for (const row of B.fixtures(p)) {
      const point = B.point(p, row);
      assert.ok(Math.abs(Math.hypot(point.x - 260, point.y - 175) / 27 - U.distance(p, row)) < 1e-8);
    }
  }
});

test('UI uses the selected store name safely, without loading an external map', () => {
  const html = B.render({ profile: { storeName: '<img onerror="alert(1)">' } });
  assert.match(html, /주변 상권 동종업계/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img|<iframe|<script|data-ne-period|행사 일정/);
  assert.match(html, /실제 검색 결과가 아닙니다/);
});
