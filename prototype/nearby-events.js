(function (root) {
  'use strict';
  const DEFAULT_LOCATION = Object.freeze({ lat: 35.8714, lng: 128.6014, label: '대구 중구', example: true });
  const DATA_URL = './data/daegu-festivals.json';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const validPoint = p => p && p.lat !== null && p.lng !== null && p.lat !== '' && p.lng !== '' && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && Number(p.lat) >= 33 && Number(p.lat) <= 39 && Number(p.lng) >= 124 && Number(p.lng) <= 132;
  function location(options) {
    const p = options && options.location || root.IM_MAP_CONFIG && root.IM_MAP_CONFIG.location;
    return validPoint(p) ? { lat: Number(p.lat), lng: Number(p.lng), label: String(p.label || '설정한 가게 위치'), example: p.example !== false } : DEFAULT_LOCATION;
  }
  function mapUrl(point) {
    const p = validPoint(point) ? point : DEFAULT_LOCATION, lat = Number(p.lat), lng = Number(p.lng);
    return 'https://www.openstreetmap.org/export/embed.html?bbox=' + encodeURIComponent([lng - .012, lat - .008, lng + .012, lat + .008].join(',')) + '&layer=mapnik&marker=' + encodeURIComponent(lat + ',' + lng);
  }
  function mapLink(point) {
    const p = validPoint(point) ? point : DEFAULT_LOCATION;
    return 'https://map.kakao.com/link/map/' + encodeURIComponent(p.name || p.label || '행사 위치') + ',' + Number(p.lat) + ',' + Number(p.lng);
  }
  function today() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  function validDate(date) { return /^\d{4}-\d{2}-\d{2}$/.test(date || '') && Number.isFinite(Date.parse(date)) && new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date; }
  function eventStatus(event, date) {
    if (!validDate(event.startDate) || !validDate(event.endDate) || event.startDate > event.endDate) return { id: 'unknown', label: '일정 확인' };
    return event.endDate < date ? { id: 'ended', label: '종료' } : event.startDate > date ? { id: 'upcoming', label: '예정' } : { id: 'ongoing', label: '진행 중' };
  }
  function distance(a, b) {
    if (!validPoint(a) || !validPoint(b)) return null;
    const rad = n => Number(n) * Math.PI / 180, dlat = rad(b.lat - a.lat), dlng = rad(b.lng - a.lng);
    const v = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(Math.max(0, 1 - v)));
  }
  function selectEvents(events, options) {
    const center = location(options), date = options.date || today(), radius = Number(options.radius) || Infinity;
    return events.map(e => ({ ...e, distanceKm: distance(center, e), status: eventStatus(e, date) }))
      .filter(e => (options.period !== 'future' || ['ongoing', 'upcoming'].includes(e.status.id)) && (radius === Infinity || e.distanceKm !== null && e.distanceKm <= radius))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || String(b.startDate).localeCompare(String(a.startDate)) || a.name.localeCompare(b.name, 'ko'));
  }
  const formatDate = value => validDate(value) ? value.replaceAll('-', '.') : '일정 미확인';
  const dateRange = e => formatDate(e.startDate) + (e.endDate !== e.startDate ? ' – ' + formatDate(e.endDate) : '');
  const km = n => n == null ? '위치 확인 필요' : n < 1 ? Math.round(n * 1000) + 'm' : n.toFixed(1) + 'km';
  function safeUrl(value) { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch (_) { return ''; } }
  let dataPromise, sdkPromise;
  const viewState = { period: null, radius: null, selected: null };
  function loadData() {
    if (!dataPromise) dataPromise = root.fetch(DATA_URL).then(r => { if (!r.ok) throw new Error('CSV data unavailable'); return r.json(); }).then(data => {
      if (!Array.isArray(data.events)) throw new Error('Invalid event data');
      return data;
    }).catch(error => { dataPromise = null; throw error; });
    return dataPromise;
  }
  function loadKakao(key) {
    if (root.kakao && root.kakao.maps && root.kakao.maps.Map) return Promise.resolve(root.kakao.maps);
    if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
      const script = root.document.createElement('script');
      const timer = root.setTimeout(() => { script.remove(); reject(new Error('Map loading timed out')); }, 10000);
      script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=' + encodeURIComponent(key);
      script.onload = () => {
        if (!root.kakao || !root.kakao.maps) { root.clearTimeout(timer); reject(new Error('Map unavailable')); return; }
        root.kakao.maps.load(() => { root.clearTimeout(timer); resolve(root.kakao.maps); });
      };
      script.onerror = () => { root.clearTimeout(timer); script.remove(); reject(new Error('Map unavailable')); };
      root.document.head.appendChild(script);
    }).catch(error => { sdkPromise = null; throw error; });
    return sdkPromise;
  }
  function render(options) {
    const center = location(options);
    return '<article class="card v-card ne-card" data-nearby-events data-ne-lat="' + center.lat + '" data-ne-lng="' + center.lng + '" data-ne-example="' + center.example + '" data-ne-label="' + esc(center.label) + '">' +
      '<div class="ne-header"><div><span class="ne-eyebrow">대구 문화축제</span><h3>우리 동네 행사 지도</h3></div><span class="ne-range" data-ne-count>자료 확인 중</span></div>' +
      '<p class="ne-location">' + esc(center.label) + (center.example ? ' · 예시 위치 기준' : ' · 가게 위치 기준') + '<span>직선거리순</span></p>' +
      '<div class="ne-controls"><label>일정<select data-ne-period aria-label="행사 일정"><option value="future">진행·예정</option><option value="all">전체 기록</option></select></label><label>거리<select data-ne-radius aria-label="행사 거리"><option value="3">3km 이내</option><option value="5">5km 이내</option><option value="10">10km 이내</option><option value="all">대구 전체</option></select></label></div>' +
      '<div class="ne-map-wrap" data-ne-map-wrap><iframe class="ne-map" data-ne-map src="' + esc(mapUrl(center)) + '" title="' + esc(center.label) + ' 행사 지도" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>' +
      '<div class="ne-map-caption"><span data-ne-map-label>' + esc(center.label) + (center.example ? ' · 예시 위치' : ' · 가게 위치') + '</span><a data-ne-map-link href="' + esc(mapLink(center)) + '" target="_blank" rel="noopener noreferrer">카카오맵에서 보기 ↗</a></div>' +
      '<div class="ne-results" data-ne-results aria-live="polite"><div class="ne-status" data-ne-status="loading">행사 자료를 불러오고 있습니다.</div></div>' +
      '<div data-ne-detail></div><p class="ne-source" data-ne-source>전국문화축제표준데이터 · 대구 지역</p><p class="ne-attribution" data-ne-attribution>지도 · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap 기여자</a></p></article>';
  }
  function setupMap(card, center) {
    const wrap = card.querySelector('[data-ne-map-wrap]');
    const api = { provider: 'osm', entries: [], selected: null, map: null, overlays: [] };
    function focus(event) {
      api.selected = event;
      const point = validPoint(event) ? event : center;
      const name = validPoint(event) ? event.name : center.label + (center.example ? ' · 예시 위치' : '');
      card.querySelector('[data-ne-map-label]').textContent = validPoint(event) ? name : name + (event ? ' · 행사 위치 확인 필요' : '');
      const link = card.querySelector('[data-ne-map-link]');
      link.href = event && !validPoint(event) ? 'https://map.kakao.com/link/search/' + encodeURIComponent('대구 ' + (event.venue || event.name)) : mapLink({ ...point, name });
      link.textContent = event && !validPoint(event) ? '카카오맵에서 장소 찾기 ↗' : '카카오맵에서 보기 ↗';
      if (api.provider === 'kakao') { api.map.panTo(new root.kakao.maps.LatLng(point.lat, point.lng)); drawMarkers(); }
      else {
        const iframe = wrap.querySelector('iframe');
        if (iframe && iframe.getAttribute('src') !== mapUrl(point)) iframe.src = mapUrl(point);
        if (iframe) iframe.title = name + ' 위치 지도';
      }
    }
    function drawMarkers() {
      if (api.provider !== 'kakao') return;
      const maps = root.kakao.maps;
      api.overlays.forEach(o => o.setMap(null)); api.overlays = [];
      const store = root.document.createElement('span'); store.className = 'ne-store-pin'; store.textContent = center.example ? '기준 위치' : '우리 가게';
      api.overlays.push(new maps.CustomOverlay({ map: api.map, position: new maps.LatLng(center.lat, center.lng), content: store, yAnchor: 1.2, zIndex: 2 }));
      api.entries.forEach((event, index) => {
        if (!validPoint(event)) return;
        const pin = root.document.createElement('button'); pin.type = 'button'; pin.className = 'ne-kakao-pin' + (api.selected && api.selected.id === event.id ? ' is-selected' : ''); pin.textContent = String(index + 1); pin.setAttribute('aria-label', event.name + ' 행사 보기');
        pin.onclick = () => Array.from(card.querySelectorAll('[data-ne-event]')).find(b => b.dataset.neEvent === event.id)?.click();
        api.overlays.push(new maps.CustomOverlay({ map: api.map, position: new maps.LatLng(event.lat, event.lng), content: pin, yAnchor: 1.15, zIndex: api.selected && api.selected.id === event.id ? 4 : 3 }));
      });
    }
    const key = String(root.IM_MAP_CONFIG && root.IM_MAP_CONFIG.kakaoJavaScriptKey || '').trim();
    if (key) loadKakao(key).then(maps => {
      if (!card.isConnected) return;
      const canvas = root.document.createElement('div'); canvas.className = 'ne-map'; canvas.setAttribute('data-ne-map', ''); canvas.setAttribute('aria-label', '대구 행사 지도'); wrap.replaceChildren(canvas);
      api.map = new maps.Map(canvas, { center: new maps.LatLng(center.lat, center.lng), level: 6 }); api.provider = 'kakao';
      api.map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
      card.querySelector('[data-ne-attribution]').textContent = '지도 · Kakao';
      const observer = new root.ResizeObserver(() => { if (!card.isConnected) { observer.disconnect(); return; } api.map.relayout(); }); observer.observe(wrap);
      focus(api.selected);
    }).catch(() => { if (card.isConnected) card.querySelector('[data-ne-attribution]').innerHTML = '기본 지도 · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap 기여자</a>'; });
    return { update(events, selected) { api.entries = events; focus(selected); } };
  }
  async function mount() {
    const card = root.document && root.document.querySelector('[data-nearby-events]');
    if (!card || card.dataset.neMounted) return;
    card.dataset.neMounted = 'true';
    const center = { lat: Number(card.dataset.neLat), lng: Number(card.dataset.neLng), label: card.dataset.neLabel, example: card.dataset.neExample === 'true' };
    const map = setupMap(card, center), results = card.querySelector('[data-ne-results]');
    try {
      const data = await loadData(); if (!card.isConnected) return;
      const allEvents = data.events, date = today(), hasFuture = allEvents.some(e => ['ongoing', 'upcoming'].includes(eventStatus(e, date).id));
      if (!viewState.period) viewState.period = hasFuture ? 'future' : 'all';
      if (!viewState.radius) viewState.radius = selectEvents(allEvents, { location: center, date, radius: '5', period: viewState.period }).length ? '5' : 'all';
      function paint() {
        const entries = selectEvents(allEvents, { location: center, date, radius: viewState.radius, period: viewState.period });
        card.querySelector('[data-ne-period]').value = viewState.period; card.querySelector('[data-ne-radius]').value = viewState.radius;
        card.querySelector('[data-ne-count]').textContent = entries.length + '개 행사';
        const old = !hasFuture && viewState.period === 'all' ? '<p class="ne-history-note">오늘 이후 일정이 없어 등록된 행사 기록을 보여드립니다.</p>' : '';
        results.innerHTML = old + (entries.length ? '<ol class="ne-list">' + entries.map((e, i) => '<li><button type="button" class="ne-event" data-ne-event="' + esc(e.id) + '" aria-pressed="false"><span class="ne-event-pin">' + (i + 1) + '</span><span><strong>' + esc(e.name) + '</strong><small>' + esc(dateRange(e)) + '</small><small>' + esc(e.venue || e.address || '장소 미확인') + '</small></span><span class="ne-event-meta"><span class="ne-status-tag ' + e.status.id + '">' + e.status.label + '</span><span class="ne-distance">' + km(e.distanceKm) + '</span></span></button></li>').join('') + '</ol>' : '<div class="ne-status" data-ne-status="empty"><strong>조건에 맞는 행사가 없습니다.</strong><p>거리를 넓히거나 전체 기록을 확인해 보세요.</p><button type="button" class="ne-retry" data-ne-show-all>대구 전체 기록 보기</button></div>');
        const selected = entries.find(e => e.id === viewState.selected) || entries[0] || null;
        function pick(event) {
          viewState.selected = event && event.id;
          results.querySelectorAll('[data-ne-event]').forEach(button => button.setAttribute('aria-pressed', String(event && button.dataset.neEvent === event.id)));
          const detail = card.querySelector('[data-ne-detail]'), website = event && safeUrl(event.website);
          detail.innerHTML = event ? '<details class="ne-detail"><summary>선택 행사 상세 · ' + esc(event.name) + '</summary><div><p>' + esc(validPoint(event) ? event.address || event.venue || '주소 미확인' : event.venue || '장소 미확인') + '</p>' + (event.locationNote ? '<p>' + esc(event.locationNote) + '</p>' : '') + (event.description ? '<p>' + esc(event.description) + '</p>' : '') + '<p>' + esc([event.organizer, event.contact].filter(Boolean).join(' · ')) + '</p>' + (event.sourceUpdatedAt ? '<p>자료 기준일 ' + esc(event.sourceUpdatedAt) + '</p>' : '') + (website ? '<a href="' + esc(website) + '" target="_blank" rel="noopener noreferrer">행사 홈페이지 ↗</a>' : '') + '</div></details>' : '';
          map.update(entries, event);
        }
        results.querySelectorAll('[data-ne-event]').forEach(button => button.addEventListener('click', () => pick(entries.find(e => e.id === button.dataset.neEvent))));
        results.querySelector('[data-ne-show-all]')?.addEventListener('click', () => { viewState.period = 'all'; viewState.radius = 'all'; paint(); });
        pick(selected);
      }
      card.querySelector('[data-ne-period]').addEventListener('change', e => { viewState.period = e.target.value; paint(); });
      card.querySelector('[data-ne-radius]').addEventListener('change', e => { viewState.radius = e.target.value; paint(); });
      const dates = allEvents.map(e => e.sourceUpdatedAt).filter(validDate).sort();
      card.querySelector('[data-ne-source]').textContent = '전국문화축제표준데이터 · 대구 ' + allEvents.length + '건' + (dates.length ? ' · 자료 기준 ' + dates[0] + (dates.at(-1) !== dates[0] ? ' ~ ' + dates.at(-1) : '') : '') + '\n행사 일정은 원본 기준이며, 방문 전 주최 측 안내를 확인해 주세요.';
      paint();
    } catch (_) {
      if (!card.isConnected) return;
      card.querySelector('[data-ne-count]').textContent = '자료 확인 필요';
      results.innerHTML = '<div class="ne-status" data-ne-status="error"><strong>행사 자료를 불러오지 못했습니다.</strong><p>잠시 후 다시 확인해 주세요.</p><button type="button" class="ne-retry">다시 불러오기</button></div>';
      results.querySelector('button').onclick = () => { delete card.dataset.neMounted; mount(); };
    }
  }
  const api = { render, mount, mapUrl, mapLink, eventStatus, distance, selectEvents, validDate, validPoint, DEFAULT_LOCATION };
  root.IM_NEARBY_EVENTS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
