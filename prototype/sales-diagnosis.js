(function () {
  'use strict';
  const A = window.IM_SALES_DATA, D = window.IM_MEETING_DEMO;
  const state = { comparison: 'weekday', category: 'all', subcategory: 'all', item: 'all', hour: 'all', days: [], sort: 'sales', direction: 'desc', expandedItem: null, selectedDay: '1', selectedDate: null, collapsed: true };
  const dayOrder = [1, 2, 3, 4, 5, 6, 0], dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  let result, redraw, dialog, detail, detailPage = 0, extrasRenderer = () => '';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => n == null || !Number.isFinite(n) ? '—' : Math.round(n).toLocaleString('ko-KR');
  const money = n => num(n) + (n == null ? '' : '원');
  const percent = n => n == null || !Number.isFinite(n) ? '—' : n.toFixed(1) + '%';
  const tone = n => n < 0 ? 'sd-negative' : n > 0 ? 'sd-positive' : '';
  const amountChange = n => n == null ? '비교 자료 없음' : n === 0 ? '변동 없음' : (n > 0 ? '▲ ' : '▼ ') + money(Math.abs(n)) + (n > 0 ? ' 증가' : ' 감소');
  const delta = (now, before) => now == null ? '자료 없음' : before == null ? '비교 자료 없음' : before <= 0 ? (now === before ? '변동 없음' : '기준값 0 이하 · 증감률 미산정') : now === before ? '변동 없음' : (now > before ? '▲ ' : '▼ ') + percent(Math.abs((now - before) / before * 100)) + (now > before ? ' 증가' : ' 감소');
  const button = (label, attrs, primary) => '<button type="button" class="v-button' + (primary ? ' primary' : '') + '" ' + attrs + '>' + label + '</button>';
  const card = body => '<article class="card v-card sd-card">' + body + '</article>';
  const wrap = (id, body) => '<div class="sd-panel" id="sd-panel-' + id + '">' + body + '</div>';
  const heading = (index, title, subtitle) => '<div class="sd-section-heading"><div><span class="sd-kicker">' + index + ' / ' + title + '</span><h2>' + title + '</h2><p class="v-subtitle">' + subtitle + '</p></div>' + (index === '01' ? button('판매집계내역 CSV 파일 ↓', 'data-sd-export', true) : '') + '</div>';
  const select = (label, key, rows) => '<label class="sd-field">' + label + '<select class="v-select" id="sd-' + key + '" data-sd-filter="' + key + '">' + rows.map(([id, text]) => '<option value="' + esc(id) + '"' + (id === state[key] ? ' selected' : '') + '>' + esc(text) + '</option>').join('') + '</select></label>';
  const daysText = () => state.days.length ? dayOrder.filter(day => state.days.includes(day)).map(day => dayNames[day]).join('·') : '모든 요일';
  const scope = () => [D.menu.find(item => item.id === state.item)?.name || (state.subcategory !== 'all' ? D.menu.find(item => item.subcategory === state.subcategory)?.subcategoryLabel : state.category !== 'all' ? D.menu.find(item => item.category === state.category)?.categoryLabel : '전체 품목'), result.range.label, daysText()].filter(Boolean).join(' · ');
  const scopeLine = () => '<p class="sd-scope">' + esc(result.period.start + ' ~ ' + result.period.end + ' · ' + scope()) + '</p>';
  const uniqueOptions = (items, key) => Array.from(new Map(items.map(item => [item[key], item[key + 'Label'] || item[key]])).entries()).filter(row => row[0]);
  function filters() {
    const eligible = D.menu.filter(item => state.category === 'all' || item.category === state.category);
    return '<div id="sd-filter-dock" class="sd-filter-dock' + (state.collapsed ? ' is-collapsed' : '') + '"><button type="button" class="sd-filter-toggle" data-sd-toggle aria-expanded="' + !state.collapsed + '" aria-controls="sd-filter-fields">분석 필터 ' + (state.collapsed ? '펼치기' : '접기') + '<span>' + esc(scope()) + '</span></button><div id="sd-filter-fields" class="sd-filters">' +
      select('대분류', 'category', [['all', '전체 분류'], ...uniqueOptions(D.menu, 'category')]) + select('중분류', 'subcategory', [['all', '전체 종류'], ...uniqueOptions(eligible, 'subcategory')]) +
      '<div class="sd-field sd-day-field"><span>요일 · 복수 선택</span><div class="sd-day-buttons" role="group" aria-label="매출 분석 요일">' + button('전체', 'data-sd-day="all" aria-pressed="' + !state.days.length + '"') + dayOrder.map(day => button(dayNames[day], 'data-sd-day="' + day + '" aria-pressed="' + state.days.includes(day) + '"')).join('') + '</div></div>' +
      select('시간대', 'hour', A.ranges.map(row => [row.id, row.label])) + button('초기화', 'data-sd-reset') + '</div><div id="sd-period-mount"></div><p class="sd-filter-comparison">비교: ' + result.previousStart + '~' + result.previousEnd + ' · 겹치지 않는 같은 요일 구성</p></div>';
  }
  function metric(label, value, current, previous, foot, primary) {
    return '<article class="card metric-card' + (primary ? ' primary' : '') + '"><div class="metric-label">' + label + '</div><div class="metric-value">' + value + '</div><div class="metric-foot"><strong class="' + tone(previous == null || current == null ? 0 : current - previous) + '">' + delta(current, previous) + '</strong></div><p class="v-metadata">' + foot + '</p></article>';
  }
  function summary() {
    const c = result.current, p = result.previous, f = result.finance;
    const title = !result.currentComplete ? '선택한 조건의 영업 기록을 확인해 주세요.' : !p ? '현재 매출을 먼저 확인하세요.' : c.sales > p.sales ? '매출이 늘었습니다. 어떤 판매가 늘었는지 확인하세요.' : c.sales < p.sales ? '매출이 줄었습니다. 변화가 큰 품목과 시간을 확인하세요.' : '매출이 유지되고 있습니다.';
    const financePrevious = f.comparisonAvailable ? f.previousSales - f.previousExpense : null;
    return wrap('summary', filters() + heading('01', '매출 요약', '판매 기록을 바탕으로 우리 가게의 흐름을 살펴보세요.') +
      '<div class="sd-period-line">분석 ' + result.period.start + ' ~ ' + result.period.end + '</div><div class="sd-insight" role="status"><div><span class="v-tag">이번 기간의 진단</span><h3>' + title + '</h3><p>' + (p ? '같은 요일 구성의 이전 기간 대비 ' + amountChange(c.sales - p.sales) + '.' : '이전 기간의 완전한 자료가 없어 비교 해석을 생략했습니다.') + '</p></div></div>' +
      '<div class="metric-grid sd-metrics">' + metric('매출', money(c.sales), c.sales, p?.sales, '취소 차감 후 판매 금액 · 선택 조건', true) + metric('일평균 매출', money(c.average), c.average, p?.average, '선택 요일의 정상 영업일 ' + result.dayCount + '일 기준') + metric('매출 − 지출 차이', money(f.delta), f.delta, financePrevious, '같은 기간 가게 전체 · 품목·요일·시간 필터 제외') + metric('결제 객단가', money(c.customerAverage), c.customerAverage, p?.customerAverage, '매출 ÷ 유효 결제 ' + num(c.transactions) + '건' + (state.category !== 'all' || state.subcategory !== 'all' || state.item !== 'all' ? ' · 선택 품목 금액 기준' : '')) + '</div>' +
      '<div class="sd-finance-context"><span>같은 기간 가게 전체</span><span>전체 매출 <b>' + money(f.sales) + '</b></span><span>총지출 <b>' + money(f.expense) + '</b></span><small>품목·요일·시간 필터로 비용을 나누지 않습니다.</small></div>' +
      '<details class="sd-definitions"><summary>매출과 계산 기준</summary><p>매출은 취소를 차감한 판매 금액입니다. 일평균은 선택 기간·요일의 정상 영업일 수로 나눕니다. 결제 객단가는 선택 조건의 매출을 해당 품목이 포함된 고유한 유효 결제 건수로 나눕니다. 품목을 좁히면 선택 품목 금액 기준이며 결제 전체 금액과 다릅니다.</p><p>매출 − 지출 차이는 동일 기간 가게 전체 금액입니다. 품목·요일·시간별로 비용을 나누지 않습니다. 비용 범위와 원가가 확정되지 않아 순이익이 아니며, 보유 현금도 아닙니다.</p><p>분석과 CSV는 같은 선택 조건을 사용합니다. 영업시간은 17~23시이며 차트는 2시간 단위, CSV는 원래 10분 단위 판매 기록을 보존합니다. 비교는 기간이 겹치지 않는 같은 요일 구성입니다. 생성 자료이며 실제 POS·날씨·외부 AI는 연결되지 않았습니다.</p></details>');
  }
  function trendChart() {
    const rows = result.daily;
    if (!rows.length) return '<p class="sd-empty">표시할 날짜가 없습니다.</p>';
    const max = Math.max(1, ...rows.flatMap(row => [row.sales || 0, row.previous || 0]));
    const x = i => rows.length === 1 ? 355 : 58 + i * 602 / (rows.length - 1), y = n => 184 - n / max * 148;
    const ticks = [0, .5, 1].map(v => '<line x1="58" x2="670" y1="' + y(max * v) + '" y2="' + y(max * v) + '" stroke="#e5eeeb"/><text x="48" y="' + (y(max * v) + 4) + '" text-anchor="end">' + (max * v / 10000).toFixed(0) + '만</text>').join('');
    const lines = ['previous', 'sales'].map(key => { let path = '', connected = false; rows.forEach((row, i) => { if (row[key] == null) { connected = false; return; } path += (connected ? ' L ' : ' M ') + x(i) + ' ' + y(row[key]); connected = true; }); return '<path d="' + path + '" fill="none" stroke="' + (key === 'sales' ? '#198775' : '#9daeb8') + '" stroke-width="3"' + (key === 'previous' ? ' stroke-dasharray="6 5"' : '') + '/>'; }).join('');
    const points = rows.map((row, i) => row.sales == null && row.previous == null ? '' : '<g id="sd-point-' + row.date + '" tabindex="0" role="button" data-sd-date="' + row.date + '" aria-label="' + row.date + ' 매출 ' + money(row.sales) + ', 비교 ' + row.previousDate + ' ' + money(row.previous) + ', 해석 보기"><title>' + row.date + ': ' + money(row.sales) + '\n비교 ' + row.previousDate + ': ' + money(row.previous) + '</title><rect x="' + (x(i) - Math.max(5, Math.min(18, 290 / rows.length))) + '" y="25" width="' + Math.max(10, Math.min(36, 580 / rows.length)) + '" height="165" fill="transparent"/>' + (row.sales == null ? '' : '<circle cx="' + x(i) + '" cy="' + y(row.sales) + '" r="4" fill="#198775"/>') + '</g>').join('');
    const labels = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])].map(i => '<text x="' + x(i) + '" y="210" text-anchor="middle">' + rows[i].date.slice(5) + '</text>').join('');
    return '<div class="sd-legend"><span><i></i>분석 기간</span><span><i class="old"></i>비교 기간</span><small>원 · 같은 요일끼리 비교</small></div><svg class="sd-trend" viewBox="0 0 710 228" role="group" aria-label="일별 매출 비교. 날짜를 선택하면 두 기간의 금액과 해석을 확인합니다.">' + ticks + lines + points + labels + '</svg>';
  }
  function dateInsight() {
    const row = result.daily.find(item => item.date === state.selectedDate);
    if (!row) return '<p class="sd-selection-hint">차트의 날짜를 선택하면 금액과 변화를 자세히 볼 수 있습니다.</p>';
    return '<div class="sd-inline-insight" aria-live="polite"><h4>' + row.date + ' 매출</h4><p>현재 <b>' + money(row.sales) + '</b> · 비교 ' + row.previousDate + ' <b>' + money(row.previous) + '</b></p><p class="' + tone(row.sales == null || row.previous == null ? 0 : row.sales - row.previous) + '">' + (row.sales == null ? '선택한 날짜의 자료가 없습니다.' : row.previous == null ? '완전한 비교 자료가 없어 변화 해석을 생략합니다.' : amountChange(row.sales - row.previous) + '. 판매 수량과 취소 내역을 함께 확인하세요.') + '</p>' + button('이 날짜 판매 근거 보기', 'data-sd-detail="date" data-value="' + row.date + '"') + '</div>';
  }
  function movement() {
    const e = result.effects, max = e ? Math.max(1, Math.abs(e.quantity), Math.abs(e.amount), Math.abs(e.total)) : 1;
    return wrap('movement', heading('02', '매출 변화', '수치로 확인되는 변화와 원인 추정을 구분합니다.') + scopeLine() + '<div class="sd-grid">' + card('<h3>일별 매출 비교</h3>' + trendChart() + dateInsight() + '<details class="sd-definitions"><summary>일별 비교 수치 보기</summary><div class="v-table-wrap"><table class="v-table"><thead><tr><th>분석 날짜</th><th>비교 날짜</th><th>매출</th><th>비교 매출</th></tr></thead><tbody>' + result.daily.map(row => '<tr><td>' + button(row.date, 'data-sd-date="' + row.date + '"') + '</td><td>' + row.previousDate + '</td><td>' + money(row.sales) + '</td><td>' + money(row.previous) + '</td></tr>').join('') + '</tbody></table></div></details>') + card('<h3>매출 증감액의 구성</h3><p class="v-subtitle">수량 변화 → 판매 1개당 평균 금액 변화 순서</p>' + (e ? '<div class="sd-effects">' + [['판매 수량 변화', e.quantity], ['개당 평균 금액 변화', e.amount], ['전체 매출 변화', e.total]].map(([label, value]) => '<div><div class="v-row v-between"><span>' + label + '</span><strong class="' + tone(value) + '">' + amountChange(value) + '</strong></div><div class="sd-effect-track"><span class="' + tone(value) + '" style="width:' + Math.abs(value) / max * 100 + '%"></span></div></div>').join('') + '</div>' : '<p class="sd-empty">완전한 비교 자료와 비교 기간의 판매 수량이 있어야 계산할 수 있습니다.</p>') + '<p class="sd-explanation">개당 평균 금액은 메뉴 구성과 가격에 따라 달라지며 결제 객단가와 다릅니다. 수치만으로 원인을 확정하지 않고 품절·영업시간 등의 운영 기록을 함께 확인하세요.</p><details class="sd-definitions"><summary>계산식 보기</summary><p>수량 영향 = (현재 수량 − 이전 수량) × 이전 개당 평균 금액<br>금액 영향 = 현재 매출 − 현재 수량 × 이전 개당 평균 금액<br>두 영향의 합 = 현재 매출 − 이전 매출</p></details>') + '</div>');
  }
  function productSentence(row) {
    if (row.previous == null) return '현재 매출 ' + money(row.sales) + '입니다. 비교 자료가 없어 변화 해석을 생략합니다.';
    return '비교 기간 대비 ' + amountChange(row.delta) + (row.share == null ? '.' : ', 선택 매출의 ' + percent(row.share) + '를 차지합니다.');
  }
  function products() {
    const rows = result.products.slice().sort((a, b) => { const av = a[state.sort], bv = b[state.sort]; if (av == null && bv == null) return a.label.localeCompare(b.label, 'ko'); if (av == null) return 1; if (bv == null) return -1; return (state.direction === 'asc' ? av - bv : bv - av) || a.label.localeCompare(b.label, 'ko'); });
    const sortHead = (key, label) => '<th class="right" aria-sort="' + (state.sort === key ? state.direction === 'asc' ? 'ascending' : 'descending' : 'none') + '">' + button(label + ' ' + (state.sort === key ? state.direction === 'asc' ? '↑' : '↓' : '↕'), 'data-sd-sort="' + key + '" aria-label="' + label + ' ' + (state.sort === key && state.direction === 'asc' ? '내림차순' : '오름차순') + ' 정렬"') + '</th>';
    return wrap('products', heading('03', '품목별 진단', '품목의 매출 변화와 점검할 조건을 함께 확인하세요.') + scopeLine() + card('<h3>품목별 판매 실적</h3><div class="v-table-wrap"><table class="v-table sd-product-table"><caption class="sd-sr-only">품목 클릭으로 행 안의 인사이트를 펼칩니다. 증감액과 증감률은 각각 정렬할 수 있습니다.</caption><thead><tr><th>품목 · 한 줄 진단</th><th class="right">매출 / 비중</th><th class="right">비교 매출</th>' + sortHead('delta', '증감액') + sortHead('rate', '증감률') + '<th class="right">순판매 / 취소</th></tr></thead><tbody>' + (rows.length ? rows.map(row => '<tr data-sd-product="' + row.id + '"><td>' + button(esc(row.label) + (state.expandedItem === row.id ? ' ▴' : ' ▾'), 'data-sd-expand="' + row.id + '" aria-expanded="' + (state.expandedItem === row.id) + '" aria-controls="sd-insight-' + row.id + '"') + '<p class="sd-product-sentence">' + productSentence(row) + '</p></td><td class="right"><strong>' + money(row.sales) + '</strong><div class="sd-share"><span style="width:' + (row.share || 0) + '%"></span></div><small>' + percent(row.share) + '</small></td><td class="right">' + money(row.previous) + '</td><td class="right ' + tone(row.delta) + '">' + amountChange(row.delta) + '</td><td class="right ' + tone(row.delta) + '">' + delta(row.sales, row.previous) + '</td><td class="right">' + num(row.units) + '개 / ' + num(row.cancelled) + '개</td></tr><tr id="sd-insight-' + row.id + '" class="sd-product-insight"' + (state.expandedItem === row.id ? '' : ' hidden') + '><td colspan="6"><div class="sd-inline-insight"><h4>' + esc(row.label) + '에서 확인할 내용</h4><p>' + productSentence(row) + '</p><p>순판매 ' + num(row.units) + '개, 취소 ' + num(row.cancelled) + '개입니다. ' + (row.delta < 0 ? '품절·메뉴 노출·가격 변경 기록을 확인해 보세요.' : '잘 팔린 시간과 준비 수량을 함께 살펴보세요.') + ' 날씨와의 관계는 자료가 없어 판단하지 않습니다.</p>' + button('원자료 근거 보기', 'data-sd-detail="item" data-value="' + row.id + '"') + '</div></td></tr>').join('') : '<tr><td colspan="6" class="sd-empty">선택한 조건의 품목이 없습니다.</td></tr>') + '</tbody></table></div><p class="sd-explanation">매출 비중은 현재 필터의 매출을 기준으로 합니다. 원가가 연결되지 않아 매출 순위를 이익 순위로 해석하지 않습니다.</p>'));
  }
  function weekdaySentence(row) {
    if (!row || row.average == null) return '선택한 요일의 정상 영업 기록이 없어 진단을 생략합니다.';
    if (row.previousAverage == null || row.previousAverage <= 0) return row.label + ' 일평균 매출은 ' + money(row.average) + '입니다. 비교 기준이 충분하지 않아 증감 해석을 생략합니다.';
    return row.label + ' 일평균 매출은 ' + money(row.average) + '로, 같은 요일 비교 대비 ' + amountChange(row.average - row.previousAverage) + '.';
  }
  function timing() {
    const max = Math.max(1, ...result.weekdays.flatMap(row => [row.average || 0, row.previousAverage || 0])), heatMax = Math.max(1, ...result.heatmap.flatMap(row => row.cells.map(cell => cell.average || 0)));
    const selected = result.weekdays.find(row => row.id === state.selectedDay), peak = result.weekdays.filter(row => row.average != null).slice().sort((a, b) => b.average - a.average)[0];
    return wrap('timing', heading('04', '요일·시간대 진단', '정상 영업일 기준의 일평균 매출을 살펴보세요.') + scopeLine() + '<div class="sd-grid sd-timing">' + card('<h3>요일별 일평균 매출</h3><div class="sd-legend"><span><i></i>분석 기간</span><span><i class="old"></i>비교 기간</span></div><div class="sd-weekdays">' + result.weekdays.map(row => '<button type="button" class="sd-weekday" data-sd-weekday="' + row.id + '" aria-pressed="' + (state.selectedDay === row.id) + '"><span>' + row.label + '<small>' + row.count + '일 영업</small></span><span class="sd-bar-pair"><i style="width:' + (row.average || 0) / max * 100 + '%"></i><i class="old" style="width:' + (row.previousAverage || 0) / max * 100 + '%"></i></span><span>' + money(row.average) + '<small>비교 ' + money(row.previousAverage) + '</small></span></button>').join('') + '</div><div class="sd-inline-insight" aria-live="polite"><p>' + weekdaySentence(selected) + '</p>' + (selected?.average == null ? '' : button('선택 요일 판매 근거 보기', 'data-sd-detail="day" data-value="' + state.selectedDay + '"')) + '</div>') + card('<h3>요일 × 2시간대 매출</h3><p class="v-subtitle">색이 진할수록 해당 구간의 일평균 매출이 높습니다.</p><div class="v-table-wrap"><table class="sd-heatmap"><caption class="sd-sr-only">셀을 선택하면 해당 요일과 2시간 구간의 판매 근거를 확인합니다.</caption><thead><tr><th>요일</th>' + A.ranges.slice(1).map(slot => '<th>' + esc(slot.label) + '</th>').join('') + '</tr></thead><tbody>' + result.heatmap.map(row => '<tr><th>' + row.label + '</th>' + row.cells.map(cell => '<td><button type="button" data-sd-detail="cell" data-value="' + cell.day + ':' + cell.hour + '"' + (cell.average == null ? ' disabled' : '') + ' style="--heat:' + (cell.average == null ? 0 : .09 + cell.average / heatMax * .85) + '" aria-label="' + row.label + ' ' + cell.hour + '~' + cell.endHour + '시 일평균 ' + money(cell.average) + '" title="' + row.label + ' ' + cell.hour + '~' + cell.endHour + '시 · ' + money(cell.average) + '">' + (cell.average == null ? '—' : money(cell.average)) + '</button></td>').join('') + '</tr>').join('') + '</tbody></table></div><p class="sd-explanation">17~19시, 19~21시, 21~23시 기준입니다. 끝 시각은 다음 구간에 포함합니다. —는 선택 제외 또는 정상 영업 기록 없음입니다.</p>') + '</div><p class="sd-overall-insight">' + (peak ? '전체 진단: 선택 조건에서 ' + peak.label + '의 일평균 매출이 ' + money(peak.average) + '로 가장 높습니다.' : '전체 진단: 정상 영업 기록이 없어 요일 비교를 생략합니다.') + '</p><div id="sd-relocated-extras">' + extrasRenderer(result) + '</div>');
  }
  function render(period) {
    result = A.analyze(D, period, state);
    if (state.selectedDate && !result.daily.some(row => row.date === state.selectedDate)) state.selectedDate = null;
    return summary() + movement() + products() + timing();
  }
  function refresh(focusSelector) {
    const root = document.getElementById('viewRoot'), top = root.scrollTop, pageY = window.scrollY;
    redraw(); root.scrollTop = top; window.scrollTo({ top: pageY, behavior: 'instant' });
    if (focusSelector) document.querySelector(focusSelector)?.focus({ preventScroll: true });
  }
  function getDetail(kind, value) {
    let title = '현재 조건 전체', predicate = () => true, previousPredicate;
    if (kind === 'item') { title = D.menu.find(item => item.id === value)?.name || value; predicate = row => row.itemId === value; }
    if (kind === 'date') { title = value; predicate = row => row.date === value; const previousDate = result.daily.find(row => row.date === value)?.previousDate; previousPredicate = row => row.date === previousDate; }
    if (kind === 'day') { title = dayNames[Number(value)] + '요일'; predicate = row => A.weekday(row.date) === Number(value); }
    if (kind === 'cell') { const [day, hour] = value.split(':').map(Number); const endHour = A.ranges.find(row => row.start === hour)?.end || hour + 2; title = dayNames[day] + '요일 ' + hour + '~' + endHour + '시'; predicate = row => A.weekday(row.date) === day && row.hour >= hour && row.hour < endHour; }
    return { title, rows: result.rows.filter(predicate), oldRows: result.oldRows.filter(previousPredicate || predicate) };
  }
  const recordTime = row => String(row.hour).padStart(2, '0') + ':' + String(row.minute || 0).padStart(2, '0');
  function recordTable(rows) {
    const ordered = rows.slice().sort((a, b) => b.date.localeCompare(a.date) || b.hour - a.hour || (b.minute || 0) - (a.minute || 0) || a.itemId.localeCompare(b.itemId));
    const pages = Math.max(1, Math.ceil(ordered.length / 8)); detailPage = Math.max(0, Math.min(detailPage, pages - 1));
    return '<div class="v-table-wrap"><table class="v-table sd-record-table"><caption>선택 조건의 판매 기록</caption><thead><tr><th>날짜</th><th>시간</th><th>품목</th><th>판매 / 취소</th><th>순판매</th><th>매출</th></tr></thead><tbody>' + (ordered.slice(detailPage * 8, detailPage * 8 + 8).map(row => '<tr><td>' + row.date + '</td><td>' + recordTime(row) + '</td><td>' + esc(D.menu.find(item => item.id === row.itemId)?.name || row.itemId) + '</td><td>' + num(row.quantity) + ' / ' + num(row.cancellations) + '개</td><td>' + num(row.netQuantity) + '개</td><td>' + money(row.netAmount) + '</td></tr>').join('') || '<tr><td colspan="6" class="sd-empty">해당 판매 기록이 없습니다.</td></tr>') + '</tbody></table></div><div class="sd-pagination"><span>' + num(rows.length) + '개 기록 · ' + (detailPage + 1) + ' / ' + pages + ' 페이지</span><div>' + button('이전', 'data-sd-page="' + (detailPage - 1) + '"' + (!detailPage ? ' disabled' : '')) + button('다음', 'data-sd-page="' + (detailPage + 1) + '"' + (detailPage === pages - 1 ? ' disabled' : '')) + '</div></div>';
  }
  function showDetail(kind, value) {
    detail = getDetail(kind, value); detailPage = 0;
    const total = rows => rows.reduce((sum, row) => sum + row.netAmount, 0), current = total(detail.rows), previous = result.previous ? total(detail.oldRows) : null;
    document.getElementById('sd-dialog-title').textContent = detail.title + ' · 판매 근거';
    document.getElementById('sd-dialog-content').innerHTML = scopeLine() + '<div class="sd-detail-totals"><span>현재 <b>' + money(current) + '</b></span><span>비교 <b>' + money(previous) + '</b></span><span class="' + tone(previous == null ? 0 : current - previous) + '">' + amountChange(previous == null ? null : current - previous) + '</span></div><p class="v-metadata">분석 ' + result.period.start + '~' + result.period.end + ' · 비교 ' + result.previousStart + '~' + result.previousEnd + '<br>아래 표는 현재 선택 조건의 10분 단위 판매 기록입니다.</p><div id="sd-detail-records">' + recordTable(detail.rows) + '</div>';
    dialog.showModal();
  }
  function exportCsv() {
    const header = ['자료유형', '분석시작', '분석종료', '비교시작', '비교종료', '품목필터', '시간필터', '요일필터', '집계ID', '일자', '시간', '품목', '판매수량', '취소수량', '순판매수량', '순매출(원)'];
    const escapeCsv = value => '"' + String(value).replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
    const itemFilter = state.item !== 'all' ? state.item : [state.category, state.subcategory].join('/');
    const lines = [header, ...result.rows.map(row => ['생성 데이터', result.period.start, result.period.end, result.previousStart, result.previousEnd, itemFilter, result.range.label, daysText(), row.id, row.date, recordTime(row), D.menu.find(item => item.id === row.itemId)?.name || row.itemId, row.quantity, row.cancellations, row.netQuantity, row.netAmount])];
    const blob = new Blob(['\uFEFF' + lines.map(row => row.map(escapeCsv).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'iM파트너_매출진단_생성자료_' + result.period.start + '_' + result.period.end + '.csv';
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function bind(callback) {
    redraw = callback;
    dialog = document.createElement('dialog'); dialog.className = 'v-modal sd-modal'; dialog.id = 'sd-dialog'; dialog.setAttribute('aria-labelledby', 'sd-dialog-title'); dialog.setAttribute('data-lenis-prevent', '');
    dialog.innerHTML = '<div class="v-row v-between"><span class="v-tag neutral">생성 POS · 판매 근거</span>' + button('닫기', 'data-sd-close aria-label="판매 근거 닫기"') + '</div><h2 id="sd-dialog-title"></h2><div id="sd-dialog-content"></div>'; document.body.append(dialog);
    document.addEventListener('change', event => { const key = event.target.dataset.sdFilter; if (!['category', 'subcategory', 'item', 'hour'].includes(key)) return; state[key] = event.target.value; if (key === 'category') state.subcategory = 'all'; if (key === 'category' || key === 'subcategory') state.item = 'all'; state.expandedItem = null; refresh('#sd-' + key); });
    document.addEventListener('click', event => {
      const el = event.target.closest('[data-sd-reset], [data-sd-detail], [data-sd-close], [data-sd-page], [data-sd-export], [data-sd-day], [data-sd-sort], [data-sd-expand], [data-sd-weekday], [data-sd-date], [data-sd-toggle]'); if (!el) return;
      if (el.hasAttribute('data-sd-reset')) { Object.assign(state, { category: 'all', subcategory: 'all', item: 'all', hour: 'all', days: [], comparison: 'weekday', sort: 'sales', direction: 'desc', expandedItem: null, selectedDate: null }); refresh('[data-sd-reset]'); }
      if (el.hasAttribute('data-sd-day')) { const day = Number(el.dataset.sdDay); state.days = el.dataset.sdDay === 'all' ? [] : state.days.includes(day) ? state.days.filter(value => value !== day) : [...state.days, day]; state.expandedItem = null; refresh('[data-sd-day="' + el.dataset.sdDay + '"]'); }
      if (el.hasAttribute('data-sd-toggle')) { state.collapsed = !state.collapsed; refresh('[data-sd-toggle]'); }
      if (el.hasAttribute('data-sd-sort')) { state.direction = state.sort === el.dataset.sdSort && state.direction === 'asc' ? 'desc' : 'asc'; state.sort = el.dataset.sdSort; refresh('[data-sd-sort="' + state.sort + '"]'); }
      if (el.hasAttribute('data-sd-expand')) { state.expandedItem = state.expandedItem === el.dataset.sdExpand ? null : el.dataset.sdExpand; refresh('[data-sd-expand="' + el.dataset.sdExpand + '"]'); }
      if (el.hasAttribute('data-sd-weekday')) { state.selectedDay = el.dataset.sdWeekday; refresh('[data-sd-weekday="' + state.selectedDay + '"]'); }
      if (el.hasAttribute('data-sd-date')) { state.selectedDate = el.dataset.sdDate; refresh('#sd-point-' + state.selectedDate); }
      if (el.hasAttribute('data-sd-detail')) showDetail(el.dataset.sdDetail, el.dataset.value);
      if (el.hasAttribute('data-sd-close')) dialog.close();
      if (el.hasAttribute('data-sd-export')) exportCsv();
      if (el.hasAttribute('data-sd-page')) { detailPage = Number(el.dataset.sdPage); document.getElementById('sd-detail-records').innerHTML = recordTable(detail.rows); document.querySelector('#sd-detail-records button:not(:disabled)')?.focus({ preventScroll: true }); }
    });
    document.addEventListener('keydown', event => { if (event.target.matches('g[data-sd-date]') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); state.selectedDate = event.target.dataset.sdDate; refresh('#sd-point-' + state.selectedDate); } });
  }
  window.IM_SALES_DIAGNOSIS = { render, bind, setExtrasRenderer: fn => { extrasRenderer = typeof fn === 'function' ? fn : () => ''; } };
})();
