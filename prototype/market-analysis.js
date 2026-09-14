(function () {
  'use strict';
  const D = window.IM_MARKET_DATA;
  const state = { camera: 'front', dayType: 'all', comparison: 'previous', chart: 'traffic', date: '', slot: '18', layer: 'passage' };
  let result, rerender, dialog, detailRows = [], detailPage = 0;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = value => value == null ? '—' : Math.round(value).toLocaleString('ko-KR');
  const decimal = value => value == null ? '—' : value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
  const pct = value => value == null ? '—' : value.toFixed(1) + '%';
  const pp = (value, before) => value == null || before == null ? '비교 불가' : ((value - before) > 0 ? '+' : '') + (value - before).toFixed(1) + '%p';
  const change = (value, before) => before == null || value == null ? '비교 불가' : before === 0 ? '기준값 0 · 증감률 미산정' : (value > before ? '+' : '') + D.rate(value, before).toFixed(1) + '%';
  const button = (label, attrs, primary) => '<button type="button" class="v-button' + (primary ? ' primary' : '') + '" ' + attrs + '>' + label + '</button>';
  const badge = (text, amber) => '<span class="v-tag ' + (amber ? 'amber' : 'neutral') + '">' + text + '</span>';
  const card = body => '<article class="card v-card ma-card">' + body + '</article>';
  const options = (rows, value) => rows.map(([id, label]) => '<option value="' + id + '"' + (id === value ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
  const select = (label, key, rows) => '<label class="ma-field">' + label + '<select class="v-select" id="ma-' + key + '" data-ma-select="' + key + '">' + options(rows, state[key]) + '</select></label>';
  const wrap = (id, body) => '<div class="ma-panel" id="ma-' + id + '">' + body + '</div>';
  const heading = (index, title, text) => '<div class="ma-heading"><div><span class="ma-kicker">' + index + ' / 상권분석</span><h2>' + title + '</h2><p class="v-subtitle">' + text + '</p></div>' + (index === '01' ? badge('CCTV 분석 결과 · 생성 데이터') : button('분석 조건 ↑', 'data-ma-jump="0"')) + '</div>';
  const scope = () => '<p class="ma-scope">' + esc(result.camera.code + ' · ' + result.camera.name + ' · ' + result.period.start + '~' + result.period.end) + ' · ' + (state.dayType === 'weekday' ? '평일' : state.dayType === 'weekend' ? '주말' : '모든 요일') + '</p>';
  const empty = text => '<div class="ma-empty"><strong>' + text + '</strong><p>기간·관측 지점을 변경해 확인할 수 있습니다.</p></div>';
  function metric(label, value, unit, note) {
    return '<article class="card metric-card ma-metric"><div class="metric-label">' + label + '</div><div class="metric-value">' + value + '<small>' + (value === '—' ? '' : unit) + '</small></div><p>' + note + '</p></article>';
  }
  function overview() {
    const c = result.current, p = result.comparison, peak = result.peak;
    const noData = !result.camera.connected ? '이 관측 지점은 아직 연결되지 않았습니다.' : !result.dates.length ? '선택한 요일에 해당하는 날짜가 없습니다.' : !c.count ? '분석 가능한 관측 구간이 없습니다.' : null;
    const headline = noData || (peak ? peak.label + ', 사람들의 움직임이 가장 많습니다.' : '유효 관측 구간에서 통행이 관측되지 않았습니다.');
    const sub = noData ? '다른 지점이나 기간을 선택해 CCTV 분석 결과 예시를 확인하세요.' : peak ? peak.label + ' 통행은 같은 시간대 1일 평균 ' + num(peak.averagePassers) + '건입니다. 머무는 행동과 매장 입장을 함께 살펴보세요.' : '자료 누락과 통행 0건을 구분합니다. 현재 유효 집계의 통행 수는 0건입니다.';
    return wrap('overview', heading('01', '거리의 움직임을, 상권의 단서로', 'CCTV 관측 구역의 통행·체류·입장 변화를 읽습니다.') +
      '<div class="ma-filters">' + select('관측 지점', 'camera', D.cameras.map(camera => [camera.id, camera.name])) + select('요일', 'dayType', [['all', '모든 요일'], ['weekday', '평일'], ['weekend', '주말']]) + select('비교 기준', 'comparison', [['previous', '직전 동일 일수'], ['weekday', '같은 요일 구성']]) + button('조건 초기화', 'data-ma-reset') + '</div>' +
      '<div class="ma-period"><span>분석 <b>' + result.period.start + ' ~ ' + result.period.end + '</b></span><span>비교 <b>' + result.previousStart + ' ~ ' + result.previousEnd + '</b></span></div>' +
      '<div class="ma-lead"><div><span class="v-tag">' + (noData ? '관측 자료 확인' : '이번 기간의 관측') + '</span><h3>' + headline + '</h3><p>' + sub + '</p></div>' + button('관측 근거 살펴보기 →', 'data-ma-jump="1"', true) + '</div>' +
      '<div class="metric-grid ma-metrics">' + metric('시간당 통행 관측', decimal(c.averagePassers == null ? null : c.averagePassers / 2), '건', '이전 대비 ' + change(c.averagePassers, p?.averagePassers)) + metric('10초 이상 체류 비율', pct(c.dwellRate), '', '이전 대비 ' + pp(c.dwellRate, p?.dwellRate)) + metric('매장 입장률', pct(c.entryRate), '', result.camera.entry ? '이전 대비 ' + pp(c.entryRate, p?.entryRate) : '매장 입구가 관측 범위 밖입니다') + metric('체류한 경우의 평균 시간', decimal(c.dwellAverage), '초', '10초 이상 머문 관측만 계산') + '</div>' +
      '<div class="ma-quality-strip"><span><i class="' + (result.complete ? '' : 'warn') + '"></i>분석 가능 ' + c.count + ' / ' + result.expected + '구간</span><span>유효 영상 시간 ' + num(result.observedHours) + '시간</span><span>통행 관측 합계 ' + num(c.passers) + '건</span>' + button('집계 기준', 'data-ma-jump="4"') + '</div>' +
      (!result.comparable ? '<p class="ma-notice">' + (result.unavailable.length ? '누락·분석 제외 구간이 있어 현재 관측값만 표시합니다. 일부 구간의 부재를 통행 감소로 해석하지 않습니다.' : '이전 기간 전체의 관측 자료가 없어 증감 비교를 보류했습니다.') + '</p>' : '') +
      '<nav class="ma-section-links" aria-label="상권분석 섹션 이동">' + ['CCTV 관측 영역', '요일·시간대 흐름', '체류와 매장 유입', '인사이트'].map((label, i) => button(label + ' ↗', 'data-ma-jump="' + (i + 1) + '"')).join('') + '</nav><p class="ma-footnote">' + esc(result.camera.scope) + '의 관측값입니다. 상권 전체 인구나 기간 내 중복을 제거한 방문자 수가 아닙니다. 자료 기준일 2026.09.02.</p>');
  }
  function selectedRow() { return result.selected.find(row => row.date === state.date && row.slotId === state.slot); }
  function sceneDiagram(row) {
    if (!row || row.status !== 'valid') return empty(!result.camera.connected ? 'CCTV 연결 전' : row?.status === 'occluded' ? '가림이 있어 분석에서 제외한 구간입니다' : '선택한 구간의 영상 분석 자료가 없습니다');
    const dwell = state.layer === 'dwell', entry = state.layer === 'entry';
    const path = entry ? 'M65 265 C180 265 325 248 348 153 L348 100' : dwell ? 'M65 266 C163 268 199 217 268 189 Q300 190 286 226' : 'M48 294 C178 295 230 284 328 258 S471 225 557 235';
    return '<div class="ma-scene"><div class="ma-scene-label"><span>' + result.camera.code + ' · 관측 영역 도식</span><span>실제 영상 아님</span></div><svg viewBox="0 0 620 360" role="img" aria-label="' + (entry ? '매장 출입선 안쪽으로 이동하는 경로' : dwell ? '체류 구역에서 머무는 경로' : '보행로의 통행 기준선을 지나는 경로') + '를 표시한 생성 관측 도식"><defs><pattern id="ma-grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="#c8d9d4" stroke-width=".5"/></pattern><marker id="ma-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#257e67"/></marker></defs><rect width="620" height="360" fill="#e9f0ed"/><rect width="620" height="360" fill="url(#ma-grid)"/><path d="M0 245 620 184V335L0 360Z" fill="#d4e0dc"/><rect x="176" y="42" width="273" height="96" rx="8" fill="#f7faf8" stroke="#9ab7ab"/><path d="M163 136H462" stroke="#adc3b9" stroke-width="12"/><text x="312" y="81" text-anchor="middle" fill="#345d50" font-size="17">' + (result.camera.entry ? '예시 음식점' : '인접 점포 · 입구 관측 제외') + '</text>' +
      (result.camera.entry ? '<rect x="323" y="99" width="52" height="41" rx="3" fill="#a3c2b6"/><path d="M304 148H393" stroke="' + (entry ? '#d69a3a' : '#96b3a6') + '" stroke-width="5" stroke-dasharray="7 4"/><text x="440" y="168" fill="#84673f" font-size="12">매장 출입선</text>' : '') +
      '<path d="M211 165 418 144 441 229 189 255Z" fill="' + (dwell ? '#61ad8445' : '#61ad8412') + '" stroke="#71a895" stroke-width="2" stroke-dasharray="6 5"/><text x="216" y="186" fill="#426f5b" font-size="12">10초 이상 체류 구역</text><path d="M146 210 162 347" stroke="' + (state.layer === 'passage' ? '#4788ad' : '#97afb3') + '" stroke-width="3" stroke-dasharray="7 5"/><text x="66" y="214" fill="#476a7a" font-size="12">통행 기준선</text><path d="' + path + '" fill="none" stroke="#257e67" stroke-width="3" stroke-dasharray="6 4" marker-end="url(#ma-arrow)"/>' +
      '<g transform="translate(' + (entry ? '348 109' : dwell ? '283 218' : '392 243') + ')"><rect x="-15" y="-30" width="30" height="55" rx="4" fill="#4d98771c" stroke="#3d8167" stroke-width="2"/><circle cy="-18" r="6" fill="#698e80"/><path d="M0 -9v16m0-12-8 9m8-9 8 9M0 7l-6 13M0 7l6 13" fill="none" stroke="#698e80" stroke-width="4" stroke-linecap="round"/></g><text x="432" y="320" fill="#668076" font-size="11">익명 경로 · 설명용 예시</text></svg></div>';
  }
  function observation() {
    const row = selectedRow(), valid = row?.status === 'valid';
    const descriptions = { passage: ['통행선 통과를 셉니다', '관측선 통과를 추적 단위로 집계합니다. 같은 사람도 다른 시간대에 다시 관측될 수 있습니다.'], dwell: ['10초 이상 머문 관측을 셉니다', '설정 구역에서 10초 이상 머문 경우입니다. 관심·대기·대화 등 체류 이유는 판정하지 않습니다.'], entry: ['매장 안쪽으로의 이동을 셉니다', '보행로에서 매장 출입선을 안쪽으로 통과한 관측입니다. 실제 구매 여부와는 다릅니다.'] };
    const description = descriptions[state.layer];
    return wrap('observation', heading('02', '영상의 어떤 움직임을 읽었나요?', '집계가 만들어지는 관측 영역과 행동 기준을 확인하세요.') + scope() + '<div class="ma-grid ma-scene-layout">' + card('<div class="ma-row"><h3>CCTV 관측 영역</h3>' + badge('비식별 도식 · 시연') + '</div><div class="ma-scene-controls">' + select('관측 날짜', 'date', result.dates.length ? result.dates.map(date => [date, date]) : [['', '해당 날짜 없음']]) + select('시간대', 'slot', D.slots.map(slot => [slot.id, slot.label])) + '</div>' + sceneDiagram(row) + '<div class="ma-layer-tabs" role="group" aria-label="관측 기준 선택">' + [['passage', '통행선'], ['dwell', '체류 구역'], ['entry', '매장 입구']].map(([id, label]) => button(label, 'data-ma-layer="' + id + '" aria-pressed="' + (state.layer === id) + '"' + (id === 'entry' && !result.camera.entry ? ' disabled' : ''))).join('') + '</div>') +
      card('<span class="ma-kicker">선택 구간의 분석 결과</span><h3>' + (state.date || '날짜 없음') + ' · ' + D.slots.find(slot => slot.id === state.slot).label + '</h3><div class="ma-observed-values"><div><span>통행 관측</span><strong>' + num(valid ? row.passers : null) + '<small>건</small></strong></div><div><span>10초 이상 체류</span><strong>' + num(valid ? row.dwellers : null) + '<small>건</small></strong></div><div><span>매장 입장</span><strong>' + num(valid ? row.entrants : null) + '<small>' + (result.camera.entry ? '건' : '관측 범위 밖') + '</small></strong></div></div><div class="ma-reading"><strong>' + description[0] + '</strong><p>' + description[1] + '</p></div><p class="ma-footnote">영상 처리 엔진 대신 생성된 분석 결과를 읽습니다. 도식의 경로 한 개는 집계 전체를 재생하는 것이 아니라 집계 기준을 설명하는 예시입니다.</p>' + button('이 구간 집계 보기 ↗', 'data-ma-detail="observation"' + (!valid ? ' disabled' : ''))) + '</div>');
  }
  function measure(row) { return state.chart === 'traffic' ? row?.averagePassers ?? null : state.chart === 'dwell' ? row?.dwellRate ?? null : row?.entryRate ?? null; }
  function measureText(value) { return state.chart === 'traffic' ? decimal(value) + (value == null ? '' : '건') : pct(value); }
  function comparisonBars(rows, kind) {
    const max = Math.max(1, ...rows.flatMap(row => [measure(row) || 0, measure(row.previous) || 0]));
    return '<div class="ma-bars">' + rows.map(row => '<button class="ma-bar-row" type="button" data-ma-detail="' + kind + '" data-value="' + row.id + '"' + (!row.count ? ' disabled' : '') + ' aria-label="' + row.label + ', 현재 ' + measureText(measure(row)) + ', 비교 ' + measureText(measure(row.previous)) + ', 집계 보기"><span>' + row.label + '<small>' + (kind === 'weekday' ? row.days + '일' : row.count + '구간') + ' 관측</small></span><span class="ma-bar-pair"><i style="width:' + (measure(row) || 0) / max * 100 + '%"></i><i class="old" style="width:' + (measure(row.previous) || 0) / max * 100 + '%"></i></span><span><b>' + measureText(measure(row)) + '</b><small>이전 ' + measureText(measure(row.previous)) + '</small></span></button>').join('') + '</div>';
  }
  function trends() {
    return wrap('trends', heading('03', '언제 움직임이 달라지나요?', '시간대와 요일별 흐름을 이전 기간과 나란히 비교합니다.') + scope() + '<div class="ma-chart-controls"><div role="group" aria-label="분석 지표">' + [['traffic', '통행 관측'], ['dwell', '체류 비율'], ['entry', '입장률']].map(([id, label]) => button(label, 'data-ma-chart="' + id + '" aria-pressed="' + (state.chart === id) + '"' + (id === 'entry' && !result.camera.entry ? ' disabled' : ''))).join('') + '</div><div class="ma-legend"><span><i></i>분석 기간</span><span><i class="old"></i>비교 기간</span></div></div><div class="ma-grid">' + card('<h3>시간대별 ' + (state.chart === 'traffic' ? '통행 관측' : state.chart === 'dwell' ? '체류 비율' : '입장률') + '</h3><p class="v-subtitle">' + (state.chart === 'traffic' ? '같은 2시간 구간의 관측 일평균' : '구간 전체 통행 건수를 분모로 계산') + '</p>' + comparisonBars(result.bySlot, 'slot')) + card('<h3>요일별 ' + (state.chart === 'traffic' ? '통행 관측' : state.chart === 'dwell' ? '체류 비율' : '입장률') + '</h3><p class="v-subtitle">' + (state.chart === 'traffic' ? '08~20시 전체가 관측된 날의 일평균' : '완전한 관측일의 통행 건수로 가중 집계') + '</p>' + comparisonBars(result.byWeekday, 'weekday')) + '</div><p class="ma-footnote">항목을 누르면 근거 집계를 볼 수 있습니다. 비교 기간에 일부라도 누락이 있으면 증감 해석을 보류합니다. 시간대별 평균은 요일 구성의 영향을 받을 수 있습니다.</p>');
  }
  function behavior() {
    const c = result.current, p = result.comparison;
    const a = D.ratio(c.directionA, c.passers), b = D.ratio(c.directionB, c.passers);
    return wrap('behavior', heading('04', '지나가는 흐름이 체류와 입장으로 이어지나요?', '같은 통행 관측을 기준으로 두 행동을 각각 살펴봅니다.') + scope() + '<div class="ma-grid">' +
      card('<h3>통행 대비 행동 비율</h3><div class="ma-flow-origin"><span>기준 · 통행 관측</span><strong>' + num(c.passers) + '<small>건</small></strong></div><div class="ma-flow-branches"><div><span>↘ 10초 이상 체류</span><strong>' + pct(c.dwellRate) + '</strong><small>' + num(c.dwellers) + '건 · 이전 대비 ' + pp(c.dwellRate, p?.dwellRate) + '</small></div><div><span>↘ 매장 입장</span><strong>' + pct(c.entryRate) + '</strong><small>' + (result.camera.entry ? num(c.entrants) + '건 · 이전 대비 ' + pp(c.entryRate, p?.entryRate) : '출입구가 관측 범위 밖입니다') + '</small></div></div><p class="ma-explanation">체류한 관측과 입장한 관측은 서로 겹칠 수 있습니다. 두 비율을 더하거나, 체류 다음에 반드시 입장하는 단계로 해석하지 않습니다.</p><div class="ma-reading"><strong>입장은 구매가 아닙니다</strong><p>CCTV만으로 결제·매출·구매전환율을 계산하지 않습니다. POS와 비교하려면 동일 시간·판매 채널의 결제 자료가 별도로 필요합니다.</p></div>') +
      card('<h3>얼마나 머물렀나요?</h3><p class="v-subtitle">10초 이상 체류한 관측 ' + num(c.dwellers) + '건의 분포</p><div class="ma-duration">' + ['10~29초', '30~59초', '60초 이상'].map((label, i) => '<div><div class="ma-row"><span>' + label + '</span><strong>' + pct(D.ratio(c.dwellBins[i], c.dwellers)) + ' <small>· ' + (c.count ? num(c.dwellBins[i]) : '—') + '건</small></strong></div><div class="ma-track"><i style="width:' + (D.ratio(c.dwellBins[i], c.dwellers) || 0) + '%"></i></div></div>').join('') + '</div><div class="ma-directions"><h3>어느 방향으로 지나갔나요?</h3><div class="ma-direction-track"><i style="width:' + (a || 0) + '%"></i><i style="width:' + (b || 0) + '%"></i></div><div class="ma-row"><span>화면 왼쪽 → 오른쪽 <b>' + pct(a) + '</b></span><span>반대 방향 <b>' + pct(b) + '</b></span></div><p class="ma-footnote">방향은 카메라 화면 기준입니다. 실제 목적지나 방문 경로를 추정하지 않습니다.</p></div>') + '</div>');
  }
  function insights() {
    return wrap('insights', heading('05', '관측에서 확인한 상권의 단서', '관측 사실과 그 사실만으로 알 수 없는 내용을 함께 제시합니다.') + scope() +
      '<div class="ma-insight-grid">' + (result.insights.length ? result.insights.map((insight, index) => card('<div class="ma-row"><span class="ma-insight-index">0' + (index + 1) + '</span>' + badge(insight.label) + '</div><h3>' + esc(insight.title) + '</h3><p class="ma-insight-text">' + esc(insight.text) + '</p><div class="ma-reading"><span>해석 범위</span><p>' + esc(insight.caveat) + '</p></div>' + button('해당 시간 관측 확인 ↗', 'data-ma-evidence="' + insight.slotId + '"'))).join('') : card(empty('인사이트를 만들 관측 자료가 없습니다'))) + '</div>' +
      '<details class="ma-definitions"><summary>분석 범위와 관측 품질 · ' + result.current.count + '/' + result.expected + '구간 사용</summary><div class="ma-definition-body"><div class="ma-quality-facts"><div><span>관측 지점</span><strong>' + esc(result.camera.name) + '</strong></div><div><span>집계 단위</span><strong>지점 × 날짜 × 2시간</strong></div><div><span>유효 관측 시간</span><strong>' + num(result.observedHours) + '시간</strong></div></div><p>통행·체류·입장은 생성한 CCTV 분석 결과입니다. 실제 영상·카메라·영상 분석 엔진은 연결 전입니다. 개인 식별, 연령·성별 추정, 재방문 추적은 제공하지 않습니다. 관측 지점 간 중복 제거 자료가 없어 여러 카메라의 수치를 합산하지 않습니다.</p><p>10초 이상 체류 비율 = 체류 관측 ÷ 통행 관측. 입장률 = 매장 입장 관측 ÷ 통행 관측. 기간 비율은 각 구간의 비율 평균이 아니라 분자·분모 합계로 계산합니다. 평균 체류시간은 체류시간 합계 ÷ 체류 관측 수입니다.</p><p>결측·가림이 있는 2시간 구간은 분석에서 제외합니다. 시간당 통행 = 유효 통행 합계 ÷ 유효 관측 시간. 시간대 평균은 유효 구간 수로, 요일 평균은 08~20시 전체가 관측된 일수로 나눕니다. 비교는 두 기간의 모든 예정 구간이 유효할 때만 제공합니다.</p><p>같은 요일 구성은 겹침을 피하도록 선택 일수 이상의 최소 7일 배수만큼 이전으로 이동합니다. 기본 직전 동일 일수는 요일 구성이 다를 수 있습니다.</p>' +
      (result.unavailable.length ? '<p class="ma-notice">' + (!result.camera.connected ? '선택 지점의 모든 구간이 미연결 상태입니다.' : '분석 제외: ' + result.unavailable.slice(0, 6).map(item => item.date + ' ' + D.slots.find(slot => slot.id === item.slotId).label + ' (' + (item.row?.status === 'occluded' ? '가림' : '누락') + ')').join(' · ') + (result.unavailable.length > 6 ? ' 외 ' + (result.unavailable.length - 6) + '구간' : '')) + '</p>' : (result.expected ? '<p>선택한 기간·지점의 예정 구간이 모두 관측되었습니다.</p>' : '<p>선택 조건에 해당하는 날짜가 없어 관측 품질을 판단하지 않습니다.</p>')) +
      button('사용한 집계 전체 보기', 'data-ma-detail="all"' + (!result.current.count ? ' disabled' : '')) + '</div></details><div class="ma-handoff"><div><strong>실행 전략은 회복전략 리포트에서 이어집니다.</strong><p>리포트 내용 구체화와 이 분석 결과의 자동 전달은 추후 진행합니다.</p></div>' + button('iM비서 열기 →', 'data-view="secretary"') + '</div>');
  }
  function render(period) {
    result = D.analyze(period, state);
    if (!result.dates.includes(state.date)) state.date = result.dates[result.dates.length - 1] || '';
    if (!result.camera.entry) { if (state.chart === 'entry') state.chart = 'traffic'; if (state.layer === 'entry') state.layer = 'passage'; }
    return overview() + observation() + trends() + behavior() + insights();
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
    if (kind === 'observation') { title = state.date + ' · ' + D.slots.find(slot => slot.id === state.slot).label; predicate = row => row.date === state.date && row.slotId === state.slot; }
    detailRows = result.current.records.filter(predicate).slice().sort((a, b) => b.date.localeCompare(a.date) || Number(a.slotId) - Number(b.slotId)); detailPage = 0;
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
      if (!key) return;
      state[key] = event.target.value; refresh(event.target.id);
    });
    document.addEventListener('click', event => {
      const el = event.target.closest('[data-ma-jump], [data-ma-reset], [data-ma-layer], [data-ma-chart], [data-ma-detail], [data-ma-close], [data-ma-page], [data-ma-evidence]');
      if (!el) return;
      if (el.hasAttribute('data-ma-jump')) jump(Number(el.dataset.maJump));
      if (el.hasAttribute('data-ma-reset')) { Object.assign(state, { camera: 'front', dayType: 'all', comparison: 'previous', chart: 'traffic', date: '', slot: '18', layer: 'passage' }); refresh('ma-camera'); }
      if (el.hasAttribute('data-ma-layer')) { state.layer = el.dataset.maLayer; refresh(); document.querySelector('[data-ma-layer="' + state.layer + '"]')?.focus({ preventScroll: true }); }
      if (el.hasAttribute('data-ma-chart')) { state.chart = el.dataset.maChart; refresh(); document.querySelector('[data-ma-chart="' + state.chart + '"]')?.focus({ preventScroll: true }); }
      if (el.hasAttribute('data-ma-detail')) showDetail(el.dataset.maDetail, el.dataset.value);
      if (el.hasAttribute('data-ma-close')) dialog.close();
      if (el.hasAttribute('data-ma-page')) { detailPage = Number(el.dataset.maPage); const target = document.getElementById('ma-detail-rows'); target.innerHTML = detailTable(); target.querySelector('button:not(:disabled)')?.focus({ preventScroll: true }); }
      if (el.hasAttribute('data-ma-evidence')) { state.slot = el.dataset.maEvidence; const rows = result.current.records.filter(row => row.slotId === state.slot); state.date = rows[rows.length - 1]?.date || state.date; refresh(); jump(1); }
    });
  }
  window.IM_MARKET_ANALYSIS = { render, bind };
})();
