/* Local UI preview only. No map SDK, geolocation, place search, or API key access. */
(function (root) {
  'use strict';
  const U = root.IM_NEARBY_EVENTS || (typeof require === 'function' ? require('./nearby-events.js') : null);
  const RADII = [0.5, 1, 3, 5];
  const SCALE = 27, CX = 260, CY = 175;
  const viewState = { radius: 5, selected: null };
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const km = value => value < 1 ? Math.round(value * 1000) + 'm' : value.toFixed(1).replace(/\.0$/, '') + 'km';
  const radiusValue = value => RADII.includes(Number(value)) ? Number(value) : 5;
  const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  let dataPromise;

  // Points are invented around the sample store, never returned as real businesses.
  function fixtures(center) {
    return [[.35, 25], [.8, 155], [1.4, 280], [2.1, 70], [2.8, 215], [3.6, 330], [4.2, 130], [4.8, 250], [5.4, 45]].map(([range, bearing], index) => {
      const a = range / 6371, b = bearing * Math.PI / 180, lat = center.lat * Math.PI / 180, lng = center.lng * Math.PI / 180;
      const destLat = Math.asin(Math.sin(lat) * Math.cos(a) + Math.cos(lat) * Math.sin(a) * Math.cos(b));
      const destLng = lng + Math.atan2(Math.sin(b) * Math.sin(a) * Math.cos(lat), Math.cos(a) - Math.sin(lat) * Math.sin(destLat));
      return { id: 'demo-grill-' + index, name: '가상 고깃집 ' + String.fromCharCode(65 + index), industry: '고깃집', lat: destLat * 180 / Math.PI, lng: destLng * 180 / Math.PI, sourceType: 'synthetic_demo' };
    });
  }
  function selectBusinesses(rows, center, radius, industry = '고깃집') {
    const limit = radiusValue(radius);
    return rows.filter(row => row.industry === industry && row.id !== center.id)
      .map(row => ({ ...row, distanceKm: U.distance(center, row) }))
      .filter(row => row.distanceKm !== null && row.distanceKm <= limit + 1e-9)
      .sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, 'ko'));
  }
  function point(center, row) {
    const radians = Math.PI / 180, a = center.lat * radians, b = row.lat * radians, delta = (row.lng - center.lng) * radians;
    const bearing = Math.atan2(Math.sin(delta) * Math.cos(b), Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(delta));
    const range = U.distance(center, row);
    return { x: CX + range * Math.sin(bearing) * SCALE, y: CY - range * Math.cos(bearing) * SCALE };
  }
  function mapMarkup(center, rows, radius, storeName) {
    const blocks = [[18,20,90,62],[128,20,92,62],[300,20,91,62],[414,20,89,62],[18,107,90,78],[130,108,90,77],[300,107,91,78],[414,107,89,78],[18,221,90,106],[130,221,90,106],[300,221,91,106],[414,221,89,106]];
    return '<div class="nb-map" data-nb-map role="group" aria-label="' + esc(storeName) + ' 중심 반경 ' + km(radius) + ' 동종업소 배치 시연">' +
      '<svg viewBox="0 0 520 350" aria-hidden="true"><rect width="520" height="350" fill="#f1f4ed"/>' + blocks.map(([x,y,w,h], i) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="9" fill="' + (i === 3 || i === 8 ? '#dfeadd' : '#e4e9e1') + '"/>').join('') +
      '<path d="M250 0V350M0 202H520" stroke="#fff" stroke-width="25"/><path d="M250 0V350M0 202H520" stroke="#d8ded5" stroke-width="1.5" stroke-dasharray="5 7"/>' +
      '<circle data-nb-circle cx="' + CX + '" cy="' + CY + '" r="' + radius * SCALE + '" fill="#26846f" fill-opacity=".16" stroke="#278571" stroke-width="2"/>' +
      '<path d="M475 42V21m-6 9 6-9 6 9" stroke="#647b6e" stroke-width="1.8" fill="none"/><text x="475" y="57" text-anchor="middle" fill="#647b6e" font-size="10">N</text>' +
      '<path d="M24 310v6h27v-6" stroke="#536d60" fill="none" stroke-width="2"/><text x="24" y="333" fill="#536d60" font-size="11">1km · 시연 축척</text></svg>' +
      '<span class="nb-map-tag">가게 주변 배치 예시</span><span class="nb-radius-label" data-nb-radius-label>반경 ' + km(radius) + '</span>' +
      '<div data-nb-pins>' + rows.map((row, index) => {
        const p = point(center, row);
        return '<button type="button" class="nb-pin" data-nb-pin="' + esc(row.id) + '" style="left:' + (p.x / 520 * 100).toFixed(3) + '%;top:' + (p.y / 350 * 100).toFixed(3) + '%" aria-label="' + esc(row.name + ', 가게에서 ' + km(row.distanceKm)) + '" aria-pressed="false"><span>' + (index + 1) + '</span></button>';
      }).join('') + '</div><span class="nb-store" style="left:50%;top:50%"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 9 2-5h12l2 5M5 10v10h14V10M9 20v-6h6v6M3 9h18" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><span>우리 가게</span></span></div>';
  }
  function render(options = {}) {
    const configured = options.location || root.IM_MAP_CONFIG?.location;
    const center = U.validPoint(configured) ? { lat: Number(configured.lat), lng: Number(configured.lng) } : U.DEFAULT_LOCATION;
    const profile = options.profile || root.IM_MEETING_DEMO?.profile || {};
    const storeName = profile.storeName || '달구벌 고기마당';
    return '<article class="card v-card nb-card" data-nearby-businesses data-nb-lat="' + center.lat + '" data-nb-lng="' + center.lng + '" data-nb-store="' + esc(storeName) + '">' +
      '<div class="nb-header"><div><span class="nb-eyebrow">내 가게 중심으로 살펴보기</span><h3>주변 상권 동종업계</h3></div><span class="nb-demo">시연</span></div>' +
      '<p class="nb-location"><strong>' + esc(storeName) + '</strong><span>고깃집 · 예시 위치 기준</span></p>' +
      '<div class="nb-controls"><label>거리<select data-nb-radius aria-label="동종업소 검색 반경">' + RADII.map(value => '<option value="' + value + '"' + (value === viewState.radius ? ' selected' : '') + '>' + km(value) + ' 이내</option>').join('') + '</select></label><span data-nb-count role="status"></span></div>' +
      '<div data-nb-map-wrap></div><div class="nb-legend"><span><i class="nb-legend-store"></i>우리 가게</span><span><i class="nb-legend-peer"></i>동종업소</span><span><i class="nb-legend-radius"></i>선택 반경</span></div>' +
      '<p class="nb-selection" data-nb-selection aria-live="polite">핀을 누르면 가상 업소의 이름과 거리를 확인할 수 있습니다.</p>' +
      '<p class="nb-note">가게 위치와 동종업소는 시연용 예시이며 실제 검색 결과가 아닙니다.</p>' +
      '<section class="nb-festivals" aria-label="대구 행사 목록"><div class="nb-events-heading"><h4>대구 행사</h4><span data-nb-event-count>자료 확인 중</span></div><div data-nb-events aria-live="polite"><p class="nb-note">행사 자료를 불러오고 있습니다.</p></div><p class="nb-source" data-nb-source>전국문화축제표준데이터 · 대구 지역</p></section></article>';
  }
  function loadEvents() {
    if (!dataPromise) dataPromise = root.fetch('./data/daegu-festivals.json').then(response => {
      if (!response.ok) throw new Error('Local event data unavailable');
      return response.json();
    }).then(data => {
      if (!Array.isArray(data.events)) throw new Error('Invalid event records');
      return data;
    }).catch(error => { dataPromise = null; throw error; });
    return dataPromise;
  }
  async function mountEvents(card) {
    const target = card.querySelector('[data-nb-events]');
    try {
      const data = await loadEvents();
      if (!card.isConnected) return;
      const events = data.events.map(row => ({ ...row, status: U.eventStatus(row, today()) }));
      const statusOrder = { ongoing: 0, upcoming: 1, unknown: 2, ended: 3 };
      events.sort((a, b) => statusOrder[a.status.id] - statusOrder[b.status.id] || (a.status.id === 'ended' ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate)) || a.name.localeCompare(b.name, 'ko'));
      card.querySelector('[data-nb-event-count]').textContent = events.length + '개 기록';
      target.innerHTML = events.length ? '<ul class="nb-event-list" tabindex="0" aria-label="대구 행사 기록, 스크롤하여 전체 보기">' + events.map(row => '<li><div><strong>' + esc(row.name) + '</strong><small>' + esc(row.venue || row.address || '장소 미확인') + '</small></div><span class="nb-event-status ' + row.status.id + '">' + row.status.label + '</span></li>').join('') + '</ul>' : '<p class="nb-note">등록된 행사 기록이 없습니다.</p>';
      const dates = events.map(row => row.sourceUpdatedAt).filter(U.validDate).sort();
      card.querySelector('[data-nb-source]').textContent = '전국문화축제표준데이터' + (dates.length ? ' · 자료 기준 ' + dates[0] + '~' + dates.at(-1) : '') + '\n대구 전체 행사 목록 · 지도 반경과 별개 · 방문 전 주최 측 안내를 확인하세요.';
    } catch (_) {
      if (!card.isConnected) return;
      card.querySelector('[data-nb-event-count]').textContent = '불러오기 실패';
      target.innerHTML = '<p class="nb-note">행사 자료를 불러오지 못했습니다.</p><button type="button" class="nb-retry">다시 불러오기</button>';
      target.querySelector('button').onclick = () => mountEvents(card);
    }
  }
  function mount() {
    const card = root.document?.querySelector('[data-nearby-businesses]');
    if (!card || card.dataset.nbMounted) return;
    card.dataset.nbMounted = 'true';
    const center = { lat: Number(card.dataset.nbLat), lng: Number(card.dataset.nbLng) };
    const rows = fixtures(center), map = card.querySelector('[data-nb-map-wrap]');
    function paint() {
      const selected = selectBusinesses(rows, center, viewState.radius);
      if (!selected.some(row => row.id === viewState.selected)) viewState.selected = null;
      card.querySelector('[data-nb-count]').textContent = '동종업소 ' + selected.length + '곳';
      map.innerHTML = mapMarkup(center, selected, viewState.radius, card.dataset.nbStore);
      function pick(id) {
        viewState.selected = id;
        const row = selected.find(item => item.id === id);
        map.querySelectorAll('[data-nb-pin]').forEach(pin => pin.setAttribute('aria-pressed', String(pin.dataset.nbPin === id)));
        card.querySelector('[data-nb-selection]').textContent = row ? row.name + ' · 고깃집 · 우리 가게에서 직선거리 ' + km(row.distanceKm) : selected.length ? '핀을 누르면 가상 업소의 이름과 거리를 확인할 수 있습니다.' : '선택한 반경에 동종업소 예시가 없습니다.';
      }
      map.querySelectorAll('[data-nb-pin]').forEach(pin => pin.addEventListener('click', () => pick(pin.dataset.nbPin)));
      pick(viewState.selected);
    }
    card.querySelector('[data-nb-radius]').addEventListener('change', event => { viewState.radius = radiusValue(event.target.value); paint(); });
    paint();
    mountEvents(card);
  }
  const api = { render, mount, selectBusinesses, fixtures, point, RADII };
  root.IM_NEARBY_BUSINESSES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
