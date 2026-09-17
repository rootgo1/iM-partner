(function () {
  'use strict';
  const D = window.IM_MARKET_DATA;
  const state = { camera: 'front', days: [], comparison: 'weekday', chart: 'traffic', chartHour: 'all' };
  let result, rerender, dialog, detailRows = [], detailPage = 0, extrasRenderer = null;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = value => value == null ? '—' : Math.round(value).toLocaleString('ko-KR');
  const decimal = value => value == null ? '—' : value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
  const pct = value => value == null ? '—' : value.toFixed(1) + '%';
  const delta = (value, unit) => '<span class="ma-change ' + (value > 0 ? 'is-up' : value < 0 ? 'is-down' : 'is-neutral') + '">' + (value > 0 ? '▲ ' : value < 0 ? '▼ ' : '') + Math.abs(value).toFixed(1) + unit + '</span>';
  const pp = (value, before) => value == null || before == null ? '비교 불가' : delta(value - before, '%p');
  const change = (value, before) => before == null || value == null ? '비교 불가' : before === 0 ? '기준값 0 · 증감률 미산정' : delta(D.rate(value, before), '%');
  const button = (label, attrs, primary) => '<button type="button" class="v-button' + (primary ? ' primary' : '') + '" ' + attrs + '>' + label + '</button>';
  const badge = (text, amber) => '<span class="v-tag ' + (amber ? 'amber' : 'neutral') + '">' + text + '</span>';
  const card = body => '<article class="card v-card ma-card">' + body + '</article>';
  const options = (rows, value) => rows.map(([id, label]) => '<option value="' + id + '"' + (id === value ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
  const select = (label, key, rows) => '<label class="ma-field">' + label + '<select class="v-select" id="ma-' + key + '" data-ma-select="' + key + '">' + options(rows, state[key]) + '</select></label>';
  const wrap = (id, body) => '<div class="ma-panel" id="ma-' + id + '">' + body + '</div>';
  const heading = (index, title, text) => '<div class="ma-heading"><div><span class="ma-kicker">' + index + ' / 상권분석</span><h2>' + title + '</h2><p class="v-subtitle">' + text + '</p></div>' + (index === '01' ? badge('CCTV 분석 결과 · 생성 데이터') : button('분석 조건 ↑', 'data-ma-jump="0"')) + '</div>';
  const weekdays = [[1, '월'], [2, '화'], [3, '수'], [4, '목'], [5, '금'], [6, '토'], [0, '일']];
  const dayLabel = () => state.days.length ? weekdays.filter(([id]) => state.days.includes(id)).map(([, label]) => label).join('·') : '모든 요일';
  const scope = () => '<p class="ma-scope">매장 전면 · ' + esc(result.period.start + '~' + result.period.end) + ' · ' + dayLabel() + ' · 17:00~23:00</p>';
  const empty = text => '<div class="ma-empty"><strong>' + text + '</strong><p>기간이나 요일을 변경해 확인해 주세요.</p></div>';
  const dayButtons = () => '<div class="ma-day-field"><span>요일 <small>복수 선택 · 해제하면 전체</small></span><div class="ma-days" role="group" aria-label="분석 요일">' + weekdays.map(([id, label]) => button(label, 'id="ma-day-' + id + '" data-ma-day="' + id + '" aria-pressed="' + state.days.includes(id) + '"')).join('') + '</div></div>';
  function metric(label, value, unit, note) {
    return '<article class="card metric-card ma-metric"><div class="metric-label">' + label + '</div><div class="metric-value">' + value + '<small>' + (value === '—' ? '' : unit) + '</small></div><p>' + note + '</p></article>';
  }
  function overview() {
    const c = result.current, p = result.comparison, peak = result.peak;
    const noData = !result.camera.connected ? '이 관측 지점은 아직 연결되지 않았습니다.' : !result.dates.length ? '선택한 요일에 해당하는 날짜가 없습니다.' : !c.count ? '분석 가능한 관측 구간이 없습니다.' : null;
    const headline = noData || (peak ? peak.label + ', 사람들의 움직임이 가장 많습니다.' : '유효 관측 구간에서 통행이 관측되지 않았습니다.');
    const sub = noData ? '기간이나 요일을 선택해 CCTV 분석 결과 예시를 확인하세요.' : peak ? peak.label + ' 통행은 같은 10분 구간의 1일 평균 ' + decimal(peak.averagePassers) + '건입니다. 머무는 행동과 매장 입장을 함께 살펴보세요.' : '자료 누락과 통행 0건을 구분합니다. 현재 유효 집계의 통행 수는 0건입니다.';
    return wrap('overview', heading('01', '거리의 움직임을, 상권의 단서로', 'CCTV 관측 구역의 통행·체류·입장 변화를 읽습니다.') +
      '<div class="ma-filters"><div class="ma-fixed-camera"><span>관측 지점</span><strong>매장 전면</strong></div>' + dayButtons() + button('조건 초기화', 'data-ma-reset') + '</div>' +
      '<div class="ma-period"><span>분석 <b>' + result.period.start + ' ~ ' + result.period.end + '</b></span><span>비교 <b>' + result.previousStart + ' ~ ' + result.previousEnd + '</b></span></div>' +
      '<div class="ma-lead"><div><span class="v-tag">' + (noData ? '관측 자료 확인' : '이번 기간의 관측') + '</span><h3>' + headline + '</h3><p>' + sub + '</p></div>' + button('10분 단위 흐름 보기 →', 'data-ma-jump="1"', true) + '</div>' +
      '<div class="metric-grid ma-metrics">' + metric('10분당 통행 관측', decimal(c.averagePerTenMinutes), '건', '이전 대비 ' + change(c.averagePerTenMinutes, p?.averagePerTenMinutes)) + metric('10초 이상 체류 비율', pct(c.dwellRate), '', '이전 대비 ' + pp(c.dwellRate, p?.dwellRate)) + metric('매장 입장률', pct(c.entryRate), '', '이전 대비 ' + pp(c.entryRate, p?.entryRate)) + metric('체류한 경우의 평균 시간', decimal(c.dwellAverage), '초', '10초 이상 머문 관측만 계산') + '</div>' +
      '<div class="ma-quality-strip"><span><i class="' + (result.complete ? '' : 'warn') + '"></i>분석 가능 ' + c.count + ' / ' + result.expected + '구간</span><span>유효 관측 시간 ' + decimal(result.observedHours) + '시간</span><span>통행 관측 합계 ' + num(c.passers) + '건</span>' + button('집계 기준', 'data-ma-jump="3"') + '</div>' +
      (!result.comparable ? '<p class="ma-notice">' + (result.unavailable.length ? '누락·분석 제외 구간이 있어 현재 관측값만 표시합니다. 일부 구간의 부재를 통행 감소로 해석하지 않습니다.' : '이전 기간 전체의 관측 자료가 없어 증감 비교를 보류했습니다.') + '</p>' : '') +
      '<nav class="ma-section-links" aria-label="상권분석 섹션 이동">' + ['요일·10분 흐름', '체류와 매장 유입', '인사이트'].map((label, i) => button(label + ' ↗', 'data-ma-jump="' + (i + 1) + '"')).join('') + '</nav><p class="ma-footnote">매장 전면에서 생성한 10분 단위 관측값입니다. 상권 전체 인구나 중복을 제거한 방문자 수가 아닙니다. 같은 요일 구성의 이전 기간을 비교합니다.</p>');
  }
  function measure(row) { return state.chart === 'traffic' ? row?.averagePassers ?? null : row?.entryRate ?? null; }
  function measureText(value) { return state.chart === 'traffic' ? decimal(value) + (value == null ? '' : '건') : pct(value); }
  function comparisonBars(rows, kind) {
    const max = Math.max(1, ...rows.flatMap(row => [measure(row) || 0, measure(row.previous) || 0]));
    return '<div class="ma-bars">' + rows.map(row => '<button class="ma-bar-row" type="button" data-ma-detail="' + kind + '" data-value="' + row.id + '"' + (!row.count ? ' disabled' : '') + ' aria-label="' + row.label + ', 현재 ' + measureText(measure(row)) + ', 비교 ' + measureText(measure(row.previous)) + ', 집계 보기"><span>' + row.label + '<small>' + (kind === 'weekday' ? row.days + '일' : row.count + '구간') + ' 관측</small></span><span class="ma-bar-pair"><i style="width:' + (measure(row) || 0) / max * 100 + '%"></i><i class="old" style="width:' + (measure(row.previous) || 0) / max * 100 + '%"></i></span><span><b>' + measureText(measure(row)) + '</b><small>이전 ' + measureText(measure(row.previous)) + '</small></span></button>').join('') + '</div>';
  }
  function trends() {
    const rows = state.chartHour === 'all' ? result.bySlot : result.bySlot.filter(row => String(D.slots.find(slot => slot.id === row.id)?.hour) === state.chartHour);
    const metricName = state.chart === 'traffic' ? '통행 관측' : '입장률';
    return wrap('trends', heading('02', '언제 움직임이 달라지나요?', '10분 단위와 요일별 흐름을 같은 요일 구성의 이전 기간과 비교합니다.') + scope() +
      '<div class="ma-chart-controls"><div role="group" aria-label="분석 지표">' + [['traffic', '통행 관측'], ['entry', '입장률']].map(([id, label]) => button(label, 'data-ma-chart="' + id + '" aria-pressed="' + (state.chart === id) + '"')).join('') + '</div><div class="ma-legend"><span><i></i>분석 기간</span><span><i class="old"></i>비교 기간</span></div></div>' +
      '<div class="ma-grid">' + card('<div class="ma-row"><h3>10분 단위 ' + metricName + '</h3>' + select('표시 시간', 'chartHour', [['all', '17~23시 전체'], ...[17, 18, 19, 20, 21, 22].map(hour => [String(hour), hour + '~' + (hour + 1) + '시'])]) + '</div><p class="v-subtitle">' + (state.chart === 'traffic' ? '같은 10분 구간의 관측 일평균' : '각 10분 구간의 통행 합계 대비 입장 비율') + '</p><div class="ma-ten-minute-scroll" tabindex="0" role="region" aria-label="10분 단위 비교, 스크롤하여 전체 시간 확인" data-lenis-prevent>' + comparisonBars(rows, 'slot') + '</div>') +
      card('<h3>요일별 ' + metricName + '</h3><p class="v-subtitle">' + (state.chart === 'traffic' ? '17~23시 전체가 관측된 날의 일평균' : '완전한 관측일의 통행 건수로 가중 집계') + '</p>' + comparisonBars(result.byWeekday, 'weekday')) + '</div><p class="ma-footnote">막대를 누르면 해당 구간의 날짜별 집계를 볼 수 있습니다. 표시 시간은 왼쪽 차트만 좁히며 전체 기간 요약은 유지합니다. 비교 자료가 없으면 이전 막대와 값을 표시하지 않습니다.</p>' + (extrasRenderer ? '<div class="ma-relocated-extras">' + extrasRenderer(result) + '</div>' : ''));
  }
  function behavior() {
    const c = result.current, p = result.comparison;
    const a = D.ratio(c.directionA, c.passers), b = D.ratio(c.directionB, c.passers);
    return wrap('behavior', heading('03', '지나가는 흐름이 체류와 입장으로 이어지나요?', '같은 통행 관측을 기준으로 두 행동을 각각 살펴봅니다.') + scope() + '<div class="ma-grid">' +
      card('<h3>통행 대비 행동 비율</h3><div class="ma-flow-origin"><span>기준 · 통행 관측</span><strong>' + num(c.passers) + '<small>건</small></strong></div><div class="ma-flow-branches"><div><span>↘ 10초 이상 체류</span><strong>' + pct(c.dwellRate) + '</strong><small>' + num(c.dwellers) + '건 · 이전 대비 ' + pp(c.dwellRate, p?.dwellRate) + '</small></div><div><span>↘ 매장 입장</span><strong>' + pct(c.entryRate) + '</strong><small>' + (result.camera.entry ? num(c.entrants) + '건 · 이전 대비 ' + pp(c.entryRate, p?.entryRate) : '출입구가 관측 범위 밖입니다') + '</small></div></div><p class="ma-explanation">체류한 관측과 입장한 관측은 서로 겹칠 수 있습니다. 두 비율을 더하거나, 체류 다음에 반드시 입장하는 단계로 해석하지 않습니다.</p><div class="ma-reading"><strong>입장은 구매가 아닙니다</strong><p>CCTV만으로 결제·매출·구매전환율을 계산하지 않습니다. POS와 비교하려면 동일 시간·판매 채널의 결제 자료가 별도로 필요합니다.</p></div>') +
      card('<h3>얼마나 머물렀나요?</h3><p class="v-subtitle">10초 이상 체류한 관측 ' + num(c.dwellers) + '건의 분포</p><div class="ma-duration">' + ['10~29초', '30~59초', '60초 이상'].map((label, i) => '<div><div class="ma-row"><span>' + label + '</span><strong>' + pct(D.ratio(c.dwellBins[i], c.dwellers)) + ' <small>· ' + (c.count ? num(c.dwellBins[i]) : '—') + '건</small></strong></div><div class="ma-track"><i style="width:' + (D.ratio(c.dwellBins[i], c.dwellers) || 0) + '%"></i></div></div>').join('') + '</div><div class="ma-directions"><h3>어느 방향으로 지나갔나요?</h3><div class="ma-direction-track"><i style="width:' + (a || 0) + '%"></i><i style="width:' + (b || 0) + '%"></i></div><div class="ma-row"><span>화면 왼쪽 → 오른쪽 <b>' + pct(a) + '</b></span><span>반대 방향 <b>' + pct(b) + '</b></span></div><p class="ma-footnote">방향은 카메라 화면 기준입니다. 실제 목적지나 방문 경로를 추정하지 않습니다.</p></div>') + '</div>');
  }
  function insights() {
    return wrap('insights', heading('04', '관측에서 확인한 상권의 단서', '관측 사실과 그 사실만으로 알 수 없는 내용을 함께 제시합니다.') + scope() +
      '<div class="ma-insight-grid">' + (result.insights.length ? result.insights.map((insight, index) => card('<div class="ma-row"><span class="ma-insight-index">0' + (index + 1) + '</span>' + badge(insight.label) + '</div><h3>' + esc(insight.title) + '</h3><p class="ma-insight-text">' + esc(insight.text) + '</p><div class="ma-reading"><span>해석 범위</span><p>' + esc(insight.caveat) + '</p></div>' + button('해당 시간 관측 확인 ↗', 'data-ma-evidence="' + insight.slotId + '"'))).join('') : card(empty('인사이트를 만들 관측 자료가 없습니다'))) + '</div>' +
      '<details class="ma-definitions"><summary>분석 범위와 관측 품질 · ' + result.current.count + '/' + result.expected + '구간 사용</summary><div class="ma-definition-body"><div class="ma-quality-facts"><div><span>관측 지점</span><strong>' + esc(result.camera.name) + '</strong></div><div><span>집계 단위</span><strong>매장 전면 × 날짜 × 10분</strong></div><div><span>유효 관측 시간</span><strong>' + decimal(result.observedHours) + '시간</strong></div></div><p>통행·체류·입장은 생성한 CCTV 분석 결과입니다. 실제 영상·카메라·영상 분석 엔진은 연결 전입니다. 개인 식별, 연령·성별 추정, 재방문 추적은 제공하지 않습니다. 관측 지점 간 중복 제거 자료가 없어 여러 카메라의 수치를 합산하지 않습니다.</p><p>10초 이상 체류 비율 = 체류 관측 ÷ 통행 관측. 입장률 = 매장 입장 관측 ÷ 통행 관측. 기간 비율은 각 구간의 비율 평균이 아니라 분자·분모 합계로 계산합니다. 평균 체류시간은 체류시간 합계 ÷ 체류 관측 수입니다.</p><p>결측·가림이 있는 10분 구간은 분석에서 제외합니다. 10분당 통행 = 유효 통행 합계 ÷ 유효 10분 구간 수. 시간대 평균은 같은 10분의 유효 구간 수로, 요일 평균은 17~23시 전체가 관측된 일수로 나눕니다. 비교는 두 기간의 모든 예정 구간이 유효할 때만 제공합니다.</p><p>같은 요일 구성은 겹침을 피하도록 선택 일수 이상의 최소 7일 배수만큼 이전으로 이동합니다. 비교 기준은 같은 요일 구성으로 고정합니다.</p>' +
      (result.unavailable.length ? '<p class="ma-notice">' + (!result.camera.connected ? '선택 지점의 모든 구간이 미연결 상태입니다.' : '분석 제외: ' + result.unavailable.slice(0, 6).map(item => item.date + ' ' + D.slots.find(slot => slot.id === item.slotId).label + ' (' + (item.row?.status === 'occluded' ? '가림' : '누락') + ')').join(' · ') + (result.unavailable.length > 6 ? ' 외 ' + (result.unavailable.length - 6) + '구간' : '')) + '</p>' : (result.expected ? '<p>선택한 기간·지점의 예정 구간이 모두 관측되었습니다.</p>' : '<p>선택 조건에 해당하는 날짜가 없어 관측 품질을 판단하지 않습니다.</p>')) +
      button('사용한 집계 전체 보기', 'data-ma-detail="all"' + (!result.current.count ? ' disabled' : '')) + '</div></details><div class="ma-handoff"><div><strong>실행 전략은 회복전략 리포트에서 이어집니다.</strong><p>리포트 내용 구체화와 이 분석 결과의 자동 전달은 추후 진행합니다.</p></div>' + button('iM비서 열기 →', 'data-view="secretary"') + '</div>');
  }
  function render(period) {
    result = D.analyze(period, state);


    return overview() + trends() + behavior() + insights();
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
    return '<div class="v-table-wrap"><table class="v-table ma-detail-table"><caption>현재 조건에 해당하는 관측 집계</caption><thead><tr><th>날짜</th><th>시간</th><th>통행</th><th>체류</th><th>입장</th><th>입장률</th></tr></thead><tbody>' + detailRows.slice(detailPage * 8, detailPage * 8 + 8).map(row => '<tr><td>' + row.date + '</td><td>' + D.slots.find(slot => slot.id === row.slotId).label + '</td><td>' + num(row.passers) + '건</td><td>' + num(row.dwellers) + '건</td><td>' + num(row.entrants) + '</td><td>' + pct(D.ratio(row.entrants, row.passers)) + '</td></tr>').join('') + '</tbody></table></div><div class="ma-pagination"><span>' + num(detailRows.length) + '구간 · ' + (detailPage + 1) + '/' + pages + ' 페이지</span><div>' + button('이전', 'data-ma-page="' + (detailPage - 1) + '"' + (!detailPage ? ' disabled' : '')) + button('다음', 'data-ma-page="' + (detailPage + 1) + '"' + (detailPage === pages - 1 ? ' disabled' : '')) + '</div></div>';
  }
  function showDetail(kind, value) {
    let title = '분석에 사용한 전체 관측', predicate = () => true;
    if (kind === 'slot') { title = D.slots.find(slot => slot.id === value).label; predicate = row => row.slotId === value; }
    if (kind === 'weekday') { title = ['일', '월', '화', '수', '목', '금', '토'][Number(value)] + '요일'; predicate = row => D.weekday(row.date) === Number(value) && D.slots.every(slot => result.selected.some(item => item.date === row.date && item.slotId === slot.id && item.status === 'valid')); }
    detailRows = result.current.records.filter(predicate).slice().sort((a, b) => b.date.localeCompare(a.date) || a.slotId.localeCompare(b.slotId)); detailPage = 0;
    const totals = D.summarize(detailRows, result.camera.entry);
    document.getElementById('ma-dialog-title').textContent = title;
    document.getElementById('ma-dialog-content').innerHTML = scope() + '<div class="ma-detail-totals"><span>통행 합계 <b>' + num(totals.passers) + '건</b></span><span>체류 합계 <b>' + num(totals.dwellers) + '건</b></span><span>입장률 <b>' + pct(totals.entryRate) + '</b></span></div><p class="ma-footnote">원본 영상이나 개인별 이동 기록이 아닌 생성 분석 집계입니다. 같은 관측이 서로 다른 시간에 포함될 수 있습니다.</p><div id="ma-detail-rows">' + detailTable() + '</div>';
    dialog.showModal();
  }
  function bind(callback) {
    rerender = callback;
    dialog = document.createElement('dialog'); dialog.className = 'v-modal ma-modal'; dialog.id = 'ma-dialog'; dialog.setAttribute('aria-labelledby', 'ma-dialog-title'); dialog.setAttribute('data-lenis-prevent', '');
    dialog.innerHTML = '<div class="ma-row">' + badge('생성 CCTV 분석 결과') + button('닫기', 'data-ma-close aria-label="관측 집계 닫기"') + '</div><h2 id="ma-dialog-title"></h2><div id="ma-dialog-content"></div>';
    document.body.append(dialog);
    document.addEventListener('change', event => {
      const key = event.target.dataset.maSelect;
      if (key !== 'chartHour') return;
      state[key] = event.target.value; refresh(event.target.id);
    });
    document.addEventListener('click', event => {
      const el = event.target.closest('[data-ma-jump], [data-ma-reset], [data-ma-day], [data-ma-chart], [data-ma-detail], [data-ma-close], [data-ma-page], [data-ma-evidence]');
      if (!el) return;
      if (el.hasAttribute('data-ma-jump')) jump(Number(el.dataset.maJump));
      if (el.hasAttribute('data-ma-reset')) { Object.assign(state, { camera: 'front', days: [], comparison: 'weekday', chart: 'traffic', chartHour: 'all' }); refresh('ma-day-1'); }
      if (el.hasAttribute('data-ma-day')) { const day = Number(el.dataset.maDay); state.days = state.days.includes(day) ? state.days.filter(value => value !== day) : [...state.days, day]; refresh('ma-day-' + day); }
      if (el.hasAttribute('data-ma-chart')) { state.chart = el.dataset.maChart; refresh(); document.querySelector('[data-ma-chart="' + state.chart + '"]')?.focus({ preventScroll: true }); }
      if (el.hasAttribute('data-ma-detail')) showDetail(el.dataset.maDetail, el.dataset.value);
      if (el.hasAttribute('data-ma-close')) dialog.close();
      if (el.hasAttribute('data-ma-page')) { detailPage = Number(el.dataset.maPage); const target = document.getElementById('ma-detail-rows'); target.innerHTML = detailTable(); target.querySelector('button:not(:disabled)')?.focus({ preventScroll: true }); }
      if (el.hasAttribute('data-ma-evidence')) showDetail('slot', el.dataset.maEvidence);
    });
  }
  window.IM_MARKET_ANALYSIS = { render, bind, setExtrasRenderer(callback) { extrasRenderer = typeof callback === 'function' ? callback : null; } };
})();
