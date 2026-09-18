(function () {
  'use strict';
  const D = window.IM_MARKET_DATA;
  const state = { camera: 'front', days: [], multipleDays: false, comparison: 'weekday', timeWindow: 'all', chart: 'traffic', collapsed: window.innerWidth <= 1260 };
  let result, live, rerender, dialog, detailRows = [], detailPage = 0, extrasRenderer = null;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = value => value == null ? '—' : Math.round(value).toLocaleString('ko-KR');
  const decimal = value => value == null ? '—' : value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
  const pct = value => value == null ? '—' : value.toFixed(1) + '%';
  const button = (label, attrs, primary) => '<button type="button" class="v-button' + (primary ? ' primary' : '') + '" ' + attrs + '>' + label + '</button>';
  const badge = text => '<span class="v-tag neutral">' + text + '</span>';
  const card = (body, sourceLabel) => '<article class="card v-card ma-card">' + body + scope(sourceLabel) + '</article>';
  const wrap = (id, body) => '<div class="ma-panel" id="ma-' + id + '">' + body + '</div>';
  const heading = (title, text, first) => '<div class="ma-heading"><div><h2>' + title + '</h2><p class="v-subtitle">' + text + '</p></div>' + (first ? '' : button('분석 조건 ↑', 'data-ma-jump="0"')) + '</div>';
  const weekdays = [[1, '월'], [2, '화'], [3, '수'], [4, '목'], [5, '금'], [6, '토'], [0, '일']];
  const dayLabel = () => state.days.length ? weekdays.filter(([id]) => state.days.includes(id)).map(([, label]) => label).join('·') : '모든 요일';
  const scope = (sourceLabel = '매장 앞 CCTV', options = {}) => {
    const period = options.period || result.period;
    return '<p class="ma-scope ma-card-scope">' + esc('기간: ' + period.start + '~' + period.end + ' / ' + sourceLabel + ' / ' + (options.time || '전체 시간') + ' / ' + (options.days || dayLabel())) + '</p>';
  };
  const empty = text => '<div class="ma-empty"><strong>' + text + '</strong><p>해당 기간과 선택 요일의 관측 자료를 확인해 주세요.</p></div>';
  const dayButtons = () => '<div class="ma-day-field v-diagnosis-filter-field v-diagnosis-day-field"><div class="ma-day-label v-diagnosis-day-label"><span>월간 분석 요일</span><label class="ma-day-multiple v-diagnosis-multi-toggle"><input type="checkbox" id="ma-multiple-days" data-ma-multiple' + (state.multipleDays ? ' checked' : '') + '> 복수 선택</label></div><div class="ma-days v-diagnosis-day-buttons" role="group" aria-label="월간 분석 요일">' + button('전체', 'id="ma-day-all" data-ma-day="all" aria-pressed="' + !state.days.length + '"') + weekdays.map(([id, label]) => button(label, 'id="ma-day-' + id + '" data-ma-day="' + id + '" aria-pressed="' + state.days.includes(id) + '"')).join('') + '</div></div>';
  function filters() {
    const summary = ['매장 앞 CCTV', '전체 시간', dayLabel()].join(' / ');
    return '<div id="ma-filter-dock" class="ma-filter-dock v-diagnosis-filter-dock' + (state.collapsed ? ' is-collapsed' : '') + '"><div class="v-diagnosis-filter-heading"><div class="v-diagnosis-filter-summary"><strong>분석 필터</strong><span>' + esc(summary) + '</span></div><button type="button" id="ma-filter-toggle" class="ma-filter-toggle v-diagnosis-filter-toggle" data-ma-toggle aria-label="분석 필터 ' + (state.collapsed ? '펼치기' : '접기') + '" title="분석 필터 ' + (state.collapsed ? '펼치기' : '접기') + '" aria-expanded="' + !state.collapsed + '" aria-controls="ma-filter-fields"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 15 6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div id="ma-filter-fields" class="ma-filters ma-monthly-filters v-diagnosis-filter-fields"><div class="ma-fixed-camera v-diagnosis-filter-field v-diagnosis-fixed-field"><span>관측 지점</span><strong>매장 앞 CCTV</strong></div>' + dayButtons() + '<button type="button" class="v-button v-diagnosis-filter-reset" data-ma-reset>초기화</button></div></div>';
  }
  function metric(label, value, unit, note, key, change = '') {
    return '<article class="card metric-card ma-metric" data-ma-live-metric="' + key + '"><div class="metric-label">' + label + '</div><div class="metric-value">' + value + '<small>' + (value === '—' ? '' : unit) + '</small></div>' + (change || '<div class="ma-metric-comparison ma-metric-comparison--empty" aria-hidden="true"></div>') + '<p>' + note + '</p></article>';
  }
  function changeNote(value, baseline, percentagePoints) {
    const change = value == null || baseline == null ? null : percentagePoints ? value - baseline : D.rate(value, baseline);
    const rounded = change == null ? null : Math.round(change * 10) / 10;
    const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'neutral';
    const text = rounded == null ? '비교 자료 부족' : rounded === 0 ? '— 변동 없음' : (rounded > 0 ? '▲ ' : '▼ ') + Math.abs(rounded).toFixed(1) + (percentagePoints ? '%p' : '%');
    return '<div class="ma-metric-comparison"><strong class="ma-change is-' + direction + '">' + text + '</strong><span>같은 요일 평균 대비</span></div>';
  }
  function currentTime(snapshot) {
    const local = new Date(Date.parse(snapshot.asOf) + 9 * 60 * 60 * 1000);
    return String(local.getUTCHours()).padStart(2, '0') + ':' + String(local.getUTCMinutes()).padStart(2, '0');
  }
  function overview() {
    const current = live.current, slot = live.slot, label = slot ? slot.intervalLabel : '';
    const stale = live.status === 'off_hours';
    const headline = live.traffic?.text || '현재 구간의 관측 자료를 확인하고 있습니다.';
    const observed = current?.count ? num(current.passers) : '—';
    const entry = current?.count ? pct(current.entryRate) : '—';
    const detail = live.traffic?.detail || '표본이 부족하면 많고 적음을 판단하지 않습니다.';
    return wrap('overview', heading('상권 요약', '지금 우리 가게 앞 상황을 가장 최근 완료된 10분 관측으로 살펴봅니다.', true) +
      filters() +
      '<div class="ma-lead ma-live-lead" data-ma-live-status="' + esc(live.status) + '"><div><span class="v-tag">지금 우리 가게 앞 상황 (<time data-ma-clock datetime="' + esc(live.asOf) + '" aria-label="서울 현재 시각">' + currentTime(live) + '</time>)</span><h3>' + esc(headline) + '</h3><p class="ma-observation-time">' + (slot ? '관측 기준 · ' + esc(live.date) + ' ' + esc(label) + (stale ? ' · 마지막 완료 관측' : ' · 완료 구간') : '관측 기준 · 첫 구간 완료 대기') + '</p><p>' + esc(detail) + '</p></div>' + button('주변상권 진단 보기 →', 'data-ma-jump="3"', true) + '</div>' +
      '<div class="metric-grid ma-metrics ma-live-metrics">' + metric(stale ? '마지막 10분 통행 관측' : '최근 10분 통행 관측', observed, '건', current?.count ? '완료된 10분 구간의 통행 관측' : '현재 구간 자료 없음', 'passers', changeNote(current?.passers, live.baseline.averagePassers, false)) + metric('같은 요일 통행 평균', decimal(live.baseline.averagePassers), '건', '직전 4주 · 같은 요일·시간 · ' + live.baseline.days + '일 관측', 'averagePassers') + metric(stale ? '마지막 10분 입장률' : '최근 10분 입장률', entry, '', current?.count ? '입장 ' + num(current.entrants) + '건 ÷ 통행 ' + num(current.passers) + '건' : '현재 구간 자료 없음', 'entry', changeNote(current?.entryRate, live.baseline.entryRate, true)) + metric('같은 요일 입장률 평균', pct(live.baseline.entryRate), '', '직전 4주 · 같은 요일·시간 · ' + live.baseline.days + '일 관측', 'entryRate') + '</div>' +
      '<div class="ma-quality-strip"><div class="ma-quality-copy"><p class="ma-quality-status"><span><i class="' + (live.status === 'available' ? '' : 'warn') + '"></i>관측 10분 · 현재 시각 1분마다 갱신</span><span>' + (stale ? '영업시간 외 · 마지막 완료 관측 표시' : '관측 구간이 완료되면 반영합니다.') + '</span></p><p class="ma-summary-scope">' + esc('관측: ' + live.date + ' / ' + (label || '첫 구간 완료 대기') + ' / 매장 앞 CCTV') + '</p><p class="ma-summary-baseline">' + esc(live.baseline.start ? '평균 비교: ' + live.baseline.start + '~' + live.baseline.end + ' / 같은 요일·같은 10분 구간 / ' + live.baseline.days + '일 관측' : '평균 비교: 직전 4주 같은 요일·같은 구간의 자료 확인 중') + '</p></div>' + button('현재 관측 근거', 'data-ma-detail="live"' + (!current?.count ? ' disabled' : '')) + '</div>' +
      '<p class="ma-footnote">생성한 CCTV 분석 결과로 동작하는 시연입니다. 실제 카메라는 연결 전입니다. 요일 선택은 아래 기간 분석에만 적용합니다. 위 카드의 평균은 표시된 관측일과 같은 요일·같은 10분 구간을 비교합니다.</p>');
  }
  function trends() {
    return wrap('trends', heading('주변상권 진단', '자료가 있는 시간대의 흐름과 주변 행사를 함께 확인합니다.') +
      (extrasRenderer ? extrasRenderer(result, 'surroundings') : card(empty('주변상권 흐름을 불러오고 있습니다.'), '주변상권 표본')));
  }
  function behavior() {
    return wrap('behavior', heading('방문·결제 진단', '같은 기간의 통행 관측, 매장 입장, 결제 기록을 함께 살펴봅니다.') +
      (extrasRenderer ? extrasRenderer(result, 'conversion') : card(empty('통행과 결제 자료를 불러오고 있습니다.'), '매장 앞 CCTV · POS')));
  }
  function measure(row) { return state.chart === 'traffic' ? row?.averagePassers ?? null : row?.entryRate ?? null; }
  function measureText(value) { return state.chart === 'traffic' ? decimal(value) + (value == null ? '' : '건') : pct(value); }
  function comparisonBars(rows, kind) {
    const maximum = Math.max(1, ...rows.flatMap(row => [measure(row) || 0, measure(row.previous) || 0]));
    return '<div class="ma-trend-scroll" tabindex="0" role="region" aria-label="' + (kind === 'hour' ? '시간대별' : '요일별') + ' 비교 그래프"><div class="ma-bars">' + rows.map(row => '<button class="ma-bar-row" type="button" data-ma-detail="' + kind + '" data-value="' + row.id + '"' + (!row.count ? ' disabled' : '') + ' aria-label="' + row.label + ', 분석 기간 ' + measureText(measure(row)) + ', 비교 기간 ' + measureText(measure(row.previous)) + ', 집계 보기"><span>' + row.label + '<small>' + row.days + '일 관측</small></span><span class="ma-bar-pair" aria-hidden="true"><i style="width:' + (measure(row) || 0) / maximum * 100 + '%"></i><i class="old" style="width:' + (measure(row.previous) || 0) / maximum * 100 + '%"></i></span><span><b>' + measureText(measure(row)) + '</b><small>비교 ' + measureText(measure(row.previous)) + '</small></span></button>').join('') + '</div></div>';
  }
  function movements() {
    const metricLabel = state.chart === 'traffic' ? '통행 관측' : '입장률';
    return wrap('movements', heading('시간대·요일별 진단', '시간대와 요일별 흐름을 이전 기간과 나란히 비교합니다.') +
      '<div class="ma-chart-controls"><div role="group" aria-label="분석 지표">' + [['traffic', '통행 관측'], ['entry', '입장률']].map(([id, label]) => button(label, 'data-ma-chart="' + id + '" aria-pressed="' + (state.chart === id) + '"')).join('') + '</div><div class="ma-legend"><span><i></i>분석 기간</span><span><i class="old"></i>비교 기간</span></div></div><div class="ma-grid ma-trend-charts">' +
      card('<h3>시간대별 ' + metricLabel + '</h3><p class="v-subtitle">' + (state.chart === 'traffic' ? '10분 관측을 1시간으로 묶은 관측일 평균' : '1시간 전체 통행 대비 입장 비율') + '</p>' + comparisonBars(result.byHour, 'hour') + '<p class="ma-footnote">비교 기간: ' + esc(result.previousStart + '~' + result.previousEnd) + ' / 같은 요일 구성</p>') +
      card('<h3>요일별 ' + metricLabel + '</h3><p class="v-subtitle">' + (state.chart === 'traffic' ? '17~23시 전체가 관측된 날의 일평균' : '완전하게 관측된 날의 통행 대비 입장 비율') + '</p>' + comparisonBars(result.byWeekday, 'weekday') + '<p class="ma-footnote">비교 기간: ' + esc(result.previousStart + '~' + result.previousEnd) + ' / 같은 요일 구성</p>') + '</div><p class="ma-footnote">항목을 누르면 근거 집계를 볼 수 있습니다. 비교 기간에 누락이 있으면 비교값을 표시하지 않습니다. 통행에는 반복 통행이 포함될 수 있습니다.</p>');
  }
  function render() {
    const now = new Date();
    result = D.monthlySummary(now, state);
    live = D.getLiveSnapshot(now);
    return overview() + movements() + behavior() + trends();
  }
  // Called by the app's minute timer and visibility handler. Never recreate the map or the surrounding sections.
  function refreshLive(now = new Date()) {
    const root = document.getElementById('ma-overview');
    if (!root || !live) return;
    const previousKey = [live.date, live.slot?.id, live.status].join(':');
    live = D.getLiveSnapshot(now);
    if (previousKey === [live.date, live.slot?.id, live.status].join(':')) {
      const clock = root.querySelector('[data-ma-clock]');
      if (clock) { clock.textContent = currentTime(live); clock.setAttribute('datetime', live.asOf); }
      return;
    }
    const template = document.createElement('template');
    template.innerHTML = overview();
    for (const selector of ['.ma-live-lead', '.ma-live-metrics', '.ma-quality-strip']) {
      const previous = root.querySelector(selector), next = template.content.querySelector(selector);
      if (previous && next) previous.replaceWith(next);
    }
  }
  function jump(index) {
    const section = document.querySelectorAll('#viewRoot > .v-screen-section')[index];
    if (section) { section.scrollIntoView({ behavior: 'instant', block: 'start' }); section.focus({ preventScroll: true }); }
  }
  function refresh(id) {
    const root = document.getElementById('viewRoot'), top = root.scrollTop, pageY = window.scrollY;
    const offsets = Array.from(root.querySelectorAll('.v-screen-inner')).map(el => el.scrollTop);
    rerender(); root.scrollTop = top;
    root.querySelectorAll('.v-screen-inner').forEach((el, i) => { el.scrollTop = offsets[i] || 0; });
    window.scrollTo({ top: pageY, behavior: 'instant' });
    if (id) document.getElementById(id)?.focus({ preventScroll: true });
  }
  function detailTable() {
    const pages = Math.max(1, Math.ceil(detailRows.length / 8));
    detailPage = Math.max(0, Math.min(pages - 1, detailPage));
    return '<div class="v-table-wrap"><table class="v-table ma-detail-table"><caption>선택한 조건의 관측 집계</caption><thead><tr><th>날짜</th><th>시간</th><th>통행</th><th>입장</th><th>입장률</th></tr></thead><tbody>' + detailRows.slice(detailPage * 8, detailPage * 8 + 8).map(row => '<tr><td>' + row.date + '</td><td>(' + D.slots.find(slot => slot.id === row.slotId).label.slice(0, 5) + ')</td><td>' + num(row.passers) + '건</td><td>' + num(row.entrants) + '건</td><td>' + pct(D.ratio(row.entrants, row.passers)) + '</td></tr>').join('') + '</tbody></table></div><div class="ma-pagination"><span>' + num(detailRows.length) + '구간 · ' + (detailPage + 1) + '/' + pages + ' 페이지</span><div>' + button('이전', 'data-ma-page="' + (detailPage - 1) + '"' + (!detailPage ? ' disabled' : '')) + button('다음', 'data-ma-page="' + (detailPage + 1) + '"' + (detailPage === pages - 1 ? ' disabled' : '')) + '</div></div>';
  }
  function showDetail(kind, value) {
    let title = '월간 분석에 사용한 관측', predicate = () => true;
    if (kind === 'slot') { title = '(' + D.slots.find(slot => slot.id === value).label.slice(0, 5) + ') 관측'; predicate = row => row.slotId === value; }
    const group = kind === 'hour' ? result.byHour.find(row => row.id === value) : kind === 'weekday' ? result.byWeekday.find(row => row.id === value) : null;
    if (group) title = group.label + ' 관측';
    const records = kind === 'live' ? live.current?.records || [] : group ? group.records : result.current.records;
    if (kind === 'live') title = '최근 완료 관측 ' + (live.slot?.label || '');
    detailRows = records.filter(predicate).slice().sort((a, b) => b.date.localeCompare(a.date) || a.slotId.localeCompare(b.slotId)); detailPage = 0;
    const totals = D.summarize(detailRows, true);
    const scopeOptions = {};
    if (kind === 'live') { scopeOptions.period = { start: live.date, end: live.date }; scopeOptions.time = live.slot?.intervalLabel || '관측 구간 대기'; scopeOptions.days = ['일', '월', '화', '수', '목', '금', '토'][D.weekday(live.date)] + '요일'; }
    if (kind === 'slot') scopeOptions.time = D.slots.find(slot => slot.id === value)?.label;
    if (kind === 'hour' && group) scopeOptions.time = group.label.replace(/^(\d+)~(\d+)시$/, '$1시~$2시');
    if (kind === 'weekday' && group) scopeOptions.days = group.label;
    document.getElementById('ma-dialog-title').textContent = title;
    document.getElementById('ma-dialog-content').innerHTML = '<div class="ma-detail-totals"><span>통행 합계 <b>' + num(totals.passers) + '건</b></span><span>입장 합계 <b>' + num(totals.entrants) + '건</b></span><span>입장률 <b>' + pct(totals.entryRate) + '</b></span></div><p class="ma-footnote">원본 영상이나 개인별 이동 기록이 아닌 생성 분석 집계입니다.</p><div id="ma-detail-rows">' + detailTable() + '</div>' + scope('매장 앞 CCTV', scopeOptions);
    dialog.showModal();
  }
  function bind(callback) {
    rerender = callback;
    dialog = document.createElement('dialog'); dialog.className = 'v-modal ma-modal'; dialog.id = 'ma-dialog'; dialog.setAttribute('aria-labelledby', 'ma-dialog-title'); dialog.setAttribute('data-lenis-prevent', '');
    dialog.innerHTML = '<div class="ma-row">' + badge('생성 CCTV 분석 결과') + button('닫기', 'data-ma-close aria-label="관측 집계 닫기"') + '</div><h2 id="ma-dialog-title"></h2><div id="ma-dialog-content"></div>';
    document.body.append(dialog);
    document.addEventListener('change', event => {
      if (!event.target.hasAttribute('data-ma-multiple')) return;
      state.multipleDays = event.target.checked;
      if (!state.multipleDays && state.days.length > 1) state.days = [state.days.at(-1)];
      refresh('ma-multiple-days');
    });
    document.addEventListener('click', event => {
      const el = event.target.closest('[data-ma-jump], [data-ma-reset], [data-ma-day], [data-ma-chart], [data-ma-detail], [data-ma-close], [data-ma-page], [data-ma-evidence], [data-ma-toggle]');
      if (!el) return;
      if (el.hasAttribute('data-ma-jump')) jump(Number(el.dataset.maJump));
      if (el.hasAttribute('data-ma-toggle')) { state.collapsed = !state.collapsed; refresh('ma-filter-toggle'); }
      if (el.hasAttribute('data-ma-reset')) { Object.assign(state, { camera: 'front', days: [], multipleDays: false, comparison: 'weekday', timeWindow: 'all', chart: 'traffic' }); refresh('ma-day-all'); }
      if (el.hasAttribute('data-ma-day')) {
        const selected = el.dataset.maDay, day = Number(selected);
        state.days = selected === 'all' ? [] : !state.multipleDays ? [day] : state.days.includes(day) ? state.days.filter(value => value !== day) : [...state.days, day];
        refresh('ma-day-' + selected);
      }
      if (el.hasAttribute('data-ma-chart')) { state.chart = el.dataset.maChart; refresh(); document.querySelector('[data-ma-chart="' + state.chart + '"]')?.focus({ preventScroll: true }); }
      if (el.hasAttribute('data-ma-detail')) showDetail(el.dataset.maDetail, el.dataset.value);
      if (el.hasAttribute('data-ma-close')) dialog.close();
      if (el.hasAttribute('data-ma-page')) { detailPage = Number(el.dataset.maPage); const target = document.getElementById('ma-detail-rows'); target.innerHTML = detailTable(); target.querySelector('button:not(:disabled)')?.focus({ preventScroll: true }); }
      if (el.hasAttribute('data-ma-evidence')) showDetail('slot', el.dataset.maEvidence);
    });
  }
  window.IM_MARKET_ANALYSIS = { render, bind, refreshLive, getRecoveryContext() { return D.recoveryContext(D.monthlySummary(new Date(), state)); }, setExtrasRenderer(callback) { extrasRenderer = typeof callback === 'function' ? callback : null; } };
})();
