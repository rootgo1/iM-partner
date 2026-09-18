'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const UI = require('../nearby-events.js');
const { createServer } = require('../../server/preview-server.cjs');
const center = UI.DEFAULT_LOCATION;
const event = (id, patch = {}) => ({ id, name: id, lat: center.lat, lng: center.lng, startDate: '2026-09-18', endDate: '2026-09-20', ...patch });

test('event dates are original dates and include start/end day, invalid dates are unknown', () => {
  assert.equal(UI.eventStatus(event('a'), '2026-09-17').id, 'upcoming');
  assert.equal(UI.eventStatus(event('a'), '2026-09-18').id, 'ongoing');
  assert.equal(UI.eventStatus(event('a'), '2026-09-20').id, 'ongoing');
  assert.equal(UI.eventStatus(event('a'), '2026-09-21').id, 'ended');
  assert.equal(UI.eventStatus(event('a', { startDate: '2026-02-30' }), '2026-09-18').id, 'unknown');
  assert.equal(UI.eventStatus(event('a', { endDate: '2026-09-17' }), '2026-09-18').id, 'unknown');
  assert.equal(UI.eventStatus(event('a', { startDate: '', endDate: '' }), '2026-09-18').id, 'unknown');
});

test('nearby uses straight-line distances and never treats unverified coordinates as zero', () => {
  assert.equal(UI.distance(center, center), 0);
  assert.equal(UI.distance(center, { lat: null, lng: null }), null);
  assert.equal(UI.distance(center, { lat: '', lng: '' }), null);
  const oneDegree = UI.distance(center, { lat: center.lat + 1, lng: center.lng });
  assert.ok(oneDegree > 111 && oneDegree < 112);
  const events = [event('far', { lat: 36.5 }), event('unknown', { lat: null, lng: null }), event('near'), event('past', { startDate: '2025-09-18', endDate: '2025-09-20' })];
  const args = { date: '2026-09-18', period: 'future', radius: '5' };
  assert.deepEqual(UI.selectEvents(events, args).map(e => e.id), ['near']);
  assert.deepEqual(UI.selectEvents(events, { ...args, radius: 'all' }).map(e => e.id), ['near', 'far', 'unknown']);
  assert.equal(UI.selectEvents(events, { ...args, period: 'all', radius: 'all' }).length, 4);
  assert.equal(events[0].distanceKm, undefined, 'source data remains unmodified');
});

test('Kakao links share selected coordinates while keyless embedded map stays available', () => {
  const point = { lat: 35.87, lng: 128.6, name: '대구 행사' };
  assert.equal(new URL(UI.mapUrl(point)).searchParams.get('marker'), '35.87,128.6');
  assert.equal(new URL(UI.mapLink(point)).hostname, 'map.kakao.com');
  assert.ok(decodeURIComponent(UI.mapLink(point)).endsWith('/대구 행사,35.87,128.6'));
  assert.equal(new URL(UI.mapUrl({ lat: 0, lng: 0 })).searchParams.get('marker'), center.lat + ',' + center.lng);
  const html = UI.render({ location: { ...point, label: '<img onerror="alert(1)">', example: false } });
  assert.doesNotMatch(html, /<img|행사 자료 준비 중|관광공사/);
  assert.match(html, /&lt;img onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /data-ne-period/);
  assert.match(html, /data-ne-radius/);
});

test('static server exposes only the processed public event data, no credentials or event API', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  assert.equal((await fetch(origin + '/prototype/main-screen.html')).status, 200);
  const response = await fetch(origin + '/prototype/data/daegu-festivals.json');
  assert.equal(response.status, 200);
  assert.ok((await response.json()).events.length > 0);
  for (const hidden of ['/api/nearby-events?lat=35.8714&lng=128.6014', '/server/import-daegu-festivals.cjs', '/.env', '/prototype/tests/nearby-events.test.cjs']) {
    assert.equal((await fetch(origin + hidden)).status, 404, hidden);
  }
});
