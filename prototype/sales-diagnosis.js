(function () {
  'use strict';
  const A = window.IM_SALES_DATA;
  const D = window.IM_MEETING_DEMO;
  const state = { comparison: 'previous', item: 'all', hour: 'all', dayType: 'all', sort: 'sales', page: 0, checks: new Set() };
  let result, redraw, dialog, detail, detailPage = 0;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => n == null ? '—' : Math.round(n).toLocaleString('ko-KR');
  const money = n => n == null ? '—' : num(n) + '원';
  const signed = n => n == null ? '비교 자료 없음' : (Math.round(n) > 0 ? '+' : Math.round(n) < 0 ? '−' : '') + money(Math.abs(n));
  const percent = n => n == null ? '—' : n.toFixed(1) + '%';
  const delta = (now, before) => now == null ? '산출 자료 없음' : before == null ? '비교 자료 없음' : before === 0 ? (now === 0 ? '변동 없음' : '기준값 0 · 증감률 미산정') : (now > before ? '+' : '') + percent(A.change(now, before));
  const tone = value => value < 0 ? 'sd-negative' : value > 0 ? 'sd-positive' : '';
  const button = (label, attrs, primary) => '<button type="button" class="v-button' + (primary ? ' primary' : '') + '" ' + attrs + '>' + label + '</button>';
  const tag = text => '<span class="v-tag neutral">' + text + '</span>';
  const card = body => '<article class="card v-card sd-card">' + body + '</article>';
  const options = (rows, value) => rows.map(([id, label]) => '<option value="' + id + '"' + (id === value ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
  const select = (label, key, rows) => '<label class="sd-field">' + label + '<select class="v-select" id="sd-' + key + '" data-sd-filter="' + key + '">' + options(rows, state[key]) + '</select></label>';
  const heading = (index, title, subtitle) => '<div class="sd-section-heading"><div><span class="sd-kicker">' + index + ' / 매출진단</span><h2>' + title + '</h2><p class="v-subtitle">' + subtitle + '</p></div>' + (index === '01' ? tag('생성 데이터 · POS 시연') : button('분석 조건 ↑', 'data-sd-jump="0"')) + '</div>';
  const wrap = (id, content) => '<div class="sd-panel" id="sd-panel-' + id + '">' + content + '</div>';
  const scope = () => [D.menu.find(item => item.id === state.item)?.name || '전체 품목', result.range.label, state.dayType === 'weekday' ? '평일' : state.dayType === 'weekend' ? '주말' : '모든 요일'].join(' · ');
  const scopeLine = () => '<p class="sd-scope">' + esc(result.period.start + ' ~ ' + result.period.end) + ' · ' + esc(scope()) + '</p>';
  function metric(label, value, current, previous, foot, primary) {
    return '<article class="card metric-card' + (primary ? ' primary' : '') + '"><div class="metric-label">' + label + '</div><div class="metric-value">' + value + '</div><div class="metric-foot"><strong class="' + tone(previous == null ? 0 : current - previous) + '">' + delta(current, previous) + '</strong></div><p class="v-metadata">' + foot + '</p></article>';
  }
  function summary() {
    const { current: c, previous: p, effects } = result;
    const change = p ? c.sales - p.sales : null;
    const title = !result.currentComplete ? '선택 조건에 해당하는 날짜가 없습니다.' : !p ? '현재 매출을 확인하고, 비교 기간을 조정해 보세요.' : change < 0 ? '매출이 줄었습니다. 감소한 지점부터 확인하세요.' : change > 0 ? '매출이 늘었습니다. 증가한 지점을 확인하세요.' : '매출이 유지되고 있습니다. 세부 변화를 살펴보세요.';
    const description = !p ? '비교 기간 전체를 포함하는 자료가 없어 증감률과 실행 후보를 만들지 않았습니다.' : '비교 기간 대비 순매출 ' + signed(change) + '.' + (effects ? ' 판매 수량 변화에 따른 영향은 ' + signed(effects.quantity) + '입니다.' : ' 비교 기간의 판매 수량이 없어 요인 분해는 제공하지 않습니다.');
    return wrap('summary', heading('01', '매출의 변화, 다음 행동까지', '우리 가게의 판매 기록으로 점검할 곳을 찾으세요.') +
      '<div class="sd-filters">' + select('비교 기준', 'comparison', [['previous', '직전 동일 일수'], ['weekday', '같은 요일 구성']]) + select('판매 품목', 'item', [['all', '전체 품목'], ...D.menu.map(item => [item.id, item.name])]) + select('시간대', 'hour', A.ranges.map(row => [row.id, row.label])) + select('요일', 'dayType', [['all', '모든 요일'], ['weekday', '평일'], ['weekend', '주말']]) + button('필터 초기화', 'data-sd-reset') + '</div>' +
      '<div class="sd-period-line"><span>분석 <b>' + result.period.start + ' ~ ' + result.period.end + '</b></span><span>비교 <b>' + result.previousStart + ' ~ ' + result.previousEnd + '</b> · ' + (state.comparison === 'weekday' ? '7일 배수만큼 이전으로 이동' : '직전 동일 일수') + '</span></div>' +
      '<div class="sd-insight" role="status"><div><span class="v-tag">이번 기간의 진단</span><h3>' + title + '</h3><p>' + description + '</p></div>' + button('변화 근거 보기 →', 'data-sd-jump="1"', true) + '</div>' +
      '<div class="metric-grid sd-metrics">' + metric('순매출', money(c.sales), c.sales, p?.sales, '취소 금액 차감', true) + metric('일평균 매출', money(c.average), c.average, p?.average, '선택 요일 ' + result.dayCount + '일 · 비교 ' + result.previousDayCount + '일') + metric('판매 수량', num(c.units) + '<small> 개</small>', c.units, p?.units, '주문 건수·방문 인원과 다릅니다') + metric('판매 1개당 평균 금액', money(c.unitAmount), c.unitAmount, p?.unitAmount, '순매출 ÷ 순판매 수량') + '</div>' +
      '<div class="v-connection-grid sd-cash-status" aria-label="자금 지표 연결 상태"><div><span>현금보유량</span><strong>미연결</strong></div><div><span>미정산 매출</span><strong>미연결</strong></div><div><span>예정 지출</span><strong>미연결</strong></div><div><span>정산 예정일</span><strong>미연결</strong></div></div><p class="v-metadata">현금보유량은 사업용 계좌 잔액과 보유 현금 자료가 필요합니다. 매출 − 지출로 계산하지 않습니다.</p>' +
      '<nav class="sd-section-links" aria-label="매출진단 섹션 이동">' + ['매출 변화', '품목별 진단', '요일·시간대', '지출과 실행', '집계 근거'].map((label, i) => button(label + ' ↗', 'data-sd-jump="' + (i + 1) + '"')).join('') + '</nav>' +
      '<details class="sd-definitions"><summary>데이터 범위와 계산 기준</summary><p>생성 자료 범위: 2026.07.01~09.02, 08~20시. 시간대의 끝 시각은 포함하지 않습니다. 날짜별 집계 존재 여부를 확인한 뒤 비교하며, 불완전한 이전 기간은 비교에 사용하지 않습니다. 일평균은 선택 요일의 관측 일수로 나누며 휴무 정보는 없습니다. 같은 요일 구성은 기간이 겹치지 않도록 7일의 배수만큼 이동합니다.</p><p>판매 1개당 평균 금액은 주문당 객단가가 아닙니다. 판매 채널·고객·주문번호는 연결 전입니다. 필터는 이 매출진단 화면에 적용되며, 홈·AI챗봇·PDF는 전체 품목 기준입니다. 데이터 기준일은 2026.09.02이며 실시간 자료가 아닙니다.</p></details>');
  }
  function trendChart() {
    const rows = result.daily, max = Math.max(1, ...rows.flatMap(row => [row.sales || 0, row.previous || 0]));
    const x = index => rows.length === 1 ? 355 : 58 + index * 602 / (rows.length - 1);
    const y = value => 184 - value / max * 148;
    const ticks = [0, .5, 1].map(value => '<line x1="58" x2="670" y1="' + y(max * value) + '" y2="' + y(max * value) + '" stroke="#e5eeeb"/><text x="48" y="' + (y(max * value) + 4) + '" text-anchor="end">' + (max * value / 10000).toFixed(0) + '만</text>').join('');
    const lines = ['previous', 'sales'].map(key => {
      let path = '', connected = false;
      rows.forEach((row, index) => { if (row[key] == null) { connected = false; return; } path += (connected ? ' L ' : ' M ') + x(index) + ' ' + y(row[key]); connected = true; });
      return '<path d="' + path + '" fill="none" stroke="' + (key === 'sales' ? '#198775' : '#9daeb8') + '" stroke-width="3"' + (key === 'previous' ? ' stroke-dasharray="6 5"' : '') + '/>';
    }).join('');
    const points = rows.map((row, i) => row.sales == null ? '' : '<g tabindex="0" role="button" data-sd-detail="date" data-value="' + row.date + '" aria-label="' + row.date + ' 순매출 ' + money(row.sales) + ', 비교 ' + row.previousDate + ' ' + money(row.previous) + ', 집계 상세 보기"><title>' + row.date + ': ' + money(row.sales) + '\n비교 ' + row.previousDate + ': ' + money(row.previous) + '</title><circle cx="' + x(i) + '" cy="' + y(row.sales) + '" r="11" fill="transparent"/><circle cx="' + x(i) + '" cy="' + y(row.sales) + '" r="3.5" fill="#198775"/></g>').join('');
    const labels = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])].map(i => '<text x="' + x(i) + '" y="210" text-anchor="middle">' + rows[i].date.slice(5) + '</text>').join('');
    return '<div class="sd-legend"><span><i></i>분석 기간</span><span><i class="old"></i>비교 기간</span><small>원 · 기간 내 순서로 나란히 비교</small></div><svg class="sd-trend" viewBox="0 0 710 228" role="group" aria-label="일별 순매출 비교. 점을 선택하면 해당 날짜의 집계를 확인합니다.">' + ticks + lines + points + labels + '</svg>';
  }
  function movement() {
    const e = result.effects;
    const max = e ? Math.max(1, Math.abs(e.quantity), Math.abs(e.amount), Math.abs(e.total)) : 1;
    return wrap('movement', heading('02', '매출이 얼마나, 어떻게 달라졌나요?', '수치로 확인되는 변화와 원인 추정을 구분합니다.') + scopeLine() + '<div class="sd-grid">' + card('<h3>일별 순매출 비교</h3>' + trendChart() + '<p class="v-metadata">점을 선택하면 날짜별 집계를 볼 수 있습니다. 필터에서 제외한 날짜는 선을 연결하지 않습니다.</p><details class="sd-definitions"><summary>일별 비교 수치 보기</summary><div class="v-table-wrap"><table class="v-table"><thead><tr><th>분석 날짜</th><th>비교 날짜</th><th>순매출</th><th>비교 순매출</th></tr></thead><tbody>' + result.daily.map(row => '<tr><td>' + button(row.date, 'data-sd-detail="date" data-value="' + row.date + '"') + '</td><td>' + row.previousDate + '</td><td>' + money(row.sales) + '</td><td>' + money(row.previous) + '</td></tr>').join('') + '</tbody></table></div></details>') +
      card('<h3>매출 증감액의 구성</h3><p class="v-subtitle">수량 변화 → 개당 평균 금액 변화 순서로 계산</p>' + (e ? '<div class="sd-effects">' + [['판매 수량 변화', e.quantity], ['개당 평균 금액 변화', e.amount], ['전체 매출 변화', e.total]].map(([label, value]) => '<div><div class="v-row v-between"><span>' + label + '</span><strong class="' + tone(value) + '">' + signed(value) + '</strong></div><div class="sd-effect-track"><span class="' + tone(value) + '" style="width:' + Math.abs(value) / max * 100 + '%"></span></div></div>').join('') + '</div>' : '<p class="sd-empty">완전한 비교 자료와 비교 기간의 판매 수량이 있어야 계산할 수 있습니다.</p>') + '<p class="sd-explanation">개당 평균 금액은 메뉴 구성·할인·가격에 따라 달라집니다. 실제 감소 원인은 품절·영업시간 등 운영 기록을 함께 확인해야 합니다.</p><details class="sd-definitions"><summary>계산식 보기</summary><p>수량 영향 = (현재 수량 − 이전 수량) × 이전 개당 평균 금액<br>개당 금액 영향 = 현재 순매출 − 현재 수량 × 이전 개당 평균 금액<br>두 영향의 합 = 현재 순매출 − 이전 순매출. 표시 금액은 원 단위 반올림으로 1원 차이가 날 수 있습니다.</p></details>') + '</div>');
  }
  function products() {
    const rows = result.products.slice().sort((a, b) => state.sort === 'delta' ? (a.delta || 0) - (b.delta || 0) : b.sales - a.sales);
    return wrap('products', heading('03', '어떤 메뉴에서 변화가 생겼나요?', '매출 비중과 증감액을 함께 보고 점검 순서를 정하세요.') + scopeLine() + card('<div class="v-row v-between"><h3>품목별 판매 실적</h3>' + select('정렬', 'sort', [['sales', '매출 높은 순'], ['delta', '감소액 큰 순']]) + '</div><div class="v-table-wrap"><table class="v-table sd-product-table"><caption class="sd-sr-only">선택 조건의 품목별 판매 실적. 품목 이름을 누르면 집계 상세를 확인합니다.</caption><thead><tr><th>품목</th><th class="right">순매출 / 비중</th><th class="right">비교 순매출</th><th class="right">증감액 / 증감률</th><th class="right">순판매 수량</th><th class="right">취소 수량</th></tr></thead><tbody>' + rows.map(row => '<tr><td>' + button(esc(row.label) + ' ↗', 'data-sd-detail="item" data-value="' + row.id + '"') + '</td><td class="right"><strong>' + money(row.sales) + '</strong><div class="sd-share"><span style="width:' + (row.share || 0) + '%"></span></div><small>' + percent(row.share) + '</small></td><td class="right">' + money(row.previous) + '</td><td class="right ' + tone(row.delta) + '"><strong>' + signed(row.delta) + '</strong><br><small>' + delta(row.sales, row.previous) + '</small></td><td class="right">' + num(row.units) + '개</td><td class="right">' + num(row.cancelled) + '개</td></tr>').join('') + '</tbody></table></div><p class="sd-explanation">품목을 누르면 날짜·시간별 판매 집계까지 확인할 수 있습니다. 매출 비중은 현재 필터의 순매출을 기준으로 하며, 매출 순위는 이익 순위와 다릅니다.</p>'));
  }
  function timing() {
    const max = Math.max(1, ...result.weekdays.flatMap(row => [row.average || 0, row.previousAverage || 0]));
    const heatMax = Math.max(1, ...result.heatmap.flatMap(row => row.cells.map(cell => cell.average || 0)));
    return wrap('timing', heading('04', '언제 운영을 점검해야 할까요?', '요일별 관측 일수가 달라도 비교할 수 있도록 일평균을 사용합니다.') + scopeLine() + '<div class="sd-grid sd-timing">' + card('<h3>요일별 일평균 매출</h3><div class="sd-legend"><span><i></i>분석 기간</span><span><i class="old"></i>비교 기간</span></div><div class="sd-weekdays">' + result.weekdays.map(row => '<button type="button" class="sd-weekday" data-sd-detail="day" data-value="' + row.id + '"><span>' + row.label + '<small>' + row.count + '일 관측</small></span><span class="sd-bar-pair"><i style="width:' + (row.average || 0) / max * 100 + '%"></i><i class="old" style="width:' + (row.previousAverage || 0) / max * 100 + '%"></i></span><span>' + money(row.average) + '<small>비교 ' + money(row.previousAverage) + '</small></span></button>').join('') + '</div>') + card('<h3>요일 × 시간대 매출</h3><p class="v-subtitle">색이 진할수록 해당 시간의 일평균 매출이 높습니다.</p><div class="v-table-wrap"><table class="sd-heatmap"><caption class="sd-sr-only">셀을 선택하면 해당 요일과 시간의 판매 집계를 확인합니다.</caption><thead><tr><th>요일</th>' + Array.from({ length: 12 }, (_, i) => '<th>' + (i + 8) + '시</th>').join('') + '</tr></thead><tbody>' + result.heatmap.map(row => '<tr><th>' + row.label[0] + '</th>' + row.cells.map(cell => '<td><button type="button" data-sd-detail="cell" data-value="' + cell.day + ':' + cell.hour + '"' + (cell.average == null ? ' disabled' : '') + ' style="--heat:' + (cell.average == null ? 0 : .09 + cell.average / heatMax * .85) + '" aria-label="' + row.label + ' ' + cell.hour + '~' + (cell.hour + 1) + '시, 일평균 ' + money(cell.average) + ', 상세 보기" title="' + row.label + ' ' + cell.hour + '시 · ' + money(cell.average) + '">' + (cell.average == null ? '—' : '<span class="sd-sr-only">' + money(cell.average) + '</span>') + '</button></td>').join('') + '</tr>').join('') + '</tbody></table></div><div class="sd-heat-legend"><span>낮음</span><i></i><span>높음</span><small>— 필터 제외 / 관측일 없음</small></div><p class="sd-explanation">셀을 눌러 실제 금액을 확인하세요. 색상은 현재 선택 조건 안의 상대적인 크기이며, 수익성이나 수요 예측을 뜻하지 않습니다.</p>') + '</div>');
  }
  function actions() {
    const f = result.finance, max = Math.max(1, ...f.byCategory.flatMap(row => [row.amount, row.previous]));
    const key = result.period.start + ':' + result.period.end + ':' + state.comparison + ':' + state.item + ':' + state.hour + ':' + state.dayType;
    return wrap('actions', heading('05', '오늘 무엇부터 확인하면 좋을까요?', '확인한 근거를 작은 운영 점검으로 연결하세요.') + '<div class="sd-grid">' + card('<div class="v-row v-between"><h3>지출 구조</h3>' + tag('가게 전체 · 품목/시간 필터 제외') + '</div><div class="sd-finance-summary"><div><small>전체 지출</small><strong>' + money(f.expense) + '</strong></div><div><small>전체 매출 − 지출</small><strong>' + money(f.delta) + '</strong></div></div>' + f.byCategory.map(row => '<div class="sd-cost"><div class="v-row v-between"><span>' + row.name + '</span><strong>' + money(row.amount) + '</strong></div><div class="sd-bar-pair"><i style="width:' + row.amount / max * 100 + '%"></i><i class="old" style="width:' + (f.comparisonAvailable ? row.previous / max * 100 : 0) + '%"></i></div><small>비교 ' + money(f.comparisonAvailable ? row.previous : null) + ' · ' + signed(f.comparisonAvailable ? row.amount - row.previous : null) + '</small></div>').join('') + '<p class="sd-explanation">같은 분석 기간의 가게 전체 지출입니다. 품목별 원가 배분 자료가 없어 필터별 이익은 계산하지 않습니다. 매출·지출 차이는 영업이익·보유 현금과 다릅니다.</p>') +
      card('<div class="v-row v-between"><h3>우선 점검할 일</h3>' + tag('규칙 기반 · 원인 후보') + '</div>' + scopeLine() + (result.actions.length ? '<div class="sd-actions">' + result.actions.map((action, i) => {
        const checkKey = key + ':' + action.id;
        return '<div class="sd-action"><div class="sd-action-title"><span class="v-number">0' + (i + 1) + '</span><h4>' + esc(action.title) + '</h4></div><p><b>근거</b> ' + esc(action.evidence) + '</p><p>' + esc(action.task) + '</p><small>확인 지표: ' + esc(action.measure) + '</small><div class="v-row v-between">' + button('근거 집계 보기 ↗', 'data-sd-detail="' + action.kind + '" data-value="' + action.value + '"') + '<label class="sd-check"><input type="checkbox" data-sd-check="' + esc(checkKey) + '"' + (state.checks.has(checkKey) ? ' checked' : '') + '>점검 완료</label></div></div>';
      }).join('') + '</div>' : '<p class="sd-empty">비교 가능한 판매 자료가 없습니다. 기간 또는 필터를 조정하면 근거에 맞는 점검 항목을 확인할 수 있습니다.</p>') + '<p class="sd-explanation">점검 상태는 이 페이지를 새로고침하면 초기화됩니다. 실행 결과나 예상 매출 증가액을 생성하지 않습니다. 7일 후 같은 요일·시간대와 비교하세요.</p>') + '</div>');
  }
  function recordTable(rows, page, modal) {
    const ordered = rows.slice().sort((a, b) => b.date.localeCompare(a.date) || b.hour - a.hour || a.itemId.localeCompare(b.itemId));
    const pages = Math.max(1, Math.ceil(rows.length / 8));
    const index = Math.max(0, Math.min(page, pages - 1));
    return '<div class="v-table-wrap"><table class="v-table sd-record-table"><caption class="sd-sr-only">취소가 차감된 날짜·시간·품목별 판매 집계</caption><thead><tr><th>날짜</th><th>시간</th><th>품목</th><th class="right">판매 / 취소</th><th class="right">순판매</th><th class="right">순매출</th></tr></thead><tbody>' + (ordered.slice(index * 8, index * 8 + 8).map(row => '<tr><td>' + row.date + '</td><td>' + row.hour + '~' + (row.hour + 1) + '시</td><td>' + esc(D.menu.find(item => item.id === row.itemId)?.name || row.itemId) + '</td><td class="right">' + num(row.quantity) + ' / ' + num(row.cancellations) + '개</td><td class="right">' + num(row.netQuantity) + '개</td><td class="right">' + money(row.netAmount) + '</td></tr>').join('') || '<tr><td colspan="6" class="sd-empty">선택 조건에 해당하는 판매 집계가 없습니다.</td></tr>') + '</tbody></table></div><div class="sd-pagination"><span>' + num(rows.length) + '개 집계 · ' + (index + 1) + ' / ' + pages + ' 페이지</span><div>' + button('이전', 'data-sd-page="' + (index - 1) + '" data-modal="' + modal + '"' + (index === 0 ? ' disabled' : '')) + button('다음', 'data-sd-page="' + (index + 1) + '" data-modal="' + modal + '"' + (index === pages - 1 ? ' disabled' : '')) + '</div></div>';
  }
  function records() {
    return wrap('records', heading('06', '진단의 근거를 직접 확인하세요', '화면에 표시한 수치는 아래 판매 집계에서 계산합니다.') + scopeLine() + card('<div class="v-row v-between"><h3>판매 집계 내역</h3>' + button('현재 조건 CSV 다운로드 ↓', 'data-sd-export', true) + '</div><p class="v-subtitle">순매출 합계 <b>' + money(result.current.sales) + '</b> · 순판매 ' + num(result.current.units) + '개 · 취소 ' + num(result.current.cancelled) + '개</p><div id="sd-records-body">' + recordTable(result.rows, state.page, false) + '</div><p class="sd-explanation">각 행은 날짜·시간·품목별 집계이며 개별 영수증이나 주문이 아닙니다. CSV에는 현재 조건의 전체 집계가 포함됩니다.</p>'));
  }
  function render(period) {
    result = A.analyze(D, period, state);
    return summary() + movement() + products() + timing() + actions() + records();
  }
  function jump(index) {
    const section = document.querySelectorAll('#viewRoot .v-screen-section')[index];
    if (section) { section.scrollIntoView({ behavior: 'instant', block: 'start' }); section.focus({ preventScroll: true }); }
  }
  function refresh(focusId) {
    const root = document.getElementById('viewRoot');
    const scrollTop = root.scrollTop, pageY = window.scrollY;
    const offsets = Array.from(root.querySelectorAll('.v-screen-inner')).map(el => el.scrollTop);
    redraw();
    root.scrollTop = scrollTop;
    root.querySelectorAll('.v-screen-inner').forEach((el, i) => { el.scrollTop = offsets[i] || 0; });
    window.scrollTo({ top: pageY, behavior: 'instant' });
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  }
  function getDetail(kind, value) {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    let title = '현재 조건 전체', predicate = () => true, previousPredicate;
    if (kind === 'item') { title = D.menu.find(item => item.id === value)?.name || value; predicate = row => row.itemId === value; }
    if (kind === 'slot') { const slot = A.ranges.find(row => row.id === value); title = slot.label; predicate = row => row.hour >= slot.start && row.hour < slot.end; }
    if (kind === 'date') { title = value; predicate = row => row.date === value; const previousDate = result.daily.find(row => row.date === value)?.previousDate; previousPredicate = row => row.date === previousDate; }
    if (kind === 'day') { title = dayNames[Number(value)] + '요일'; predicate = row => A.weekday(row.date) === Number(value); }
    if (kind === 'cell') { const [day, hour] = value.split(':').map(Number); title = dayNames[day] + '요일 ' + hour + '~' + (hour + 1) + '시'; predicate = row => A.weekday(row.date) === day && row.hour === hour; }
    return { title, rows: result.rows.filter(predicate), oldRows: result.oldRows.filter(previousPredicate || predicate) };
  }
  function showDetail(kind, value) {
    detail = getDetail(kind, value); detailPage = 0;
    const total = rows => rows.reduce((sum, row) => sum + row.netAmount, 0);
    const current = total(detail.rows), previous = result.previous ? total(detail.oldRows) : null;
    document.getElementById('sd-dialog-title').textContent = detail.title + ' · 판매 집계';
    document.getElementById('sd-dialog-content').innerHTML = scopeLine() + '<div class="sd-detail-totals"><span>현재 <b>' + money(current) + '</b></span><span>비교 <b>' + money(previous) + '</b></span><span>증감 <b class="' + tone(previous == null ? 0 : current - previous) + '">' + signed(previous == null ? null : current - previous) + '</b></span></div><p class="v-metadata">분석 ' + result.period.start + '~' + result.period.end + ' · 비교 ' + result.previousStart + '~' + result.previousEnd + '</p><p class="v-metadata">아래 표는 분석 기간의 집계입니다. 현재 품목·시간대·요일 필터가 함께 적용됩니다.</p><div id="sd-detail-records">' + recordTable(detail.rows, detailPage, true) + '</div>';
    dialog.showModal();
  }
  function exportCsv() {
    const header = ['자료유형', '분석시작', '분석종료', '비교시작', '비교종료', '품목필터', '시간필터', '요일필터', '집계ID', '일자', '시간', '품목', '판매수량', '취소수량', '순판매수량', '순매출(원)'];
    const escapeCsv = value => '"' + String(value).replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
    const lines = [header, ...result.rows.map(row => ['생성 데이터', result.period.start, result.period.end, result.previousStart, result.previousEnd, state.item, state.hour, state.dayType, row.id, row.date, row.hour, D.menu.find(item => item.id === row.itemId)?.name || row.itemId, row.quantity, row.cancellations, row.netQuantity, row.netAmount])];
    const blob = new Blob(['\uFEFF' + lines.map(row => row.map(escapeCsv).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'iM파트너_매출진단_생성자료_' + result.period.start + '_' + result.period.end + '.csv';
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function bind(callback) {
    redraw = callback;
    dialog = document.createElement('dialog'); dialog.className = 'v-modal sd-modal'; dialog.id = 'sd-dialog'; dialog.setAttribute('aria-labelledby', 'sd-dialog-title'); dialog.setAttribute('data-lenis-prevent', '');
    dialog.innerHTML = '<div class="v-row v-between">' + tag('생성 POS · 집계 상세') + button('닫기', 'data-sd-close aria-label="판매 집계 상세 닫기"') + '</div><h2 id="sd-dialog-title"></h2><div id="sd-dialog-content"></div>';
    document.body.append(dialog);
    document.addEventListener('change', event => {
      const key = event.target.dataset.sdFilter;
      if (key) { state[key] = event.target.value; state.page = 0; refresh(event.target.id); }
      if (event.target.hasAttribute('data-sd-check')) { const value = event.target.dataset.sdCheck; if (event.target.checked) state.checks.add(value); else state.checks.delete(value); }
    });
    document.addEventListener('click', event => {
      const el = event.target.closest('[data-sd-jump], [data-sd-reset], [data-sd-detail], [data-sd-close], [data-sd-page], [data-sd-export]');
      if (!el) return;
      if (el.hasAttribute('data-sd-jump')) jump(Number(el.dataset.sdJump));
      if (el.hasAttribute('data-sd-reset')) { Object.assign(state, { comparison: 'previous', item: 'all', hour: 'all', dayType: 'all', sort: 'sales', page: 0 }); refresh('sd-comparison'); }
      if (el.hasAttribute('data-sd-detail')) showDetail(el.dataset.sdDetail, el.dataset.value);
      if (el.hasAttribute('data-sd-close')) dialog.close();
      if (el.hasAttribute('data-sd-export')) exportCsv();
      if (el.hasAttribute('data-sd-page')) {
        const modal = el.dataset.modal === 'true', page = Number(el.dataset.sdPage);
        if (modal) detailPage = page; else state.page = page;
        const target = document.getElementById(modal ? 'sd-detail-records' : 'sd-records-body');
        target.innerHTML = recordTable(modal ? detail.rows : result.rows, page, modal);
        target.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
      }
    });
    document.addEventListener('keydown', event => {
      if (event.target.matches('g[data-sd-detail]') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); showDetail(event.target.dataset.sdDetail, event.target.dataset.value); }
    });
  }
  window.IM_SALES_DIAGNOSIS = { render, bind };
})();
