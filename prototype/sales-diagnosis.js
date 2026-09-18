(function () {
  'use strict';
  const A = window.IM_SALES_DATA, D = window.IM_MEETING_DEMO;
  const state = { comparison: 'weekday', category: 'all', subcategory: 'all', item: 'all', hour: A.currentRange(), manualTime: false, days: [], multiDay: false, sort: 'sales', direction: 'desc', expandedItem: null, selectedDay: '1', selectedDate: null, collapsed: window.innerWidth <= 1260 };
  const dayOrder = [1, 2, 3, 4, 5, 6, 0], dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  let result, monthlyResult, redraw, dialog, detail, detailPage = 0, extrasRenderer = () => '';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => n == null || !Number.isFinite(n) ? '—' : Math.round(n).toLocaleString('ko-KR');
  const money = n => num(n) + (n == null ? '' : '원');
  const percent = n => n == null || !Number.isFinite(n) ? '—' : n.toFixed(1) + '%';
  const tone = n => n < 0 ? 'sd-negative' : n > 0 ? 'sd-positive' : '';
  const amountChange = n => n == null ? '비교 자료 없음' : n === 0 ? '변동 없음' : (n > 0 ? '▲ ' : '▼ ') + money(Math.abs(n)) + (n > 0 ? ' 증가' : ' 감소');
  const coloredAmountChange = n => '<span class="' + tone(n) + '">' + amountChange(n) + '</span>';
  const delta = (now, before) => now == null ? '자료 없음' : before == null ? '비교 자료 없음' : before <= 0 ? (now === before ? '변동 없음' : '기준값 0 이하 · 증감률 미산정') : now === before ? '변동 없음' : (now > before ? '▲ ' : '▼ ') + percent(Math.abs((now - before) / before * 100)) + (now > before ? ' 증가' : ' 감소');
  const button = (label, attrs, primary) => '<button type="button" class="v-button' + (primary ? ' primary' : '') + '" ' + attrs + '>' + label + '</button>';
  const card = (body, scopeOptions) => '<article class="card v-card sd-card">' + body + scopeLine(result, scopeOptions) + '</article>';
  const wrap = (id, body) => '<div class="sd-panel" id="sd-panel-' + id + '">' + body + '</div>';
  const heading = (index, title, subtitle) => '<div class="sd-section-heading"><div><h2>' + title + '</h2><p class="v-subtitle">' + subtitle + '</p></div>' + (index === '01' ? button('판매집계내역 CSV 파일 ↓', 'data-sd-export', true) : '') + '</div>';
  const select = (label, key, rows) => '<label class="sd-field v-diagnosis-filter-field">' + label + '<select class="v-select" id="sd-' + key + '" data-sd-filter="' + key + '">' + rows.map(([id, text]) => '<option value="' + esc(id) + '"' + (id === state[key] ? ' selected' : '') + '>' + esc(text) + '</option>').join('') + '</select></label>';
  const daysText = () => state.days.length ? dayOrder.filter(day => state.days.includes(day)).map(day => dayNames[day]).join('·') : '모든 요일';
  const scopeParts = (analysis = result) => [D.menu.find(item => item.id === state.item)?.name || (state.subcategory !== 'all' ? D.menu.find(item => item.subcategory === state.subcategory)?.subcategoryLabel : state.category !== 'all' ? D.menu.find(item => item.category === state.category)?.categoryLabel : '전체 품목'), analysis.range.id === 'all' ? '전체 시간' : analysis.range.label, daysText()];
  const scope = (analysis = result, separator = ' / ') => scopeParts(analysis).join(separator);
  function scopeLine(analysis = result, options = {}) {
    const period = options.period || analysis.period;
    const parts = options.wholeStore ? ['전체 품목', '전체 시간', '모든 요일'] : scopeParts(analysis);
    if (options.item) parts[0] = options.item;
    if (options.time) parts[1] = options.time;
    if (options.days) parts[2] = options.days;
    return '<p class="sd-scope sd-card-scope">' + esc('기간: ' + period.start + '~' + period.end + ' / ' + parts.join(' / ')) + '</p>';
  }
  const uniqueOptions = (items, key) => Array.from(new Map(items.map(item => [item[key], item[key + 'Label'] || item[key]])).entries()).filter(row => row[0]);
  function filters() {
    const eligible = D.menu.filter(item => state.category === 'all' || item.category === state.category);
    const currentHour = A.currentRange();
    const timeOptions = A.ranges.map(row => [row.id, row.label + (row.id !== 'all' && row.id === currentHour ? ' - 현재 시간대' : '')]);
    return '<div id="sd-filter-dock" class="sd-filter-dock v-diagnosis-filter-dock' + (state.collapsed ? ' is-collapsed' : '') + '"><div class="v-diagnosis-filter-heading"><div class="v-diagnosis-filter-summary"><strong>분석 필터</strong><span>' + esc(scope(result, ' / ')) + '</span></div><button type="button" class="sd-filter-toggle v-diagnosis-filter-toggle" data-sd-toggle aria-label="분석 필터 ' + (state.collapsed ? '펼치기' : '접기') + '" title="분석 필터 ' + (state.collapsed ? '펼치기' : '접기') + '" aria-expanded="' + !state.collapsed + '" aria-controls="sd-filter-fields"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 15 6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div id="sd-filter-fields" class="sd-filters v-diagnosis-filter-fields">' +
      select('대분류', 'category', [['all', '전체 분류'], ...uniqueOptions(D.menu, 'category')]) + select('중분류', 'subcategory', [['all', '전체 종류'], ...uniqueOptions(eligible, 'subcategory')]) +
      '<div class="sd-field sd-day-field v-diagnosis-filter-field v-diagnosis-day-field"><div class="sd-day-label v-diagnosis-day-label"><span>요일</span><label class="sd-multi-toggle v-diagnosis-multi-toggle"><input type="checkbox" data-sd-multi' + (state.multiDay ? ' checked' : '') + '>복수 선택</label></div><div class="sd-day-buttons v-diagnosis-day-buttons" role="group" aria-label="매출 분석 요일">' + button('전체', 'data-sd-day="all" aria-pressed="' + !state.days.length + '"') + dayOrder.map(day => button(dayNames[day], 'data-sd-day="' + day + '" aria-pressed="' + state.days.includes(day) + '"')).join('') + '</div></div>' +
      select('시간대', 'hour', timeOptions) + '<button type="button" class="v-button v-diagnosis-filter-reset" data-sd-reset>초기화</button>' + '</div></div>';
  }
  function metric(label, value, current, previous, foot, primary) {
    return '<article class="card metric-card' + (primary ? ' primary' : '') + '"><div class="metric-label">' + label + '</div><div class="metric-value">' + value + '</div><div class="metric-foot"><strong class="' + tone(previous == null || current == null ? 0 : current - previous) + '">' + delta(current, previous) + '</strong></div><p class="v-metadata">' + foot + '</p></article>';
  }
  function summary() {
    const c = monthlyResult.current, p = monthlyResult.previous, f = monthlyResult.finance;
    const title = !monthlyResult.currentComplete ? '분석월의 영업 기록이 충분하지 않습니다.' : !p ? '월간 매출은 집계되었으며, 기간 비교는 제한됩니다.' : c.sales > p.sales ? '비교 기간보다 월간 매출이 늘었습니다.' : c.sales < p.sales ? '비교 기간보다 월간 매출이 줄었습니다.' : '비교 기간과 월간 매출이 같습니다.';
    const financePrevious = f.comparisonAvailable ? f.previousSales - f.previousExpense : null;
    return wrap('summary', filters() + heading('01', '매출 요약', '분석월 한 달의 가게 전체 매출과 지출을 살펴보세요.') +
      '<div class="sd-insight" role="status"><div><span class="v-tag">가게 전체 · 월간 진단</span><h3>' + title + '</h3><p>' + (p ? '같은 요일 구성의 이전 기간 대비 ' + amountChange(c.sales - p.sales) + '.' : '현재 또는 이전 기간의 완전한 자료가 없어 비교를 생략했습니다.') + '</p><p>아래 상세 진단에는 선택한 필터가 적용됩니다.</p></div>' + button('회복전략에서 더 살펴보기 →', 'data-view="secretary" data-recovery-tab="strategy"', true) + '</div>' +
      '<div class="metric-grid sd-metrics">' + metric('매출', money(c.sales), c.sales, p?.sales, '월간 전체 · 취소 반영', true) + metric('일평균 매출', money(c.average), c.average, p?.average, '월간 매출 ÷ 정상 영업일 ' + monthlyResult.dayCount + '일') + metric('순이익', money(f.delta), f.delta, financePrevious, '월간 매출 − 월간 총지출') + metric('결제 객단가', money(c.customerAverage), c.customerAverage, p?.customerAverage, '월간 매출 ÷ 유효 결제 ' + num(c.transactions) + '건') + '</div>' +
      '<div class="sd-finance-context sd-monthly-context"><span>한 달 전체 기준</span><span>총지출 <b>' + money(f.expense) + '</b></span><span class="sd-summary-scope">' + esc('기간: ' + monthlyResult.period.start + '~' + monthlyResult.period.end + ' / 전체 품목 / 전체 시간 / 모든 요일') + '</span></div>' +
      '<details class="sd-definitions"><summary>매출과 계산 기준</summary><dl class="v-definition-list"><div><dt>월간 요약</dt><dd>위 네 지표는 분석월 전체 값입니다. 현재 시각이나 품목·요일·시간 필터에 따라 바뀌지 않습니다.</dd></div><div><dt>계산 방법</dt><dd>매출은 취소 차감 후 금액입니다. 일평균 매출은 정상 영업일 수로, 결제 객단가는 유효 결제 건수로 나눕니다.</dd></div><div><dt>순이익</dt><dd>월간 매출에서 입력된 총지출을 뺀 금액입니다. 미입력 비용·세금·재고 조정은 반영되지 않아 회계상 확정 이익과 다를 수 있습니다.</dd></div><div><dt>상세 진단·CSV</dt><dd>선택한 품목·요일·시간을 적용합니다. 시간은 12시~24시를 1시간 단위로 나누며, CSV는 원래 10분 단위 기록을 유지합니다.</dd></div><div><dt>비교·자료</dt><dd>기간이 겹치지 않는 같은 요일 구성으로 비교합니다. 모든 매출·지출은 가상 가게의 시연값이며 업종 평균이 아닙니다.</dd></div></dl></details>');
  }
  function trendChart() {
    const rows = result.daily;
    if (!rows.length) return '<p class="sd-empty">표시할 날짜가 없습니다.</p>';
    const max = Math.max(1, ...rows.flatMap(row => [row.sales || 0, row.previous || 0]));
    const x = i => rows.length === 1 ? 288 : 56 + i * 464 / (rows.length - 1), y = n => 292 - n / max * 254;
    const ticks = [0, .5, 1].map(v => '<line x1="56" x2="528" y1="' + y(max * v) + '" y2="' + y(max * v) + '" stroke="var(--chart-grid, #DCE5E7)"/><text x="46" y="' + (y(max * v) + 5) + '" text-anchor="end">' + (max * v / 10000).toFixed(0) + '만</text>').join('');
    const lines = ['previous', 'sales'].map(key => { let path = '', connected = false; rows.forEach((row, i) => { if (row[key] == null) { connected = false; return; } path += (connected ? ' L ' : ' M ') + x(i) + ' ' + y(row[key]); connected = true; }); return '<path d="' + path + '" fill="none" stroke="' + (key === 'sales' ? 'var(--chart-current, #137C78)' : 'var(--chart-previous, #78869B)') + '" stroke-width="3" vector-effect="non-scaling-stroke"' + (key === 'previous' ? ' stroke-dasharray="6 5"' : '') + '/>'; }).join('');
    const points = rows.map((row, i) => row.sales == null && row.previous == null ? '' : '<g id="sd-point-' + row.date + '" tabindex="0" role="button" data-sd-date="' + row.date + '" aria-label="' + row.date + ' 매출 ' + money(row.sales) + ', 비교 ' + row.previousDate + ' ' + money(row.previous) + ', 해석 보기"><title>' + row.date + ': ' + money(row.sales) + '\n비교 ' + row.previousDate + ': ' + money(row.previous) + '</title><rect x="' + (x(i) - Math.max(5, Math.min(18, 230 / rows.length))) + '" y="25" width="' + Math.max(10, Math.min(36, 460 / rows.length)) + '" height="275" fill="transparent"/>' + (row.sales == null ? '' : '<circle cx="' + x(i) + '" cy="' + y(row.sales) + '" r="4" fill="var(--chart-current, #137C78)"/>') + '</g>').join('');
    const labels = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])].map(i => '<text x="' + x(i) + '" y="328" text-anchor="middle">' + rows[i].date.slice(5) + '</text>').join('');
    return '<div class="sd-chart-heading"><h3>일별 매출 추이</h3><div class="sd-legend"><span><i></i>분석 기간</span><span><i class="old"></i>비교 기간</span><small>원 · 같은 요일끼리 비교</small></div></div><div class="sd-chart-plot"><svg class="sd-trend" viewBox="0 0 560 344" role="group" aria-label="일별 매출 진단. 날짜를 선택하면 두 기간의 금액과 해석을 확인합니다.">' + ticks + lines + points + labels + '</svg></div>';
  }
  function dateInsight() {
    const row = result.daily.find(item => item.date === state.selectedDate);
    if (!row) return '<p class="sd-selection-hint sd-overall-insight">차트의 날짜를 선택하면 금액과 변화를 자세히 볼 수 있습니다.</p>';
    return '<div class="sd-inline-insight" aria-live="polite"><h4>' + row.date + ' 매출</h4><p>현재 <b>' + money(row.sales) + '</b> · 비교 ' + row.previousDate + ' <b>' + money(row.previous) + '</b></p><p class="' + tone(row.sales == null || row.previous == null ? 0 : row.sales - row.previous) + '">' + (row.sales == null ? '선택한 날짜의 자료가 없습니다.' : row.previous == null ? '완전한 비교 자료가 없어 변화 해석을 생략합니다.' : amountChange(row.sales - row.previous) + '. 취소를 차감한 판매 금액 기준입니다.') + '</p>' + button('이 날짜 판매 근거 보기', 'data-sd-detail="date" data-value="' + row.date + '"') + '</div>';
  }
  function movement() {
    return wrap('movement', heading('02', '일별 매출 진단', '날짜별 매출과 같은 요일 구성의 비교 값을 살펴보세요.') + '<div class="sd-wide-card">' + card(trendChart() + '<div class="sd-chart-footer"><details class="sd-definitions sd-chart-details"><summary>일별 비교 수치 보기</summary><div class="v-table-wrap"><table class="v-table"><thead><tr><th>분석 날짜</th><th>비교 날짜</th><th>매출</th><th>비교 매출</th></tr></thead><tbody>' + result.daily.map(row => '<tr><td>' + button(row.date, 'data-sd-date="' + row.date + '"') + '</td><td>' + row.previousDate + '</td><td>' + money(row.sales) + '</td><td>' + money(row.previous) + '</td></tr>').join('') + '</tbody></table></div></details>' + dateInsight() + '</div>') + '</div>');
  }
  function productSentence(row) {
    const change = row.previous == null ? '비교 자료 없음' : row.delta === 0 ? '변동 없음' : (row.delta > 0 ? '▲ ' : '▼ ') + money(Math.abs(row.delta));
    return change + (row.share == null ? '' : ' · 비중 ' + percent(row.share));
  }
  function products() {
    const rows = result.products.slice().sort((a, b) => { const av = a[state.sort], bv = b[state.sort]; if (av == null && bv == null) return a.label.localeCompare(b.label, 'ko'); if (av == null) return 1; if (bv == null) return -1; return (state.direction === 'asc' ? av - bv : bv - av) || a.label.localeCompare(b.label, 'ko'); });
    const sortHead = (key, label) => '<th class="right" aria-sort="' + (state.sort === key ? state.direction === 'asc' ? 'ascending' : 'descending' : 'none') + '">' + button(label + ' ' + (state.sort === key ? state.direction === 'asc' ? '↑' : '↓' : '↕'), 'data-sd-sort="' + key + '" aria-label="' + label + ' ' + (state.sort === key && state.direction === 'asc' ? '내림차순' : '오름차순') + ' 정렬"') + '</th>';
    return wrap('products', heading('04', '품목별 진단', '품목의 매출 비중·증감액·판매 수량을 비교합니다.') + card('<h3>품목별 판매 실적</h3><div class="v-table-wrap"><table class="v-table sd-product-table"><caption class="sd-sr-only">품목 클릭으로 행 안의 상세 진단을 펼칩니다. 증감액과 증감률은 각각 정렬할 수 있습니다.</caption><thead><tr><th>품목 · 한 줄 진단</th><th class="right">매출 / 비중</th><th class="right">비교 매출</th>' + sortHead('delta', '증감액') + sortHead('rate', '증감률') + '<th class="right">순판매 / 취소</th></tr></thead><tbody>' + (rows.length ? rows.map(row => '<tr data-sd-product="' + row.id + '"><td>' + button(esc(row.label) + (state.expandedItem === row.id ? ' ▴' : ' ▾'), 'data-sd-expand="' + row.id + '" aria-expanded="' + (state.expandedItem === row.id) + '" aria-controls="sd-insight-' + row.id + '"') + '<p class="sd-product-sentence">' + productSentence(row) + '</p></td><td class="right"><strong>' + money(row.sales) + '</strong><div class="sd-share"><span style="width:' + (row.share || 0) + '%"></span></div><small>' + percent(row.share) + '</small></td><td class="right">' + money(row.previous) + '</td><td class="right ' + tone(row.delta) + '">' + amountChange(row.delta) + '</td><td class="right ' + tone(row.delta) + '">' + delta(row.sales, row.previous) + '</td><td class="right">' + num(row.units) + '개 / ' + num(row.cancelled) + '개</td></tr><tr id="sd-insight-' + row.id + '" class="sd-product-insight"' + (state.expandedItem === row.id ? '' : ' hidden') + '><td colspan="6"><div class="sd-inline-insight"><h4>' + esc(row.label) + ' 판매 진단</h4><p>' + productSentence(row) + '</p><p>순판매 ' + num(row.units) + '개, 취소 ' + num(row.cancelled) + '개입니다. 품절·메뉴 노출·가격 변경 자료와 날씨 자료가 없어 증감 원인은 확정하지 않습니다.</p>' + button('원자료 근거 보기', 'data-sd-detail="item" data-value="' + row.id + '"') + '</div></td></tr>').join('') : '<tr><td colspan="6" class="sd-empty">선택한 조건의 품목이 없습니다.</td></tr>') + '</tbody></table></div><p class="sd-explanation">매출 비중은 현재 필터의 매출을 기준으로 합니다. 원가가 연결되지 않아 매출 순위를 이익 순위로 해석하지 않습니다.</p>'));
  }
  function weekdaySentence(row) {
    if (!row || row.average == null) return '선택한 요일의 정상 영업 기록이 없어 진단을 생략합니다.';
    if (row.previousAverage == null || row.previousAverage <= 0) return row.label + ' 일평균 매출은 ' + money(row.average) + '입니다. 비교 기준이 충분하지 않아 증감 해석을 생략합니다.';
    return row.label + ' 일평균 매출은 ' + money(row.average) + '로, 같은 요일 비교 대비 ' + amountChange(row.average - row.previousAverage) + '.';
  }
  function timing() {
    const max = Math.max(1, ...result.weekdays.flatMap(row => [row.average || 0, row.previousAverage || 0]));
    const selected = result.weekdays.find(row => row.id === state.selectedDay), peak = result.weekdays.filter(row => row.average != null).slice().sort((a, b) => b.average - a.average)[0];
    return wrap('timing', heading('03', '요일별 진단', '요일별 일평균 매출을 정상 영업일 기준으로 비교합니다.') + '<div class="sd-wide-card sd-weekday-card">' + card('<div class="sd-chart-heading"><h3>요일별 일평균 매출</h3><div class="sd-legend"><span><i></i>분석 기간</span><span><i class="old"></i>비교 기간</span><small>원 · 정상 영업일 기준</small></div></div><div class="sd-chart-plot sd-weekdays">' + result.weekdays.map(row => '<button type="button" class="sd-weekday" data-sd-weekday="' + row.id + '" aria-pressed="' + (state.selectedDay === row.id) + '"><span>' + row.label + '<small>' + row.count + '일 영업</small></span><span class="sd-bar-pair"><i style="width:' + (row.average || 0) / max * 100 + '%"></i><i class="old" style="width:' + (row.previousAverage || 0) / max * 100 + '%"></i></span><span>' + money(row.average) + '<small>비교 ' + money(row.previousAverage) + '</small></span></button>').join('') + '</div><div class="sd-chart-footer"><details class="sd-inline-insight sd-weekday-detail sd-chart-details"><summary>선택 요일 상세 보기</summary><p>' + weekdaySentence(selected) + '</p>' + (selected?.average == null ? '' : button('선택 요일 판매 근거 보기', 'data-sd-detail="day" data-value="' + state.selectedDay + '"')) + '</details><p class="sd-overall-insight">' + (peak ? '선택 조건에서 ' + peak.label + '의 일평균 매출이 ' + money(peak.average) + '로 가장 높습니다.' : '정상 영업 기록이 없어 요일 비교를 생략합니다.') + '</p></div>') + '</div>');
  }
  function expenses() {
    const f = result.expenseBreakdown, largest = f.categories.find(row => row.amount > 0), purchase = f.categories.find(row => row.id === 'purchase');
    const categoryRows = f.categories.map(row => '<div class="sd-cost" data-sd-cost="' + row.id + '"><div class="v-row v-between"><strong>' + esc(row.name) + '</strong><span>' + money(row.amount) + ' · ' + percent(row.share) + '</span></div><div class="v-progress"><span style="width:' + (row.share || 0) + '%"></span></div><small>비교 ' + money(row.previous) + ' · ' + coloredAmountChange(row.previous == null ? null : row.amount - row.previous) + '</small></div>').join('');
    return wrap('expenses', heading('05', '지출 진단', '입력된 지출의 구성과 재료별 매입금액을 확인합니다.') + '<div class="sd-finance-context"><span>총지출 <b>' + money(f.total) + '</b></span><span>매출 대비 지출 <b>' + percent(f.ratio) + '</b></span><span>비교 기간 대비 <b>' + coloredAmountChange(f.previous == null ? null : f.total - f.previous) + '</b></span></div><div class="sd-grid sd-expense-grid">' + card('<h3>지출 구성</h3>' + (largest ? '<p class="v-subtitle">' + esc(largest.name) + '이 전체 입력 지출의 ' + percent(largest.share) + '로 가장 큽니다.</p>' : '<p class="v-subtitle">표시할 지출 기록이 없습니다.</p>') + categoryRows, { wholeStore: true }) + card('<h3>품목별 매입금액</h3><p class="v-subtitle">매입비 합계 ' + money(purchase?.amount || 0) + '</p><div class="v-table-wrap"><table class="v-table sd-purchase-table"><thead><tr><th>품목</th><th class="right">매입량</th><th class="right">매입금액</th><th class="right">증감액</th></tr></thead><tbody>' + (f.purchases.length ? f.purchases.map(row => '<tr data-sd-purchase="' + row.id + '"><td>' + esc(row.name) + '</td><td class="right">' + row.quantity.toFixed(1) + ' ' + esc(row.unit) + '</td><td class="right">' + money(row.amount) + '</td><td class="right">' + coloredAmountChange(row.previous == null ? null : row.amount - row.previous) + '</td></tr>').join('') : '<tr><td colspan="4">매입 기록이 없습니다.</td></tr>') + '</tbody></table></div><p class="sd-explanation">매입량은 사용량과 다르며, 원가·이익은 계산하지 않습니다.</p>', { wholeStore: true }) + '</div><details class="sd-definitions"><summary>지출 집계 기준</summary><dl class="v-definition-list"><div><dt>집계 범위</dt><dd>분석 기간의 가게 전체 지출입니다. 품목·요일·시간 필터는 적용하지 않습니다.</dd></div><div><dt>매입비</dt><dd>재료 매입금액은 총지출에 이미 포함되어 있어 다시 더하지 않습니다.</dd></div><div><dt>생성 자료</dt><dd>월세·관리비·인건비·기타 지출은 월 시연 금액을 날짜별로 나눈 값입니다.</dd></div><div><dt>비교 기간</dt><dd>분석 ' + result.period.start + '~' + result.period.end + ' · 비교 ' + result.previousStart + '~' + result.previousEnd + '.</dd></div></dl></details>');
  }
  function render(period) {
    if (!state.manualTime) state.hour = A.currentRange();
    result = A.analyze(D, period, state);
    // The caller supplies the last completed calendar month; summary cards never inherit detail filters.
    monthlyResult = A.analyze(D, period, { comparison: state.comparison, hour: 'all' });
    if (state.selectedDate && !result.daily.some(row => row.date === state.selectedDate)) state.selectedDate = null;
    return summary() + wrap('daily-weekly', '<div class="sd-diagnosis-pair">' + movement() + timing() + '</div><div id="sd-relocated-extras">' + extrasRenderer(result) + '</div>') + products() + expenses();
  }
  function getRecoveryContext(period) {
    if (!state.manualTime) state.hour = A.currentRange();
    // Reuse the selected diagnosis filters without replacing the rendered evidence.
    const analysis = A.analyze(D, period || result?.period || D.periods.month, { ...state, days: state.days.slice() });
    const context = {
      source: 'sales', title: '매출진단',
      scope: analysis.period.start + ' ~ ' + analysis.period.end + ' · ' + scope(analysis) + ' · 비교 ' + analysis.previousStart + ' ~ ' + analysis.previousEnd + ' (' + (state.comparison === 'previous' ? '직전 같은 길이 기간' : '같은 요일 구성') + ')',
      findings: []
    };
    if (!analysis.dayCount || !analysis.products.length || !analysis.rows.length) {
      context.reason = !analysis.dayCount ? '선택 조건에 정상 영업 기록이 없어 실행 제안을 만들지 않았습니다.' : '선택 조건의 판매 기록이 없어 실행 제안을 만들지 않았습니다.';
      return context;
    }
    if (!analysis.currentComplete || !analysis.comparisonAvailable || analysis.previous.sales <= 0) {
      const reason = !analysis.currentComplete ? '분석 기간의 영업 기록이 일부 누락되어 기간 전체의 변화를 판단할 수 없습니다.' : !analysis.comparisonAvailable ? '완전한 비교 기간 자료가 없어 변화에 따른 실행 제안을 보류합니다.' : '비교 매출이 0 이하이므로 안정적인 비교 기준이 마련되지 않았습니다.';
      context.reason = reason;
      context.findings = [{ id: 'sales-comparison-insufficient', title: '매출 변화 판단 보류', evidence: '확인된 영업일 ' + num(analysis.dayCount) + '일의 선택 조건 매출은 ' + money(analysis.current.sales) + '입니다.', action: '', caveat: reason, status: 'insufficient' }];
      return context;
    }
    context.findings = analysis.actions.map(action => {
      const row = action.kind === 'item' ? analysis.products.find(product => product.id === action.value) : action.kind === 'slot' ? analysis.slots.find(slot => slot.id === action.value) : null;
      const evidence = action.evidence + (row ? ' 현재 ' + money(row.sales) + ' · 비교 ' + money(row.previous) + ' · 순판매 ' + num(row.units) + '개 · 취소 ' + num(row.cancelled) + '개.' : ' 현재 매출 ' + money(analysis.current.sales) + ' · 비교 매출 ' + money(analysis.previous.sales) + '.');
      return { id: action.id, title: action.title, evidence, action: action.task,
        caveat: action.kind === 'slot' ? '매출만으로 주문 대기나 인력 부족을 확정할 수 없습니다. 실제 운영 기록을 확인한 뒤 적용할 제안입니다.' : '품절·메뉴 노출·가격 변경·원가 자료는 연결되지 않았습니다. 원인이나 이익 개선 효과가 확정된 제안은 아닙니다.', status: 'ready' };
    });
    return context;
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
    const scopeOptions = {};
    if (kind === 'item') scopeOptions.item = title;
    if (kind === 'date') scopeOptions.period = { start: value, end: value };
    if (kind === 'day') scopeOptions.days = title;
    if (kind === 'cell') { const [day, hour] = value.split(':').map(Number); scopeOptions.days = dayNames[day] + '요일'; scopeOptions.time = A.ranges.find(row => row.start === hour)?.label || hour + '시~' + (hour + 1) + '시'; }
    return { title, scopeOptions, rows: result.rows.filter(predicate), oldRows: result.oldRows.filter(previousPredicate || predicate) };
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
    document.getElementById('sd-dialog-content').innerHTML = '<div class="sd-detail-totals"><span>현재 <b>' + money(current) + '</b></span><span>비교 <b>' + money(previous) + '</b></span><span class="' + tone(previous == null ? 0 : current - previous) + '">' + amountChange(previous == null ? null : current - previous) + '</span></div><p class="v-metadata">비교 기간: ' + result.previousStart + '~' + result.previousEnd + '<br>아래 표는 현재 선택 조건의 10분 단위 판매 기록입니다.</p><div id="sd-detail-records">' + recordTable(detail.rows) + '</div>' + scopeLine(result, detail.scopeOptions);
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
    document.addEventListener('change', event => {
      if (event.target.dataset.sdMulti !== undefined) {
        state.multiDay = event.target.checked;
        if (!state.multiDay && state.days.length > 1) state.days = state.days.slice(-1);
        state.expandedItem = null; refresh('[data-sd-multi]'); return;
      }
      const key = event.target.dataset.sdFilter; if (!['category', 'subcategory', 'item', 'hour'].includes(key)) return; state[key] = event.target.value; if (key === 'hour') state.manualTime = true; if (key === 'category') state.subcategory = 'all'; if (key === 'category' || key === 'subcategory') state.item = 'all'; state.expandedItem = null; refresh('#sd-' + key);
    });
    document.addEventListener('click', event => {
      const el = event.target.closest('[data-sd-reset], [data-sd-detail], [data-sd-close], [data-sd-page], [data-sd-export], [data-sd-day], [data-sd-sort], [data-sd-expand], [data-sd-weekday], [data-sd-date], [data-sd-toggle]'); if (!el) return;
      if (el.hasAttribute('data-sd-reset')) { Object.assign(state, { category: 'all', subcategory: 'all', item: 'all', hour: A.currentRange(), manualTime: false, days: [], multiDay: false, comparison: 'weekday', sort: 'sales', direction: 'desc', expandedItem: null, selectedDate: null }); refresh('[data-sd-reset]'); }
      if (el.hasAttribute('data-sd-day')) { const day = Number(el.dataset.sdDay); state.days = el.dataset.sdDay === 'all' ? [] : !state.multiDay ? [day] : state.days.includes(day) ? state.days.filter(value => value !== day) : [...state.days, day]; state.expandedItem = null; refresh('[data-sd-day="' + el.dataset.sdDay + '"]'); }
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
  window.IM_SALES_DIAGNOSIS = { render, bind, getRecoveryContext, setExtrasRenderer: fn => { extrasRenderer = typeof fn === 'function' ? fn : () => ''; } };
})();
