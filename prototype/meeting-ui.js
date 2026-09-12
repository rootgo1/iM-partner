(function () {
  'use strict';
  const D = window.IM_MEETING_DEMO;
  if (!D) { document.getElementById('viewRoot').textContent = '생성 데이터 파일을 불러오지 못했습니다. meeting-data.js 파일을 확인해 주세요.'; return; }
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => Math.round(n).toLocaleString('ko-KR') + '원';
  const pct = n => n == null ? '비교 자료 없음' : (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  const compact = n => (n / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '만';
  const number = n => Math.round(n).toLocaleString('ko-KR');
  const ratioText = n => n == null ? '—' : n.toFixed(1) + '%';
  const financeTemperatureFromExpenseRatio = value => Number.isFinite(value)
    ? Math.max(0, Math.min(100, 100 - value))
    : null;
  const dateText = value => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1.$2.$3');
  const button = (label, attrs, primary) => '<button type="button" class="v-button' + (primary ? ' primary' : '') + '" ' + attrs + '>' + label + '</button>';
  const badge = (label, variant) => '<span class="v-tag ' + (variant || '') + '">' + esc(label) + '</span>';
  const note = (text, variant) => '<div class="v-note ' + (variant || '') + '">' + text + '</div>';
  const card = (body, variant) => '<article class="card v-card' + (variant ? ' ' + variant : '') + '">' + body + '</article>';
  const head = (title, extra) => '<div class="v-row v-between"><h2>' + title + '</h2>' + (extra || '') + '</div>';
  const productName = korean => '<span class="im-product-name"><span>iM</span><span class="im-product-korean">' + korean + '</span></span>';
  const avatarName = value => {
    const characters = Array.from(String(value || '').trim().replace(/\s+/g, ''));
    if (characters.length <= 1) return characters[0] || '?';
    if (characters.length === 2) return characters[1];
    return characters.slice(-2).join('');
  };
  const views = { dashboard: '홈', analysis: '매출진단', recovery: '회복전략', policies: '지원사업', secretary: 'iM비서', profile: '내 프로필' };
  const navigationViews = ['dashboard', 'analysis', 'recovery', 'policies', 'secretary'];
  const legacyViews = { market: 'analysis', finance: 'analysis' };
  const normalizeView = view => legacyViews[view] || view;
  const captions = {
    dashboard: '가게의 오늘을 살펴보세요.',
    analysis: '상권의 기회와 가게의 매출을 함께 보세요.',
    recovery: '분석에서, 오늘의 실행으로.',
    policies: '내 가게에 맞는 지원을 찾아보세요.',
    secretary: '질문으로 분석하고, 문서로 남기세요.',
    profile: '내 가게의 기준 정보를 확인하세요.'
  };
  const state = {
    view: 'dashboard', periodMode: 'month', period: Object.assign({}, D.periods.month), profile: Object.assign({}, D.profile),
    policyView: 'recommended', keyword: '', category: 'all', offset: 0,
    reportMessages: [], reportBlobUrl: null, reportReady: false, reportRevision: 0, pdfBusy: false,
    guideHour: null, contextMode: 'traffic', chartMode: 'hour', chartSeries: [], bannerIndex: 0, bannerPaused: false, chatOpen: false, radius: 500, recoveryStarted: false
  };
  let analysis = D.analyze(state.period);
  const recoveryData = D.analyzeRecovery();
  let financeIndex = D.financialIndex();
  let clockKey = "";
  const sourceFoot = '<p class="v-footer">생성 데이터 기반 시연 · 실제 POS·카드사·통신사 원자료가 아닙니다. 이 화면에는 DB·외부 API·실제 AI가 연결되어 있지 않습니다.</p>';
  function icon(name) {
    const paths = {
      dashboard: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5v10.2c0 .7.6 1.3 1.3 1.3h10.4c.7 0 1.3-.6 1.3-1.3V9.5M9.5 21v-6.5h5V21"/>',
      analysis: '<path d="M4 5v14.5c0 .3.2.5.5.5H20"/><path d="m7 15 3.2-4.2 3.1 2.4L18.5 7"/><circle cx="18.5" cy="7" r="1.5"/>',
      recovery: '<circle cx="5" cy="18.5" r="2"/><circle cx="18.5" cy="5" r="2"/><path d="M7 18.5h3.5a3 3 0 0 0 3-3v-4a3 3 0 0 1 3-3h2"/>',
      policies: '<path d="M6 3.5h8l4 4v12A1.5 1.5 0 0 1 16.5 21h-10A1.5 1.5 0 0 1 5 19.5V5a1.5 1.5 0 0 1 1-1.5z"/><path d="M14 3.5V8h4.5M8.5 14.5l2 2 4-4"/>',
      secretary: '<path d="M12 3.5 14.2 9l5.3 2.2-5.3 2.2L12 19l-2.2-5.6-5.3-2.2L9.8 9 12 3.5z"/><path d="M5.5 3v3M4 4.5h3M19 17.5v3M17.5 19h3"/>',
      profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + '</svg>';
  }
  $('#mainNavigation').innerHTML = navigationViews.map(id =>
    '<button type="button" class="nav-item" data-view="' + id + '" title="' + views[id] + '" aria-label="' + views[id] + '"><span class="nav-icon">' + icon(id) + '</span><span class="nav-label">' + (id === 'secretary' ? productName('비서') : views[id]) + '</span></button>'
  ).join('');
  function metricTrend(delta, direction) {
    if (delta === undefined) return '';
    if (delta == null) return '<span class="trend-neutral">비교 자료 없음</span>';
    if (direction === 'expense') {
      if (delta > 0) return '<span class="trend-caution">▲ ' + Math.abs(delta).toFixed(1) + '% 증가</span>';
      if (delta < 0) return '<span class="trend-up">▼ ' + Math.abs(delta).toFixed(1) + '% 감소</span>';
      return '<span class="trend-neutral">변동 없음</span>';
    }
    return '<span class="' + (delta < 0 ? 'trend-down' : 'trend-up') + '">' + pct(delta) + '</span>';
  }
  function metric(label, value, delta, foot, primary, direction) {
    return '<article class="card metric-card' + (primary ? ' primary' : '') + '"><div class="metric-label">' + label + '</div><div class="metric-value">' + value +
      '</div><div class="metric-foot">' + metricTrend(delta, direction) + '<span>' + foot + '</span></div></article>';
  }
  function indexChange(value) {
    if (value == null) return '<span class="v-index-change is-neutral">비교 자료 없음</span>';
    return '<span class="v-index-change ' + (value > 0 ? 'is-up' : value < 0 ? 'is-down' : 'is-neutral') + '" aria-label="' + Math.abs(value).toFixed(1) + '% ' + (value > 0 ? '상승' : value < 0 ? '하락' : '변동 없음') + '">' + '<i class="v-index-arrow" aria-hidden="true">' + (value > 0 ? '▲' : value < 0 ? '▼' : '—') + '</i> ' + Math.abs(value).toFixed(1) + '%</span>';
  }
  function marketMetric(label, value, scope) {
    return '<article class="card metric-card v-market-metric"><div class="metric-label">' + label + '</div><div class="metric-value">' + indexChange(value) + '</div><div class="v-metric-meta"><span>' + esc(state.period.comparison) + '</span><span>' + esc(scope) + '</span></div></article>';
  }
  function comparisonChart() {
    const rows = state.chartMode === 'weekday' ? analysis.weekdaySlots : analysis.slots;
    const series = [
      { key: 'traffic', label: '상권 유동인구', color: '#278a77', dash: '', unit: '명' },
      { key: 'card', label: '카드소비', color: '#bb741e', dash: '9 5', unit: '원' },
      { key: 'sales', label: '우리 가게 매출', color: '#426bcc', dash: '', unit: '원' },
      { key: 'storefront', label: '우리 가게 앞 유동인구', color: '#9560b4', dash: '3 5', unit: '명' }
    ];
    const x = i => 55 + i * 490 / Math.max(1, rows.length - 1), y = value => 210 - value * 1.65;
    let svg = '<svg class="v-chart" viewBox="0 0 600 255" role="group" aria-label="네 지표의 상대 지수 비교. 범례 또는 선을 여러 개 선택해 함께 강조할 수 있습니다.">';
    [0, 50, 100].forEach(value => { svg += '<line x1="55" x2="550" y1="' + y(value) + '" y2="' + y(value) + '" stroke="#e6eee9"/><text x="12" y="' + (y(value) + 5) + '">' + value + '</text>'; });
    series.forEach(item => {
      const max = Math.max(1, ...rows.map(row => row[item.key] || 0));
      let connected = false;
      const path = rows.map((row, i) => {
        if (row[item.key] == null) { connected = false; return ''; }
        const command = connected ? 'L' : 'M'; connected = true;
        return command + x(i).toFixed(1) + ' ' + y(row[item.key] / max * 100).toFixed(1);
      }).join(' ');
      svg += '<g data-chart-line="' + item.key + '" data-series="' + item.key + '" role="button" tabindex="0" aria-label="' + item.label + ' 강조" aria-pressed="false"><path d="' + path + '" fill="none" stroke="transparent" stroke-width="16" pointer-events="stroke"/><path d="' + path + '" fill="none" stroke="' + item.color + '" stroke-width="3" stroke-dasharray="' + item.dash + '" stroke-linecap="round"/>';
      rows.forEach((row, i) => {
        if (row[item.key] != null) svg += '<circle cx="' + x(i) + '" cy="' + y(row[item.key] / max * 100) + '" r="4" fill="' + item.color + '"><title>' + row.label + ' · ' + item.label + ' ' + number(row[item.key]) + item.unit + '</title></circle>';
      });
      svg += '</g>';
    });
    rows.forEach((row, i) => { svg += '<text x="' + x(i) + '" y="241" text-anchor="middle">' + row.label + '</text>'; });
    return '<div class="v-comparison-chart"><div class="v-chart-mode" aria-label="그래프 집계 단위">' + ['hour', 'weekday'].map(mode => '<button type="button" data-chart-mode="' + mode + '" aria-pressed="' + (state.chartMode === mode) + '">' + (mode === 'hour' ? '시간대별' : '요일별') + '</button>').join('') + '</div><p class="v-chart-selection-note">비교할 지표를 여러 개 선택하세요. 선택을 모두 해제하면 전체를 표시합니다.</p><div class="v-legend v-series-legend">' + series.map(item => '<button type="button" data-series="' + item.key + '" aria-pressed="false"><svg width="24" height="10" aria-hidden="true"><line x1="0" x2="24" y1="5" y2="5" stroke="' + item.color + '" stroke-width="3" stroke-dasharray="' + item.dash + '"/></svg>' + item.label + '</button>').join('') + '</div>' + svg + '</svg><p class="v-metadata">' + esc(state.period.start + ' ~ ' + state.period.end) + ' · 생성 자료<br>각 지표의 최댓값 = 100 · ' + (state.chartMode === 'weekday' ? '관측일 수로 나눈 요일별 일평균' : '선택 기간의 시간대별 합계') + ' · 점 위에서 실제 수치 확인<br>카드소비는 별도 상권 표본이며, 홈의 서비스 이용 가게 소비 합계와 범위가 다릅니다.</p></div>';
  }
  function syncChartSelection() {
    document.querySelectorAll('[data-series]').forEach(node => {
      const selected = state.chartSeries.includes(node.dataset.series);
      node.setAttribute('aria-pressed', String(selected));
      node.style.opacity = state.chartSeries.length && !selected ? '.18' : '1';
    });
  }
  function highlightChartSeries(key) {
    if (!['traffic', 'card', 'sales', 'storefront'].includes(key)) return;
    state.chartSeries = state.chartSeries.includes(key) ? state.chartSeries.filter(item => item !== key) : [...state.chartSeries, key];
    syncChartSelection();
  }
  function salesChart() {
    const rows = analysis.daily, max = Math.max(1, ...rows.flatMap(r => [r.sales, r.expense]));
    const scale = Math.ceil(max / 200000) * 200000, y = v => 200 - v / scale * 160;
    const x = i => 66 + i * 484 / Math.max(1, rows.length - 1);
    let svg = '<svg class="v-chart" viewBox="0 0 600 250" role="img" aria-label="생성 자료의 일별 매출과 지출, 같은 원 단위 축 사용">';
    [0, .5, 1].forEach(r => { svg += '<line x1="65" x2="555" y1="' + y(scale * r) + '" y2="' + y(scale * r) + '" stroke="#e6eee9"/><text x="3" y="' + (y(scale * r) + 5) + '">' + compact(scale * r) + '</text>'; });
    ['sales', 'expense'].forEach((key, k) => { svg += '<path d="' + rows.map((r, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(r[key]).toFixed(1)).join(' ') + '" fill="none" stroke="' + (k ? '#e7a04f' : '#399b87') + '" stroke-width="3"/>'; });
    rows.forEach((r, i) => { if (i === 0 || i === rows.length - 1 || (rows.length > 14 && i % 7 === 0 && i < rows.length - 3)) svg += '<text x="' + x(i) + '" y="230" text-anchor="middle">' + r.date.slice(5).replace('-', '/') + '</text>'; });
    return '<div class="v-legend"><span><i class="v-dot"></i>매출</span><span><i class="v-dot orange"></i>지출</span></div>' + svg + '</svg>';
  }
  function causeText() {
    if (analysis.salesRate == null) return '비교 기간 자료가 부족합니다. 현재 기간의 시간대별 지표부터 확인해 보세요.';
    return '내 가게 매출 ' + pct(analysis.salesRate) + ', 상권 카드소비 ' + pct(analysis.cardRate) + ', 유동인구 ' + pct(analysis.trafficRate) + '입니다. ' + analysis.focus.label + ' 상대 지수 차이를 운영 점검의 요인 후보로 살펴보세요.';
  }
  function dashboardInsight() {
    const insight = D.salesInsight(state.period), clock = insight.clock;
    const available = insight.status === 'available';
    const stamp = String(clock.hour).padStart(2, '0') + ':' + String(clock.minute).padStart(2, '0') + ' 현재';
    const title = insight.status === 'off_hours' ? '다음 영업을 준비하세요.' : available ? insight.slot.label + ' 운영 점검' : '판매 기록을 기다리고 있어요.';
    return '<article class="card insight-card v-decision-action v-dashboard-insight"><div class="v-dashboard-insight-head"><span class="v-tag">현재 매출진단</span><span>' + stamp + '</span></div>' +
      '<h2>' + title + '</h2><p class="v-dashboard-insight-lead">' + (available ? '현재 시간대의 평소 판매·통행 흐름입니다.' : insight.status === 'off_hours' ? '분석 가능한 시간대는 08~20시입니다.' : '선택 기간에 비교할 매출 자료가 없습니다.') + '</p>' +
      (available ? '<div class="v-dashboard-insight-values"><div><span>시간대 일평균 매출</span><strong>' + compact(insight.salesAverage) + '<small> 원</small></strong></div><div><span>가게 앞 일평균 통행</span><strong>' + (insight.storefrontAverage == null ? '자료 없음' : number(insight.storefrontAverage) + '<small>명</small>') + '</strong></div></div>' : '') +
      '<div class="v-dashboard-insight-point"><span>해석과 다음 행동</span><strong>' + (available ? insight.title : '재료와 정산 일정을 확인하세요.') + '</strong><p>' + (available ? insight.action : '다음 영업시간의 준비 수량과 예정 지출을 점검하세요.') + '</p>' +
      (available ? '<small>하루 매출 중 이 시간대 비중 <b>' + ratioText(insight.share) + '</b></small>' : '') + '</div>' +
      '<p class="v-dashboard-insight-source">' + dateText(state.period.start) + '~' + dateText(state.period.end) + ' 기준 · 실시간 실적 아님</p>' +
      '<button class="v-button primary v-dashboard-insight-action" type="button" data-view="recovery">회복전략 확인하기 →</button></article>';
  }
  function costText() {
    const purchase = analysis.byCategory.find(r => r.id === 'purchase');
    return '매출 ' + money(analysis.sales) + '에 지출 ' + money(analysis.expense) + '입니다. 매입비는 ' + money(purchase.amount) + '이며, ' +
      (analysis.comparisonAvailable ? '직전 기간보다 ' + pct(D.rate(purchase.amount, purchase.previous)) + ' 변했습니다. ' : '직전 기간 비교 자료가 부족합니다. ') +
      '매출·지출 차이는 회계상 영업이익이나 현재 현금잔액이 아닙니다.';
  }
  function guideHourPicker(hour) {
    const hours = Array.from({ length: 12 }, (_, index) => index + 8);
    const label = value => String(value).padStart(2, '0') + ':00';
    return '<div class="v-guide-hour-picker"><button class="v-guide-hour-trigger" id="guideHourButton" type="button" data-action="toggle-guide-hour" aria-labelledby="guideHourLabel guideHourValue" aria-haspopup="listbox" aria-expanded="false" aria-controls="guideHourMenu"><span id="guideHourValue">' + label(hour) + '</span><i aria-hidden="true">⌄</i></button>' +
      '<div class="v-guide-hour-menu" id="guideHourMenu" role="listbox" aria-label="행동 안내 기준 시간" hidden>' + hours.map(value =>
        '<button class="v-guide-hour-option" type="button" role="option" data-guide-hour="' + value + '" aria-selected="' + (value === hour) + '">' + label(value) + '</button>'
      ).join('') + '</div></div>';
  }
  function setGuideHourMenu(open) {
    const menu = $('#guideHourMenu');
    const trigger = $('#guideHourButton');
    if (!menu || !trigger) return;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    trigger.classList.toggle('open', open);
    if (open) {
      const selected = document.querySelector('[data-guide-hour][aria-selected="true"]');
      if (selected) setTimeout(() => selected.focus({ preventScroll: true }), 0);
    }
  }
  function selectGuideHour(value) {
    const hour = Math.max(8, Math.min(19, Number(value)));
    state.guideHour = hour;
    const triggerValue = $('#guideHourValue');
    if (triggerValue) triggerValue.textContent = String(hour).padStart(2, '0') + ':00';
    document.querySelectorAll('[data-guide-hour]').forEach(option => option.setAttribute('aria-selected', String(Number(option.dataset.guideHour) === hour)));
    if ($('#guidanceContent')) $('#guidanceContent').innerHTML = guidanceContent(hour);
    setGuideHourMenu(false);
    if ($('#guideHourButton')) $('#guideHourButton').focus({ preventScroll: true });
  }
  function guidanceCard() {
    const currentHour = Number(new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', hour12: false, timeZone: 'Asia/Seoul' }).format(new Date()).replace(/\D/g, '')) % 24;
    const hour = state.guideHour === null ? Math.max(8, Math.min(19, currentHour)) : state.guideHour;
    return '<div class="v-guidance-head"><div><span class="v-guidance-kicker">시간대별 운영 안내</span><h2>지금 무엇을 하면 좋을까요</h2></div>' + badge('최근 30일 참고', 'neutral') + '</div>' +
      '<div class="v-guidance-time"><span id="guideHourLabel">확인 시간</span>' + guideHourPicker(hour) + '</div><div id="guidanceContent" class="v-guidance-content">' + guidanceContent(hour) + '</div>' +
      '<button class="v-button primary v-guidance-action" type="button" data-view="analysis">시간대별 매출진단 보기 →</button>';
  }
  function guidanceContent(hour) {
    const g = D.guidance(hour);
    if (g.average == null) return '<div class="v-guidance-empty"><span>선택 시간 안내</span><h3>' + g.title + '</h3><p>' + g.text + '</p></div>';
    const periodLabel = hour < 11 ? '오전 운영' : hour < 15 ? '점심 운영' : '저녁 운영';
    return '<div class="v-guidance-result"><span class="v-guidance-result-label">' + periodLabel + ' · ' + String(hour).padStart(2, '0') + ':00</span><h3>' + g.title + '</h3><p>' + g.text + '</p>' +
      '<div class="v-guidance-facts"><div><span>해당 시간 일평균 매출</span><strong>' + money(g.average) + '</strong></div><div><span>하루 매출 중 비중</span><strong>' + ratioText(g.share) + '</strong></div></div>' +
      '<div class="v-guidance-checklist"><span>지금 확인할 항목</span>' + g.checks.map((item, index) => '<div><i>0' + (index + 1) + '</i><p><strong>' + esc(item.title) + '</strong><small>' + esc(item.detail) + '</small></p></div>').join('') + '</div>' +
      '<p class="v-guidance-note">' + dateText(g.period.start) + '~' + dateText(g.period.end) + ' 생성 기록 · 최근 30일 일평균<br>매출 비중 = 해당 시간 매출 ÷ 하루 매출 · 실제 수요 예측 아님</p></div>';
  }
  function dashboardContextCard() {
    const context = D.neighborhoodInsights();
    const date = dateText(context.today) + ' ' + context.weekdayLabel;
    const header = '<div class="v-dashboard-context-head"><div><span class="v-context-kicker">' + date + ' · 영업 준비 참고</span><h2>주변 상권 흐름</h2></div>' + badge('30일 패턴', 'neutral') + '</div>';
    if (!context.slots.length) return '<article class="card v-card v-dashboard-context">' + header + '<p class="v-subtitle">최근 30일의 상권 자료가 준비되면 같은 요일의 소비·유동 패턴을 안내합니다.</p></article>';
    const mode = state.contextMode, trafficMode = mode === 'traffic';
    const peak = context.slots.reduce((best, row) => row[mode] > best[mode] ? row : best);
    const max = Math.max(1, ...context.slots.map(row => row[mode]));
    const unit = trafficMode ? '명' : '원';
    const value = trafficMode ? number(context.traffic) + '명' : money(context.consumption);
    const delta = trafficMode ? context.trafficRate : context.consumptionRate;
    return '<article class="card v-card v-dashboard-context">' + header +
      '<div class="v-context-tabs" aria-label="주변 상권 분석 지표"><button type="button" data-context-mode="traffic" aria-pressed="' + trafficMode + '">유동인구</button><button type="button" data-context-mode="consumption" aria-pressed="' + !trafficMode + '">이용 가게 소비</button></div>' +
      '<div class="v-context-highlight"><span>최근 30일 중 ' + context.weekdayLabel + '의 ' + (trafficMode ? '유동' : '소비') + ' 집중 시간</span><h3>' + peak.label + '</h3><p>' + (trafficMode ? '주변 통행이 가장 많았던 시간대입니다.' : '서비스 이용 가게의 소비가 가장 많았던 시간대입니다.') + '</p></div>' +
      '<p class="v-context-chart-unit">단위: ' + (trafficMode ? '명' : '만 원') + ' · 시간(시)</p><div class="v-context-bars" role="img" aria-label="' + context.weekdayLabel + ' 시간대별 일평균 ' + (trafficMode ? '유동인구' : '서비스 이용 가게 소비') + '">' + context.slots.map(row => '<div class="' + (row.hour === peak.hour ? 'is-peak' : '') + '" title="' + row.label + ' · ' + number(row[mode]) + unit + '"><span class="v-context-bar-track"><i style="height:' + Math.max(2, row[mode] / max * 100).toFixed(1) + '%"></i></span><strong>' + (trafficMode ? number(row[mode]) : compact(row[mode]).replace('만', '')) + '</strong><small>' + row.label.replace('시', '') + '</small></div>').join('') + '</div>' +
      '<div class="v-context-summary"><div><span>' + context.weekdayLabel + ' 하루 평균</span><strong>' + value + '</strong></div><div><span>30일 전체 일평균 대비</span><strong>' + indexChange(delta) + '</strong></div></div>' +
      '<div class="v-context-action"><span>영업에 이렇게 활용하세요</span><p>' + (trafficMode ? peak.label + ' 전에 대표 메뉴·가격이 잘 보이는지 점검하세요.' : peak.label + ' 판매에 맞춰 재료 준비와 주문 응대 인력을 점검하세요.') + '</p><button class="text-button" type="button" data-view="analysis">매출진단과 함께 보기 →</button></div>' +
      '<p class="v-context-source">' + dateText(context.period.start) + '~' + dateText(context.period.end) + ' 중 같은 요일 ' + context.count + '일 평균 · 생성 자료<br>' + (trafficMode ? '상권 유동인구 표본' : '상권 내 서비스 이용 가게 ' + context.merchantCount + '곳의 소비 합계') + ' · 오늘 실적·수요 예측 아님<br>날씨·행사 정보는 아직 연결되지 않았습니다.</p></article>';
  }
  function periodOptions(selected) {
    return [
      ['month', '2026년 8월 · 한 달'],
      ['week', '최근 7일 · 8/27~9/2'],
      ['custom', '직접 기간 선택']
    ].map(option => '<option value="' + option[0] + '"' + (option[0] === selected ? ' selected' : '') + '>' + option[1] + '</option>').join('');
  }
  function sectionPeriodControl() {
    return '<div class="v-section-period-control"><span>분석 기간</span><select class="v-select" id="sectionPeriodSelect" aria-label="분석 기간">' + periodOptions(state.periodMode) + '</select></div>' +
      '<form class="v-section-custom-period" id="sectionCustomPeriod"' + (state.periodMode === 'custom' ? '' : ' hidden') + '><label>시작일<input id="sectionPeriodStart" type="date" value="' + state.period.start + '" min="2026-07-01" max="2026-09-02" required></label><label>종료일<input id="sectionPeriodEnd" type="date" value="' + state.period.end + '" min="2026-07-01" max="2026-09-02" required></label><button class="v-button" type="submit">기간 적용</button></form>';
  }
  function sectionPeriodNodes() {
    const holder = document.createElement('div');
    holder.innerHTML = sectionPeriodControl();
    return Array.from(holder.children);
  }
  function recoveryScreenGroups(children) {
    const [hero, source, layout, comparison, support, footer] = children;
    if (!layout || !layout.matches('.v-recovery-layout')) return [[hero, source], [layout], [comparison], [support, footer]].filter(group => group.some(Boolean));
    const stacks = Array.from(layout.children);
    const primaryCards = stacks[0] ? Array.from(stacks[0].children) : [];
    const actionCards = stacks[1] ? Array.from(stacks[1].children) : [];
    const pair = (left, right, variant) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'v-recovery-screen-grid ' + variant;
      if (left) wrapper.append(left);
      if (right) wrapper.append(right);
      return wrapper;
    };
    return [
      [hero, source],
      [pair(primaryCards[0], actionCards[0], 'diagnosis')],
      [pair(primaryCards[1], actionCards[1], 'action')],
      [comparison],
      [support, footer]
    ].filter(group => group.some(Boolean));
  }
  function screenGroups(view, children) {
    const groupByIndexes = indexes => indexes.map(group => group.map(index => children[index]).filter(Boolean));
    if (view === 'dashboard') return groupByIndexes([[0, 1], [2], [3], [4, 5]]);
    if (view === 'analysis' && window.IM_SALES_DIAGNOSIS) return groupByIndexes([[0], [1], [2], [3], [4], [5, 6]]);
    if (view === 'analysis') return groupByIndexes([[3, 4], [0, 1], [5, 6], [7], [2], [8, 9]]);
    if (view === 'recovery') return recoveryScreenGroups(children);
    if (view === 'policies') return groupByIndexes([[0], [1]]);
    if (view === 'secretary') return groupByIndexes([[0]]);
    if (view === 'profile') return groupByIndexes([[1, 0, 2]]);
    return children.map(child => [child]);
  }
  function sectionizeView(view) {
    const root = $('#viewRoot');
    const children = Array.from(root.children);
    if (!children.length || typeof root.querySelectorAll !== 'function') return;
    const groups = screenGroups(view, children).filter(group => group.length);
    if (view === 'analysis' && groups[0]) groups[0].unshift(...sectionPeriodNodes());
    const screens = groups.map((group, index) => {
      const section = document.createElement('section');
      section.className = 'v-screen-section v-screen-section--' + view + '-' + (index + 1);
      section.tabIndex = -1;
      section.setAttribute('aria-label', views[view] + ' 화면 ' + (index + 1) + '/' + groups.length);
      const inner = document.createElement('div');
      inner.className = 'v-screen-inner';
      group.forEach(node => inner.append(node));
      section.append(inner);
      return section;
    });
    root.replaceChildren(...screens);
    root.scrollTop = 0;
    if (window.IM_SMOOTH_SCROLL) window.IM_SMOOTH_SCROLL.mount(root);
  }
  function financeThermometerCard() {
    const summary = profileFinanceSummary();
    const metric = summary.metric || {};
    const hasMetric = summary.status === 'partial' && Number.isFinite(metric.value);
    const measuredCount = Math.max(0, Number(summary.measuredCount) || 0);
    const totalCount = Math.max(1, Number(summary.totalCount) || 4);
    const currentTemperature = hasMetric ? financeTemperatureFromExpenseRatio(metric.value) : null;
    const previousTemperature = hasMetric ? financeTemperatureFromExpenseRatio(metric.previousValue) : null;
    const thermometerLevel = currentTemperature === null ? 0 : currentTemperature;
    const temperatureText = value => value === null ? '측정 전' : value.toFixed(1) + '°';
    const currentTemperatureText = temperatureText(currentTemperature);
    const previousTemperatureText = temperatureText(previousTemperature);
    const temperatureDelta = currentTemperature !== null && previousTemperature !== null ? currentTemperature - previousTemperature : null;
    const deltaText = temperatureDelta === null
      ? '비교 기간 자료 없음'
      : temperatureDelta === 0
        ? '변동 없음'
        : Math.abs(temperatureDelta).toFixed(1) + '° ' + (temperatureDelta > 0 ? '높음' : '낮음');
    const deltaClass = temperatureDelta === null || temperatureDelta === 0 ? 'is-neutral' : temperatureDelta > 0 ? 'is-improved' : 'is-caution';
    const sourceItems = [
      { label: '매출', connected: summary.measured.includes('매출') },
      { label: '지출', connected: summary.measured.includes('지출') },
      { label: '현금잔액', connected: summary.measured.includes('현금잔액') },
      { label: '예정 입출금', connected: summary.measured.includes('정산 예정 입출금') }
    ];
    const sources = sourceItems.map(item =>
      '<div class="v-finance-source" data-connected="' + item.connected + '"><span><i aria-hidden="true">' + (item.connected ? '✓' : '+') + '</i>' + item.label + '</span><small>' + (item.connected ? '연결됨' : '연결 필요') + '</small></div>'
    ).join('');
    const comparison = previousTemperature !== null
      ? '<div class="v-finance-thermo-compare" aria-label="직전 기간 ' + previousTemperatureText.replace('°', '도') + '에서 현재 ' + currentTemperatureText.replace('°', '도') + '로 변화"><span><small>직전 기간</small><strong>' + previousTemperatureText + '</strong></span><i aria-hidden="true">→</i><span class="current"><small>현재</small><strong>' + currentTemperatureText + '</strong></span></div>'
      : '<p class="v-finance-thermo-empty">연결 데이터를 확인한 뒤 참고 온도를 표시합니다.</p>';
    const actionTarget = hasMetric ? 'analysis' : 'profile';
    const actionLabel = hasMetric ? '근거와 연결 항목 보기' : '내 가게 정보 확인하기';
    return '<article class="v-finance-thermo-card" data-status="' + summary.status + '" aria-labelledby="financeThermoTitle"><div class="v-finance-thermo-head"><div><p>가게 금융신호 한눈에 보기</p><h2 id="financeThermoTitle">나의 금융 체온계</h2></div><span>연결 데이터 ' + measuredCount + '/' + totalCount + '</span></div>' +
      '<div class="v-finance-thermo-main"><div class="v-finance-thermo-gauge" style="--v-thermo-level:' + thermometerLevel.toFixed(1) + '%" aria-hidden="true"><div class="v-finance-thermometer"><div class="v-finance-thermometer-tube"><span></span></div><div class="v-finance-thermometer-bulb"><span></span></div><div class="v-finance-thermometer-marks"><i></i><i></i><i></i><i></i></div></div><div class="v-finance-thermo-gauge-label"><strong>' + measuredCount + '/' + totalCount + '</strong><small>데이터 연결도</small></div><p class="v-finance-thermo-basis">최근 1개월 일별 이동평균 지수</p></div>' +
      '<div class="v-finance-thermo-summary"><span title="자료 기준 ' + esc(financeIndex.asOf || '없음') + ' · 지수 갱신 ' + esc(financeIndex.today) + '">현재 나의 금융지수</span><h3>나의 금융 온도<br><strong>' + currentTemperatureText + '</strong></h3>' + comparison + '<span class="v-finance-thermo-change ' + deltaClass + '">' + (temperatureDelta > 0 ? '▲ ' : temperatureDelta < 0 ? '▼ ' : '') + deltaText + '</span></div></div>' +
      '<div class="v-finance-thermo-sources" aria-label="금융 체온계 데이터 연결 상태">' + sources + '</div><button class="v-finance-thermo-action" type="button" data-view="' + actionTarget + '"><span>' + actionLabel + '</span><i aria-hidden="true">→</i></button>' +
      '<p class="v-finance-thermo-notice">(참고용 지표) 신용평가·대출심사 결과와는 무관합니다.</p></article>';
  }
  function dashboardLead() {
    return '<section class="v-dashboard-lead" aria-label="오늘의 브리핑과 나의 금융 체온계">' +
      '<div class="v-feature-banner" id="dashboardBanner" data-banner-theme="news" aria-roledescription="carousel" aria-label="오늘의 브리핑 자동 배너">' +
      '<div class="v-feature-banner-copy"><div class="v-feature-banner-top"><span class="v-feature-banner-kicker" id="bannerKicker"></span></div>' +
      '<h1 id="bannerTitle" tabindex="-1"></h1><p id="bannerText"></p><button class="v-feature-banner-action" id="bannerAction" data-action="banner-detail" type="button"></button></div>' +
      '<div class="v-feature-banner-image" aria-hidden="true"><span></span><img id="bannerImage" src="./assets/dashboard-banners/briefing-market.png" width="640" height="640" alt=""></div>' +
      '<div class="v-feature-banner-footer"><div class="v-feature-banner-pages"><span id="bannerCount"></span><button class="v-feature-banner-dot active" id="bannerDot0" data-banner-index="0" type="button" aria-label="첫 번째 배너" aria-pressed="true"></button><button class="v-feature-banner-dot" id="bannerDot1" data-banner-index="1" type="button" aria-label="두 번째 배너" aria-pressed="false"></button><button class="v-feature-banner-dot" id="bannerDot2" data-banner-index="2" type="button" aria-label="세 번째 배너" aria-pressed="false"></button></div>' +
      '<div class="v-feature-banner-controls"><button data-action="banner-prev" aria-label="이전 배너" type="button">‹</button><button data-action="banner-pause" id="bannerPause" type="button" aria-label="배너 자동 전환 일시정지">Ⅱ</button><button data-action="banner-next" aria-label="다음 배너" type="button">›</button></div></div></div>' +
      financeThermometerCard() + '</section>';
  }
  function conversionChange(value) {
    return value == null ? '비교 자료 없음' : (value > 0 ? '▲ ' : value < 0 ? '▼ ' : '') + Math.abs(value).toFixed(1) + '%p';
  }
  function recoveryComparison(row) {
    return '전월 동일 요일·동일 시간대 ' + row.comparisonDates.length + '일 합산 기준 · ' + row.comparisonDates.join(', ') +
      ' · 입장 ' + ratioText(row.previousEntryRate) + ' → ' + ratioText(row.entryRate) +
      ' · 결제(추정) ' + ratioText(row.previousPurchaseRate) + ' → ' + ratioText(row.estimatedPurchaseRate) +
      ' · 생성 집계 · 결제 건수는 구매자 수와 다를 수 있습니다.';
  }
  function recoveryDashboardCard() {
    const r = recoveryData.opportunity;
    const primaryAction = recoveryData.actions[0];
    return '<section class="card v-recovery-signal v-recovery-signal--final" aria-label="최근 CCTV와 POS 회복 신호">' +
      '<div class="v-recovery-signal-copy"><div class="v-recovery-signal-head"><span class="v-tag amber">CCTV·POS 생성 분석</span><span class="v-metadata">분석일 ' + dateText(recoveryData.analysisDate) + '</span></div>' +
      '<span class="v-recovery-signal-kicker">오늘의 전환 신호</span><h2><strong>' + r.label + '</strong> 통행은 많지만<br>입장 전환은 낮습니다</h2>' +
      '<p>통행자 <strong>' + number(r.passersby) + '명</strong> 중 입장객은 <strong>' + number(r.entrants) + '명</strong>으로 입장 전환율은 <strong>' + ratioText(r.entryRate) + '</strong>입니다.<span class="v-recovery-signal-followup">확정 원인이 아닌 점검 후보를 다음 행동으로 연결합니다</span></p>' +
      '<div class="v-recovery-priority"><span>먼저 확인할 항목</span><strong>' + primaryAction.title + '</strong><p>' + primaryAction.detail + '</p></div>' +
      '<button class="v-button primary" type="button" data-view="recovery">전환 흐름과 회복전략 보기 →</button></div>' +
      '<div class="v-recovery-signal-panel"><div class="v-recovery-signal-panel-head"><span>전환 흐름</span><strong>통행에서 결제까지</strong></div><div class="v-recovery-conversion-highlight"><span>핵심 점검 구간</span><strong>통행 → 입장</strong><b>입장 전환율 ' + ratioText(r.entryRate) + '</b></div><div class="v-signal-flow" aria-label="통행에서 결제까지의 핵심 수치"><div><span>통행</span><strong>' + number(r.passersby) + '명</strong></div><i class="v-signal-connector"><b aria-hidden="true">→</b><small>' + ratioText(r.entryRate) + '</small></i><div class="focus"><span>입장</span><strong>' + number(r.entrants) + '명</strong></div><i class="v-signal-connector"><b aria-hidden="true">→</b><small>' + ratioText(r.estimatedPurchaseRate) + '</small></i><div><span>결제</span><strong>' + number(r.validPayments) + '건</strong></div></div>' +
      '<div class="v-signal-context" aria-label="회복 신호 보조 지표"><div><span>매장 앞 통행인구</span><strong>' + number(r.passersby) + '명</strong></div><div><span>입장 전환율</span><strong>' + ratioText(r.entryRate) + '</strong></div><div><span>결제 전환율(추정)</span><strong>' + ratioText(r.estimatedPurchaseRate) + '</strong></div><div><span>전월 동일 요일 대비</span><strong>' + conversionChange(r.entryRateDelta) + '</strong></div></div><p class="v-recovery-signal-note">' + recoveryComparison(r) + '</p></div>' +
      '</section>';
  }
  function recoveryFunnel() {
    const r = recoveryData.opportunity;
    const steps = [
      { label: '매장 앞 통행인구', value: number(r.passersby) + '명', meta: '기준 100%', icon: '길' },
      { label: '매장 입장', value: number(r.entrants) + '명', meta: '입장 전환율 ' + ratioText(r.entryRate), icon: '문', focus: true },
      { label: '유효 결제', value: number(r.validPayments) + '건', meta: '추정 전환 ' + ratioText(r.estimatedPurchaseRate), icon: '결' },
      { label: '순매출', value: money(r.netSales), meta: '매장 결제 생성값', icon: '원' }
    ];
    return '<div class="v-funnel">' + steps.map(step => '<article class="v-funnel-step' + (step.focus ? ' focus' : '') + '"><span class="v-funnel-icon" aria-hidden="true">' + step.icon + '</span><span class="v-funnel-label">' + step.label + '</span><strong>' + step.value + '</strong><span class="v-funnel-meta">' + step.meta + '</span></article>').join('') + '</div>' +
      '<div class="v-funnel-metrics"><div><span>결제 전환율(추정)</span><strong>' + ratioText(r.estimatedPurchaseRate) + '</strong></div><div><span>입장 전환율 변화</span><strong>' + conversionChange(r.entryRateDelta) + '</strong></div><div><span>결제 전환율 변화</span><strong>' + conversionChange(r.purchaseRateDelta) + '</strong></div></div><p class="v-metadata">' + recoveryComparison(r) + '</p>';
  }
  function recoveryChart() {
    const rows = recoveryData.slots;
    const maxTraffic = Math.max(1, ...rows.map(r => r.passersby));
    const maxRate = Math.max(15, ...rows.map(r => r.entryRate || 0));
    const left = 55, right = 555, top = 28, bottom = 214;
    const x = i => 76 + i * 92;
    const yTraffic = value => bottom - value / maxTraffic * (bottom - top);
    const yRate = value => bottom - value / maxRate * (bottom - top);
    const opportunityIndex = rows.findIndex(r => r.id === recoveryData.opportunity.id);
    let svg = '<svg class="v-recovery-chart" viewBox="0 0 620 275" role="img" aria-label="시간대별 통행자 수 막대와 입장 전환율 선 그래프">';
    svg += '<rect x="' + (x(opportunityIndex) - 35) + '" y="18" width="70" height="210" rx="12" fill="#fff4e3"/>';
    [0, .5, 1].forEach(step => {
      const y = bottom - step * (bottom - top);
      svg += '<line x1="' + left + '" x2="' + right + '" y1="' + y + '" y2="' + y + '" stroke="#e7efec"/>' +
        '<text x="7" y="' + (y + 5) + '">' + number(maxTraffic * step) + '명</text><text x="565" y="' + (y + 5) + '">' + (maxRate * step).toFixed(step ? 1 : 0) + '%</text>';
    });
    rows.forEach((row, i) => {
      const y = yTraffic(row.passersby);
      svg += '<rect x="' + (x(i) - 15) + '" y="' + y.toFixed(1) + '" width="30" height="' + (bottom - y).toFixed(1) + '" rx="7" fill="' + (i === opportunityIndex ? '#e7a04f' : '#67aa99') + '" opacity=".88"/>' +
        '<text x="' + x(i) + '" y="' + (y - 8).toFixed(1) + '" text-anchor="middle">' + number(row.passersby) + '</text><text x="' + x(i) + '" y="249" text-anchor="middle">' + row.label + '</text>';
    });
    svg += '<path d="' + rows.map((row, i) => (i ? 'L' : 'M') + x(i) + ' ' + yRate(row.entryRate).toFixed(1)).join(' ') + '" fill="none" stroke="#226f67" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    rows.forEach((row, i) => { svg += '<circle cx="' + x(i) + '" cy="' + yRate(row.entryRate).toFixed(1) + '" r="5" fill="#fff" stroke="#226f67" stroke-width="3"/>'; });
    svg += '</svg>';
    return '<div class="v-row v-between"><div class="v-legend"><span><i class="v-dot"></i>통행자 수 · 왼쪽 축</span><span><i class="v-line-dot"></i>입장 전환율 · 오른쪽 축</span></div><span class="v-tag amber">' + recoveryData.opportunity.label + ' 시나리오</span></div>' + svg +
      '<p class="v-metadata">CCTV 형식 익명 집계 생성값 · 시간대 선택은 기능 검토용 시나리오이며 자동 추천 산식은 아직 확정되지 않았습니다.</p>';
  }
  function dashboard() {
    return dashboardLead() + '<section class="metric-grid v-dashboard-metrics" aria-label="선택 기간 핵심 지표">' +
      metric('내 가게 매출', compact(analysis.sales) + '<small> 원</small>', analysis.salesRate, state.period.comparison, false) +
      metric('총지출', compact(analysis.expense) + '<small> 원</small>', analysis.expenseRate, state.period.comparison, false, 'expense') +
      marketMetric('상권 소비 변화', analysis.merchantRate, '서비스 이용 가게 ' + analysis.merchantCount + '곳') +
      marketMetric('상권 유동인구 변화', analysis.trafficRate, '상권 유동인구 표본') +
      '</section><div class="v-grid2 v-dashboard-support">' + card(guidanceCard(), 'v-dashboard-guidance v-decision-action') + dashboardContextCard() + '</div><div class="v-decision-layout v-dashboard-decision">' +
      card(head('요일/시간대별 유동인구와 매출량', '<button class="text-button" type="button" data-view="analysis">상세 분석 →</button>') + comparisonChart(), 'v-evidence-panel v-dashboard-flow-card') +
      dashboardInsight() + '</div>' + recoveryDashboardCard();
  }
  function market() {
    const max = Math.max(1, ...analysis.byWeekday.map(r => r.sales || 0));
    return note('상권 유동인구와 매장 방문자 수는 다릅니다. 이 시안은 생성 POS 판매 집계와 생성 상권 지표를 비교합니다.') +
      '<div class="v-grid2 v-analysis-overview">' + card(head('요일/시간대별 유동인구와 매출량', badge('선택 기간')) + comparisonChart()) +
      card(head('요일별 일평균 매출', badge('영업 기록 기준', 'neutral')) + analysis.byWeekday.map(r =>
        '<div class="v-row v-between"><span>' + r.label + '요일 <small class="v-metadata">' + r.count + '일</small></span><strong>' + (r.sales == null ? '자료 없음' : money(r.sales)) + '</strong></div><div class="v-progress"><span style="width:' + ((r.sales || 0) / max * 100) + '%"></span></div>').join('') +
        '<p class="v-metadata">합계가 아닌 관측 일수로 나눈 일평균입니다.</p>') + '</div>' +
      '<div class="v-decision-layout v-analysis-guidance">' + card(head('해석 전 확인할 기준') +
        '<div class="v-list"><div class="v-list-item"><span class="v-number">01</span><div><strong>판매 수량</strong><p>생성 POS에서 취소 수량을 차감한 ' + number(analysis.soldUnits) + '개입니다. 주문 건수나 방문 인원으로 바꾸어 표시하지 않습니다.</p></div></div><div class="v-list-item"><span class="v-number">02</span><div><strong>매장 방문자 수</strong><p>별도 방문 자료는 아직 연결하지 않았습니다.</p></div></div><div class="v-list-item"><span class="v-number">03</span><div><strong>고객층·경기일 비교</strong><p>연령·직장인·행사 근거가 없어 특정 고객층이나 효과를 단정하지 않습니다.</p></div></div></div>', 'v-evidence-panel') +
        card(guidanceCard(), 'v-decision-action') + '</div>';
  }
  function finance() {
    const purchase = analysis.byCategory.find(r => r.id === 'purchase');
    const largestExpense = analysis.byCategory.slice().sort((a, b) => b.amount - a.amount)[0];
    return '<section class="metric-grid">' + metric('선택 기간 매출', compact(analysis.sales) + '<small> 원</small>', analysis.salesRate, state.period.comparison, true) +
      metric('선택 기간 지출', compact(analysis.expense) + '<small> 원</small>', analysis.expenseRate, state.period.comparison, false, 'expense') +
      '<article class="card metric-card"><div class="metric-label">매출·지출 차이</div><div class="metric-value">' + compact(analysis.delta) + '<small> 원</small></div><p class="v-metadata v-space">영업이익·현금잔액과 구분</p></article>' +
      '<article class="card metric-card"><div class="metric-label">현금보유량</div><div class="metric-value">미연결</div><p class="v-metadata v-space">사업용 계좌 잔액·보유 현금 연결 필요</p></article><article class="card metric-card"><div class="metric-label">매입비</div><div class="metric-value">' + compact(purchase.amount) + '<small> 원</small></div><p class="v-metadata v-space">품목별 매입금액 합계</p></article></section>' +
      '<div class="v-finance-summary" aria-label="선택 기간 재무 요약"><div><span>매출 대비 지출</span><strong>' + ratioText(analysis.expenseRatio) + '</strong><small>선택 기간 지출 ÷ 매출 × 100</small></div><div><span>가장 큰 지출 항목</span><strong>' + largestExpense.name + '</strong><small>' + money(largestExpense.amount) + '</small></div><div><span>해석 기준</span><strong>매출·지출 차이</strong><small>영업이익·현금잔액과 구분</small></div></div>' +
      '<div class="v-decision-layout v-finance-decision">' + card(head('일별 매출·지출') + salesChart(), 'v-evidence-panel') +
      card(head('지출 구조 진단', badge('선택 기간', 'neutral')) + '<p class="v-subtitle">지출 비중이 큰 항목부터 운영 점검 순서를 정합니다.</p>' + analysis.byCategory.map(r =>
        '<div class="v-row v-between"><span>' + r.name + '</span><strong>' + money(r.amount) + '</strong></div><div class="v-progress"><span style="width:' + r.amount / Math.max(analysis.expense, 1) * 100 + '%"></span></div>').join(''), 'v-decision-action') + '</div>' +
      '<div class="v-space">' + note(costText()) + '</div><div class="v-decision-layout v-purchase-decision">' +
      card(head('매입금액 TOP 3', badge('선택 기간')) + '<div class="v-table-wrap"><table class="v-table"><thead><tr><th>품목</th><th class="right">매입량</th><th class="right">매입금액</th></tr></thead><tbody>' +
        analysis.topPurchases.slice(0, 3).map(r => '<tr><td>' + r.name + '</td><td class="right">' + r.quantity.toFixed(1) + ' ' + r.unit + '</td><td class="right">' + money(r.amount) + '</td></tr>').join('') +
        '</tbody></table></div><p class="v-metadata v-space">생성 매입 자료 · 매입량은 실제 사용량과 다를 수 있습니다.</p>') +
      card(head('발주 전에 확인할 것') + '<div class="v-list"><div class="v-list-item"><span class="v-number">01</span><div><strong>판매 메뉴와 재료를 연결하세요</strong><p>메뉴별 레시피·단위 대응 자료가 필요합니다.</p></div></div><div class="v-list-item"><span class="v-number">02</span><div><strong>남은 재고·폐기를 확인하세요</strong><p>자료가 없어 과다 매입 수량이나 다음 달 발주량은 계산하지 않습니다.</p></div></div></div><div class="v-check-strip"><span>현재 확인 가능</span><strong>매입금액 순위</strong><span>추가 연결 필요</span><strong>재고·폐기·레시피</strong></div>', 'v-decision-action') + '</div>' +
      '<div class="v-grid2">' + card(head('자금 흐름', badge('연결 전', 'neutral')) + '<p class="v-subtitle">보유 현금으로 오해하지 않도록 연결되지 않은 항목을 구분합니다.</p><div class="v-connection-grid"><div><span>현금보유량</span><strong>미연결</strong></div><div><span>정산 예정일</span><strong>미연결</strong></div><div><span>예상 입출금</span><strong>미연결</strong></div><div><span>미정산 매출</span><strong>미연결</strong></div><div><span>예정 지출</span><strong>미연결</strong></div></div>' + note('현재는 매출·지출 차이만 확인할 수 있으며 실제 자금 흐름 판단에는 위 자료가 필요합니다.', 'neutral')) +
      card(head('POS 집계 확인', badge('DB 대신 로컬 생성 자료', 'neutral')) + '<div class="v-table-wrap"><table class="v-table"><thead><tr><th>최근 일자</th><th>시간</th><th>품목</th><th class="right">순매출</th></tr></thead><tbody>' +
        analysis.pos.filter(r => r.netAmount > 0).slice(-5).map(r => '<tr><td>' + r.date.slice(5) + '</td><td>' + r.hour + '시</td><td>' + D.menu.find(m => m.id === r.itemId).name + '</td><td class="right">' + money(r.netAmount) + '</td></tr>').join('') +
      '</tbody></table></div><p class="v-metadata v-space">취소 ' + number(analysis.cancellations) + '개 차감 · 실 DB/POS 기기 미연결</p>') + '</div>';
  }
  function combinedAnalysis() {
    if (window.IM_SALES_DIAGNOSIS) return window.IM_SALES_DIAGNOSIS.render(state.period);
    return market() + finance();
  }
  function mapPreview() {
    const r = Math.min(125, Math.max(45, state.radius / 8));
    return '<div class="v-map"><span class="v-map-label v-tag neutral">배치 예시 · 실제 지도 아님</span><svg viewBox="0 0 450 300" role="img" aria-label="내 가게를 중심으로 반경을 표시하는 지도 배치 예시">' +
      '<path d="M0 150h450M225 0v300" stroke="#dce8df" stroke-dasharray="4 6"/><circle cx="225" cy="150" r="' + r + '" fill="#6db48b14" stroke="#73ac8d" stroke-dasharray="6 5"/><circle cx="225" cy="150" r="14" fill="#3b927a"/><text x="225" y="155" text-anchor="middle" fill="white" font-size="13">내</text><text x="225" y="186" text-anchor="middle" fill="#396c56" font-size="14">내 가게 핀 자리</text></svg><span class="v-map-foot">주소·좌표·상권 API 확인 후 카카오맵으로 연결</span></div>';
  }
  function recovery() {
    const r = recoveryData.opportunity;
    const actionState = state.recoveryStarted ? '실행 기록 시안이 시작되었습니다.' : '추천으로 끝내지 않고 같은 조건의 7일 후 결과까지 확인합니다.';
    return '<section class="v-recovery-hero" aria-labelledby="recoveryOpportunityTitle"><div class="v-recovery-hero-main">' +
      '<div class="v-row"><span class="v-tag">CCTV·POS 결합 분석</span><span class="v-recovery-date">최근 완료 분석 · ' + dateText(recoveryData.analysisDate) + '</span></div>' +
      '<p class="v-recovery-kicker">가장 먼저 점검할 시간대</p><h2 id="recoveryOpportunityTitle">매출 기회 후보<br><strong>' + r.label + '</strong></h2>' +
      '<p>매장 앞 통행자는 <b>' + number(r.passersby) + '명</b>으로 많았지만 입장객은 <b>' + number(r.entrants) + '명</b>으로, 입장 전환율이 <b>' + ratioText(r.entryRate) + '</b>였습니다.</p></div>' +
      '<div class="v-recovery-hero-stats" aria-label="회복전략 핵심 지표"><div><span>통행량</span><strong>' + number(r.passersby) + '명</strong><small>매장 앞 익명 집계</small></div><div><span>입장객</span><strong>' + number(r.entrants) + '명</strong><small>통행 대비 입장</small></div><div class="warn"><span>입장 전환율</span><strong>' + ratioText(r.entryRate) + '</strong><small>입장객 ÷ 통행자</small></div><div><span>판단 상태</span><strong>요인 후보</strong><small>확정 원인 아님</small></div></div></section>' +
      '<div class="v-recovery-source"><span class="v-tag amber">생성 데이터 기반 시연</span><span>CCTV 형식 익명 집계와 매장 내 POS 결제 형식의 생성값입니다. 실제 영상·장비·POS·외부 AI는 연결되지 않았습니다.</span></div>' +
      '<div class="v-recovery-layout"><div class="v-stack">' +
      card(head(r.label + ' 매출 전환 흐름', '<button class="text-button" type="button" data-action="show-recovery-definitions">지표 기준 보기 →</button>') + '<p class="v-subtitle">매장 앞 통행에서 결제까지 이탈이 큰 구간을 확인합니다.</p>' + recoveryFunnel()) +
      card(head('시간대별 통행·입장 비교', badge('통행량 + 유입률', 'neutral')) + '<p class="v-subtitle">서로 다른 단위를 같은 축으로 오해하지 않도록 통행량과 유입률을 각각 표시합니다.</p>' + recoveryChart()) + '</div>' +
      '<aside class="v-stack">' +
      '<article class="card v-card v-diagnosis"><span class="v-tag">규칙 기반 진단 시안 · 요인 후보</span><h2>' + recoveryData.diagnosis.title + '</h2><p>' + recoveryData.diagnosis.explanation + '</p><div class="v-evidence"><div><span>' + r.label + ' 통행량</span><strong>' + number(r.passersby) + '명</strong></div><div><span>같은 시간 입장객</span><strong>' + number(r.entrants) + '명</strong></div><div><span>입장 전환율</span><strong>' + ratioText(r.entryRate) + '</strong></div></div><p class="v-metadata">판단 임계값과 규칙 버전은 미정이며, 이 화면은 승인된 생성 시나리오를 표시합니다.</p></article>' +
      '<article class="card v-card v-action-plan"><div class="v-row v-between"><div><h2>회복전략 제안</h2><p class="v-subtitle">분석을 오늘 실행할 행동으로 바꿉니다.</p></div>' + badge('규칙 기반 시안', 'neutral') + '</div><div class="v-plan-list">' + recoveryData.actions.map((item, i) => '<div class="v-plan-item"><span>0' + (i + 1) + '</span><div><small>' + item.time + '</small><strong>' + item.title + '</strong><p>' + item.detail + '</p></div></div>').join('') + '</div><button class="v-button primary v-plan-start" type="button" data-action="start-recovery"' + (state.recoveryStarted ? ' disabled' : '') + '>' + (state.recoveryStarted ? '실행 기록 시안 진행 중' : '실행 기록 시안 시작하기') + '</button><p class="v-metadata">현재 브라우저 안에서만 상태가 바뀌며 DB에 저장되지 않습니다.</p></article>' +
      '</aside></div>' +
      '<section class="card v-card v-recovery-compare"><div class="v-row v-between"><div><h2>실행 전·후 비교</h2><p class="v-subtitle">같은 매장·요일·시간대의 유입률, 결제 건수, 순매출을 함께 비교합니다.</p></div>' + badge('7일 비교', 'amber') + '</div><div class="v-compare-flow"><article class="current"><span>분석일 · 실행 전</span><strong>유입률 ' + ratioText(r.entryRate) + '</strong><p>유효 결제 ' + number(r.validPayments) + '건 · 순매출 ' + money(r.netSales) + '</p></article><i aria-hidden="true">→</i><article class="' + (state.recoveryStarted ? 'active' : '') + '"><span>이번 주 · 실행</span><strong>' + recoveryData.comparison.actionLabel + '</strong><p>' + actionState + '</p></article><i aria-hidden="true">→</i><article class="future"><span>' + dateText(recoveryData.comparison.followUpDate) + ' · 결과</span><strong>데이터 집계 대기</strong><p>자료가 준비되기 전에는 성공·효과 수치를 표시하지 않습니다.</p></article></div><div class="v-compare-metrics" aria-label="전후 비교 대상"><div><span>유입률</span><strong>' + ratioText(r.entryRate) + ' → 집계 대기</strong></div><div><span>유효 결제</span><strong>' + number(r.validPayments) + '건 → 집계 대기</strong></div><div><span>순매출</span><strong>' + money(r.netSales) + ' → 집계 대기</strong></div></div></section>' +
      '<div class="v-grid2"><section class="card v-card">' + head('지도·상권 보조 근거', badge('카카오맵 미연결', 'neutral')) + '<p class="v-subtitle">핵심 진단은 CCTV·POS이며, 지도·동종업종·행사는 원인 후보를 해석하는 보조 자료입니다.</p><label class="v-row v-subtitle v-space">반경 배치 예시 <input class="v-select" type="number" id="mapRadius" min="100" max="1000" step="100" value="' + state.radius + '" style="width:100px" aria-label="지도 배치 예시 반경">m</label><div id="mapPreview" class="v-space">' + mapPreview() + '</div></section>' +
      card(head('보조 자료 연결 상태') + '<div class="v-list"><div class="v-list-item"><span class="v-number">01</span><div><strong>동종업종·메뉴·영업시간</strong><p>공급원과 비교 기준이 미정이므로 경쟁력 사실을 생성하지 않습니다.</p></div></div><div class="v-list-item"><span class="v-number">02</span><div><strong>상권 고객층</strong><p>연령대·직장인 비중을 확보한 뒤 회복 행동의 대상을 보완합니다.</p></div></div><div class="v-list-item"><span class="v-number">03</span><div><strong>행사·대목</strong><p>일정·위치·변경 여부가 확인된 경우에만 알림과 준비 안내에 사용합니다.</p></div></div></div>') + '</div>';
  }
  function matchPolicy(p) {
    const profile = state.profile;
    return [
      { name: '지역', status: !profile.region ? '확인 필요' : profile.region.includes(p.region) ? '일치' : '불일치' },
      { name: '업종', status: p.industry === '전체 업종' || profile.industry === p.industry ? '일치' : '불일치' },
      { name: '직원 수', status: p.maxEmployees == null ? '예시 조건 없음' : profile.employees === '' ? '확인 필요' : Number(profile.employees) <= p.maxEmployees ? '일치' : '불일치' },
      { name: '나이', status: p.ageMin == null ? '예시 조건 없음' : profile.age === '' ? '확인 필요' : Number(profile.age) >= p.ageMin && Number(profile.age) <= p.ageMax ? '일치' : '불일치' }
    ];
  }
  function filteredPolicies() {
    return D.policies.filter(p => (state.category === 'all' || p.category === state.category) && p.title.includes(state.keyword) &&
      (state.policyView === 'all' || !matchPolicy(p).some(r => r.status === '불일치'))).slice(0, state.policyView === 'all' ? D.policies.length : 10);
  }
  function policyResults() {
    const rows = filteredPolicies();
    state.offset = Math.max(0, Math.min(state.offset, Math.max(0, rows.length - 3)));
    if (!rows.length) return '<div class="v-empty">조건에 맞는 예시가 없습니다.<br>검색어나 옵션을 바꾸어 주세요.</div>';
    return '<div class="v-row v-between" style="margin-bottom:16px"><span class="v-subtitle">예시 ' + rows.length + '개 · ' + (state.offset + 1) + '~' + Math.min(rows.length, state.offset + 3) + '번째 표시</span><div class="v-row">' +
      button('‹ 이전', 'data-action="policy-prev"' + (state.offset === 0 ? ' disabled' : '')) +
      button('다음 ›', 'data-action="policy-next"' + (state.offset >= rows.length - 3 ? ' disabled' : '')) + '</div></div><div class="v-policy-grid">' +
      rows.slice(state.offset, state.offset + 3).map(p => '<article class="card v-policy"><div class="v-row">' + badge(p.category) + badge('실제 공고 아님', 'neutral') +
        '</div><h3>' + p.title + '</h3><p class="v-subtitle">' + p.region + ' · ' + p.industry + '</p><div class="v-list">' +
        matchPolicy(p).map(r => '<div class="v-row v-between"><span class="v-metadata">' + r.name + '</span><span class="v-tag ' + (r.status === '일치' ? '' : 'neutral') + '">' + r.status + '</span></div>').join('') +
        '</div><p class="v-metadata">적합도 % 미산정 · 산식 미정</p>' + button('예시 조건 보기', 'data-policy="' + p.id + '"') + '</article>').join('') + '</div>';
  }
  function policies() {
    const candidates = filteredPolicies();
    const reviewCount = candidates.filter(policy => matchPolicy(policy).some(result => result.status === '확인 필요')).length;
    const categoryCount = new Set(candidates.map(policy => policy.category)).size;
    return '<div class="v-decision-layout v-policy-decision"><div class="card v-card v-evidence-panel"><div class="v-tabs" role="tablist" aria-label="정책 목록 종류"><button type="button" role="tab" data-policy-view="recommended" aria-selected="' + (state.policyView === 'recommended') + '" class="' + (state.policyView === 'recommended' ? 'active' : '') + '">오늘의 추천공고</button><button type="button" role="tab" data-policy-view="all" aria-selected="' + (state.policyView === 'all') + '" class="' + (state.policyView === 'all' ? 'active' : '') + '">전체 리스트</button></div>' +
      '<div class="v-row v-space"><input class="v-search" id="policySearch" type="search" placeholder="공고 제목 검색" aria-label="공고 제목 검색" value="' + esc(state.keyword) + '"><select class="v-select" id="policyCategory" aria-label="지원 분야"><option value="all">전체 분야</option><option value="금융"' + (state.category === '금융' ? ' selected' : '') + '>금융</option><option value="창업"' + (state.category === '창업' ? ' selected' : '') + '>창업</option></select></div>' +
      '<p class="v-metadata v-space">수집 계획: 금융·창업 분야 + 제목에 소상공인/골목/전통시장 포함. 현재는 실제 수집 없이 예시 순서로 표시합니다. 추천은 불일치 예시를 제외한 목록이며, 미확인 조건이 남아 있을 수 있습니다.</p>' +
      '<div class="v-policy-criteria" aria-label="현재 추천 판단 기준"><div><span>사업장 소재지</span><strong>' + esc(state.profile.region || '미입력') + '</strong></div><div><span>업종</span><strong>' + esc(state.profile.industry || '미입력') + '</strong></div><div><span>직원 수</span><strong>' + (state.profile.employees === '' ? '미입력' : number(Number(state.profile.employees)) + '명') + '</strong></div><div><span>나이</span><strong>' + (state.profile.age === '' ? '미입력 · 확인 필요' : number(Number(state.profile.age)) + '세') + '</strong></div></div>' +
      '<div class="v-policy-overview" aria-label="현재 조건 매칭 현황"><div class="v-row v-between"><h3>현재 조건 매칭 현황</h3>' + badge('생성 예시', 'neutral') + '</div><div><span>추천 후보<strong>' + number(candidates.length) + '개</strong></span><span>추가 확인 필요<strong>' + number(reviewCount) + '개</strong></span><span>포함 분야<strong>' + number(categoryCount) + '개</strong></span></div></div></div>' +
      '<aside class="card v-card v-decision-action"><div class="v-row v-between"><div><h2>지원사업 확인 순서</h2><p class="v-subtitle">추천 목록에서 신청 판단까지 필요한 확인 항목입니다.</p></div>' + badge('신청 전 확인', 'neutral') + '</div><div class="v-plan-list"><div class="v-plan-item"><span>01</span><div><small>내 조건</small><strong>지역·업종 일치 여부</strong><p>사업장 소재지와 업종을 먼저 비교합니다.</p></div></div><div class="v-plan-item"><span>02</span><div><small>추가 확인</small><strong>직원 수·나이 조건</strong><p>미입력 항목은 적합으로 단정하지 않습니다.</p></div></div><div class="v-plan-item"><span>03</span><div><small>신청 전</small><strong>원문 공고 최종 확인</strong><p>접수기간·지원금·제외 조건은 실제 공고에서 확인합니다.</p></div></div></div><button class="v-button primary v-plan-start" type="button" data-view="profile">내 조건 확인하기 →</button><p class="v-metadata">현재 목록은 조건 매칭을 확인하기 위한 가상 공고이며 실제 신청 가능한 사업이 아닙니다.</p></aside></div>' +
      '<div id="policyResults" class="v-space">' + policyResults() + '</div>';
  }
  const reportPrompts = ['매출과 지출을 함께 분석해 주세요.', '시간대별 운영 전략을 정리해 주세요.', '회복전략을 요약해 주세요.'];
  function secretary() {
    return '<div class="v-decision-layout v-secretary-layout"><article class="card v-card v-evidence-panel"><div class="v-row v-between"><h2>' + esc(state.profile.name) + '님의 ' + productName('비서') + '</h2>' + badge('규칙 기반 시안', 'neutral') +
      '</div><p class="v-subtitle">질문에 맞춰 생성 데이터를 분석하고 PDF 요약본으로 정리합니다.</p><div class="v-row v-space">' +
      reportPrompts.map(q => button(esc(q), 'data-report-question="' + esc(q) + '"')).join('') + '</div><div class="v-report-chat" id="reportMessages" aria-live="polite">' +
      (state.reportMessages.length ? state.reportMessages.map(m => '<div class="ai-message ' + m.type + '">' + esc(m.text) + '</div>').join('') :
        '<div class="ai-message bot">어떤 부분을 살펴볼까요?\n매출·지출, 시간대, 회복전략에 관해 질문해 주세요.\n외부 AI 대신 현재 생성 데이터를 읽는 규칙 기반 분석입니다.</div>') +
      '</div><form class="v-compose" id="reportForm"><textarea id="reportInput" maxlength="500" required placeholder="예: 지출을 줄이려면 무엇부터 확인해야 하나요?" aria-label="iM비서 분석 질문"></textarea><button class="v-button primary" type="submit">분석하기</button></form>' +
      '<div id="reportResult"' + (state.reportReady ? '' : ' hidden') + ' class="v-report-result"><h3>분석 내용이 준비되었습니다.</h3><p class="v-subtitle">근거·실행 제안·제한 사항을 한 장으로 정리합니다.</p>' +
      button(state.pdfBusy ? '요약본 생성 중…' : '최종 요약 PDF 만들기', 'data-action="make-pdf" id="makePdfButton"' + (state.pdfBusy ? ' disabled' : ''), true) +
      '<div id="pdfDownload"' + (state.reportBlobUrl ? '' : ' hidden') + '><p class="v-subtitle">최종 요약본 분석이 완료되었습니다.</p><a class="v-download" id="pdfLink"' +
      (state.reportBlobUrl ? ' href="' + state.reportBlobUrl + '"' : '') + ' download="iM파트너_분석요약.pdf">iM파트너_분석요약.pdf 다운로드</a></div></div></article>' +
      '<aside class="card v-card v-decision-action"><div class="v-row v-between"><div><h2>분석에서 문서까지</h2><p class="v-subtitle">질문을 근거와 실행 항목이 담긴 요약본으로 바꿉니다.</p></div>' + badge('3단계', 'neutral') + '</div><div class="v-plan-list"><div class="v-plan-item"><span>01</span><div><small>질문</small><strong>분석 주제 선택</strong><p>' + productName('챗봇') + '은 짧은 답변, ' + productName('비서') + '는 종합 분석에 사용합니다.</p></div></div><div class="v-plan-item"><span>02</span><div><small>근거</small><strong>가게·상권 데이터 확인</strong><p>수치의 기준과 제한 사항을 함께 정리합니다.</p></div></div><div class="v-plan-item"><span>03</span><div><small>보관</small><strong>최종 요약 PDF 생성</strong><p>검토가 끝난 분석을 한 장 문서로 내려받습니다.</p></div></div></div><div class="v-decision-facts"><div><span>분석 대상</span><strong>' + esc(state.profile.region) + ' · ' + esc(state.profile.industry) + '</strong></div><div><span>분석 기간</span><strong>' + state.period.start + ' ~ ' + state.period.end + '</strong></div></div><p class="v-metadata">생성 데이터 기반 규칙 분석 · 실제 AI·DB는 아직 연결되지 않았습니다.</p></aside></div>';
  }
  function field(label, name, type, extra) {
    return '<label class="v-field">' + label + '<input name="' + name + '" type="' + (type || 'text') + '" value="' + esc(state.profile[name]) + '" ' + (extra || '') + '></label>';
  }
  function profile() {
    return note('프로필 입력값은 화면 표기·가상 공고 조건 확인에만 적용되고 새로고침하면 초기화됩니다. 생성 POS·상권 자료는 예시 음식점의 고정 자료입니다. 실제 개인정보를 입력할 필요가 없으며, 계정 생성·DB 저장은 하지 않습니다.') +
      '<form id="profileForm"><div class="v-grid2">' + card(head('사용자 정보', badge('화면 입력 시안', 'neutral')) + '<div class="v-form-grid">' +
      field('이름', 'name', 'text', 'required maxlength="40"') + field('나이', 'age', 'number', 'min="0" max="120" placeholder="미입력"') +
      field('전화번호', 'phone', 'tel', 'maxlength="30" placeholder="입력하지 않아도 됩니다"') + field('이메일', 'email', 'email', 'maxlength="100" placeholder="입력하지 않아도 됩니다"') +
      '<label class="v-field">아이디<input value="sohyun_demo" disabled></label><label class="v-field">비밀번호<input type="password" placeholder="인증 구현 후 설정" disabled><small>현재 입력·저장하지 않습니다.</small></label></div>') +
      card(head('사업장 정보') + '<div class="v-form-grid">' + field('가게 이름', 'storeName', 'text', 'required maxlength="60"') +
      field('사업장 소재지', 'region', 'text', 'required maxlength="80"') + field('업종', 'industry', 'text', 'required maxlength="40"') +
      field('사업장 규모 · 직원 수(명)', 'employees', 'number', 'min="0" max="10000" step="1"') + field('가게 주소', 'address', 'text', 'maxlength="160" placeholder="상세 주소 미입력"') +
      field('사업자번호', 'businessNumber', 'text', 'maxlength="20" placeholder="입력하지 않아도 됩니다"') + field('창업일자', 'opened', 'date') +
      '</div><p class="v-metadata v-space">사업장 소재지는 거주지와 다릅니다. 입력 직원 수와 공고의 상시근로자 산정 기준은 별도 확인합니다.</p>') +
      '</div><div class="v-row v-space">' + '<button class="v-button primary" type="submit">이 화면에 반영하기</button><span class="v-metadata">서버 저장·가입 없이 미리보기만 변경</span></div></form>';
  }
  function profileFinanceSummary() {
    const profileMatchesDemo = ['storeName', 'region', 'industry'].every(key =>
      String(state.profile[key] || '').trim() === String(D.profile[key] || '').trim()
    );
    const ratio = profileMatchesDemo && Number.isFinite(financeIndex.value) ? 100 - financeIndex.value : null;
    const previousRatio = profileMatchesDemo && Number.isFinite(financeIndex.previousValue) ? 100 - financeIndex.previousValue : null;
    const delta = ratio !== null && Number.isFinite(previousRatio) ? ratio - previousRatio : null;
    const deltaLabel = '직전기간보다';
    const hasMeasuredData = ratio !== null;
    const referenceTemperature = financeTemperatureFromExpenseRatio(ratio);
    const previousReferenceTemperature = financeTemperatureFromExpenseRatio(previousRatio);
    const referenceTemperatureDelta = referenceTemperature !== null && previousReferenceTemperature !== null
      ? referenceTemperature - previousReferenceTemperature
      : null;
    return {
      status: hasMeasuredData ? 'partial' : 'unavailable',
      measuredCount: hasMeasuredData ? 2 : 0,
      totalCount: 4,
      measured: hasMeasuredData ? ['매출', '지출'] : [],
      missing: hasMeasuredData ? ['현금잔액', '정산 예정 입출금'] : ['현재 프로필과 연결된 거래 데이터'],
      period: '최근 1개월(30일) 이동평균 · 자료 기준 ' + (financeIndex.asOf || '없음'),
      sourceLabel: D.profile.storeName + ' 고정 생성자료',
      destination: 'finance-thermometer',
      storeProfileId: null,
      analysisRunId: null,
      metric: {
        label: '일별 지출률의 30일 평균',
        value: ratio,
        previousValue: previousRatio,
        unit: '%',
        delta,
        deltaUnit: '%p',
        deltaLabel,
        direction: delta === null ? 'unknown' : delta > 0 ? 'worse' : delta < 0 ? 'better' : 'neutral'
      },
      referenceTemperature: referenceTemperature === null ? null : {
        value: referenceTemperature,
        previousValue: previousReferenceTemperature,
        unit: '°',
        delta: referenceTemperatureDelta,
        deltaUnit: '°',
        deltaLabel,
        direction: referenceTemperatureDelta === null
          ? 'unknown'
          : referenceTemperatureDelta > 0 ? 'better' : referenceTemperatureDelta < 0 ? 'worse' : 'neutral',
        basisLabel: '최근 1개월 일별 이동평균 지수',
        ruleVersion: 'daily-index-30d-average-v2',
        scoringDefinition: '일별 max(0, min(100, 100 - 지출/매출 × 100))의 30일 산술평균',
        dataStatus: 'reference'
      },
      temperature: null
    };
  }
  function syncProfileFinance() {
    const summary = profileFinanceSummary();
    const temperature = summary.temperature || summary.referenceTemperature;
    const temperatureText = temperature ? temperature.value.toFixed(1) + '°' : '측정 전';
    const spokenTemperature = temperature ? temperature.value.toFixed(1) + '도' : '측정 전';
    const menuBadge = $('#profileMenuTemperatureBadge');
    const triggerBadge = $('#profileTemperatureBadge');
    [menuBadge, triggerBadge].forEach(badge => {
      if (!badge) return;
      badge.textContent = temperatureText;
      badge.dataset.status = summary.status;
    });
    if (menuBadge) menuBadge.setAttribute('aria-label', '나의 금융 온도 ' + spokenTemperature);
    $('#profileMenuButton').setAttribute(
      'aria-label',
      state.profile.name + ' 프로필 메뉴, 나의 금융 온도 ' + spokenTemperature
    );
    if (!window.IMProfileFinance) return;
    const mount = $('#profileMenuFinanceMount');
    if (!mount) return;
    window.IMProfileFinance.mount(mount, summary, { buttonRole: 'menuitem' });
  }
  function render() {
    state.chartSeries = [];
    const dashboardView = state.view === 'dashboard';
    $('#mainContent').classList.toggle('dashboard-view', dashboardView);
    $('#pageHeading').hidden = true;
    $('#dataNotice').hidden = true;
    $('#pageTitle').textContent = captions[state.view];
    $('#viewEyebrow').textContent = views[state.view];
    $('#pageContext').textContent = state.profile.name + '님 · ' + state.profile.region + ' · ' + state.profile.industry;
    $('#periodContext').textContent = state.period.start + ' ~ ' + state.period.end + ' · ' + state.period.comparison;
    $('#profileName').textContent = state.profile.name;
    $('#profileInitials').textContent = avatarName(state.profile.name);
    $('#profileStoreName').textContent = state.profile.storeName;
    $('#profileMenuName').textContent = state.profile.name;
    $('#profileMenuInitials').textContent = avatarName(state.profile.name);
    $('#profileMenuStore').textContent = state.profile.storeName;
    $('#profileMenuButton').classList.toggle('active', state.view === 'profile');
    syncProfileFinance();
    $('#storeContext').textContent = state.profile.storeName + ' · ' + state.profile.industry;
    $('#aiContext').textContent = state.profile.storeName + ' 생성 자료 · ' + state.period.start + '~' + state.period.end;
    document.querySelectorAll('[data-view]').forEach(el => { el.classList.toggle('active', el.dataset.view === state.view); if (el.classList.contains('nav-item')) { if (el.dataset.view === state.view) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); } });
    const renders = { dashboard, analysis: combinedAnalysis, recovery, policies, secretary, profile };
    $('#viewRoot').innerHTML = renders[state.view]() + sourceFoot;
    sectionizeView(state.view);
    $('#periodSelect').value = state.periodMode;
    $('#customPeriod').hidden = true;
    if ($('#sectionPeriodSelect')) $('#sectionPeriodSelect').value = state.periodMode;
    if ($('#sectionCustomPeriod')) $('#sectionCustomPeriod').hidden = state.periodMode !== 'custom';
    updateBanner();
  }
  function navigate(view) {
    view = normalizeView(view);
    if (!views[view]) return;
    state.view = view; setProfileMenu(false); render();
    $('#sidebar').classList.remove('open'); $('#navBackdrop').classList.remove('visible');
    $('#menuButton').setAttribute('aria-expanded', 'false');
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    const root = $('#viewRoot');
    if (typeof root.scrollTo === 'function') root.scrollTo({ top: 0, behavior: 'auto' });
    else root.scrollTop = 0;
    const focusTarget = (state.view === 'dashboard' ? $('#bannerTitle') : $('#viewRoot .v-screen-section')) || root;
    focusTarget.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
  function notice(text) {
    const el = $('#demoNotice'); el.textContent = text; el.classList.add('visible');
    clearTimeout(notice.timer); notice.timer = setTimeout(() => el.classList.remove('visible'), 4500);
  }
  function setChat(open) {
    state.chatOpen = open; $('.app-shell').classList.toggle('chat-open', open);
    $('#aiToggle').setAttribute('aria-expanded', String(open));
    $('#aiPanel').inert = !open; $('#aiPanel').setAttribute('aria-hidden', String(!open));
    if (open) $('#aiInput').focus({ preventScroll: true }); else $('#aiToggle').focus({ preventScroll: true });
  }
  function answer(question) {
    const r = recoveryData.opportunity;
    if (/(프로필|내 이름|내 정보|가입|비밀번호)/.test(question)) return { known: true, text: '현재 화면 프로필은 ' + state.profile.name + '님, ' + state.profile.region + ' 소재 ' + state.profile.industry + '입니다.\n프로필 수정은 표시·가상 공고 조건 확인에만 적용됩니다. 생성 POS는 예시 음식점 자료이며 실제 계정 생성·비밀번호 저장은 제공하지 않습니다.' };
    if (/(날씨|뉴스|행사|축제|캘린더|달력)/.test(question)) return { known: true, text: '현재 날씨·뉴스·행사 일정은 연결 전입니다. 홈과 회복전략에서 예정 영역을 확인할 수 있습니다.\n실제 일정이나 추천 상품을 임의로 안내하지 않습니다.' };
    if (/(정책|지원|공고)/.test(question)) return { known: true, text: '근거: 현재는 실제 공고 대신 화면 구성용 예시만 있습니다.\n확인: 지역·업종·직원 수·나이 조건을 구분합니다. 적합도 % 산식은 미정입니다.\n행동: 지원사업 메뉴에서 예시 조건을 확인하세요. 실제 신청 자격은 확정할 수 없습니다.' };
    if (/(고객|직장|연령|나이)/.test(question)) return { known: true, text: '근거: 연령대·직장인 비중 자료는 연결되지 않았습니다.\n해석: 특정 고객층을 추천할 근거가 부족합니다.\n행동: 방문·소비 고객층 자료를 확보한 뒤 메뉴와 홍보 대상을 정하세요.' };
    if (/(CCTV|통행|체류|입장|유입|구매전환|객단가|전환율)/i.test(question)) return { known: true, text: '근거: ' + recoveryData.analysisDate + ' ' + r.label + ' 생성 집계에서 통행자 ' + number(r.passersby) + '명, 입장객 ' + number(r.entrants) + '명, 유효 결제 ' + number(r.validPayments) + '건입니다.\n해석: 입장 전환율은 ' + ratioText(r.entryRate) + ', 추정 구매전환율은 ' + ratioText(r.estimatedPurchaseRate) + '로 통행→입장 구간을 먼저 살펴볼 요인 후보입니다.\n행동: 17시 30분부터 대표 메뉴와 가격을 노출하고 7일 후 같은 조건을 비교하세요. 실제 CCTV·POS가 아닌 생성 시나리오입니다.' };
    if (/(현금|자금|잔액|대출|금융|체온)/.test(question)) return { known: true, text: '근거: 매출 ' + money(analysis.sales) + ', 지출 ' + money(analysis.expense) + '입니다.\n해석: 이 차이는 현재 현금이나 영업이익이 아닙니다. 금융지수는 일별 매출·지출 참고 지수의 최근 30일 평균이며 종합 신용점수가 아닙니다. 현금보유량·미정산 매출·예정 지출은 미연결입니다.\n행동: 보유 현금, 정산일, 예정 출금을 확인하세요. 대출 심사·신청은 제공하지 않습니다.' };
    if (/(지출|매입|비용|재고|발주|남는|돈)/.test(question)) return { known: true, text: '근거: ' + costText() + '\n행동: 매입금액 상위 품목의 재고·폐기를 먼저 확인하세요. 재고와 메뉴 대응이 없어 발주 수량은 계산하지 않습니다.' };
    if (/(시간|언제|요일|준비)/.test(question)) return { known: true, text: '근거: 최근 완료된 CCTV·POS 생성 시나리오에서 ' + r.label + ' 통행자는 ' + number(r.passersby) + '명, 입장 전환율은 ' + ratioText(r.entryRate) + '입니다.\n해석: 이 시간대는 자동 산식이 아닌 기능 검토용 매출 기회 후보입니다.\n행동: 17시 30분부터 대표 메뉴 노출과 혜택 안내를 준비하고 같은 요일·시간대를 7일 뒤 비교하세요.' };
    if (/(행동|실행|플랜|회복|방법)/.test(question)) return { known: true, text: '근거: ' + r.label + ' 통행자 ' + number(r.passersby) + '명 중 입장객은 ' + number(r.entrants) + '명으로 유입률은 ' + ratioText(r.entryRate) + '입니다.\n해석: 통행→입장 구간의 외부 주목도를 먼저 점검할 요인 후보입니다.\n행동: 17시 30분 대표 메뉴 입간판과 18~20시 2인 세트 안내를 실행한 뒤 7일 후 유입률·결제·순매출을 비교하세요. 할인율과 효과 수치는 정해진 값이 없습니다.' };
    if (/(매출|왜|떨어|변화|소비|유동|상권)/.test(question)) return { known: true, text: '근거: ' + causeText() + '\n해석: 실제 관측이 아닌 생성 자료이며, 매출 변화의 확정 원인은 아닙니다.\n행동: ' + analysis.action };
    return { known: false, text: '현재 데이터로는 답변하기 어렵습니다. 매출·지출, 시간대, 회복전략, 지원사업 조건에 관해 간단히 질문해 주세요.\n상담원과 연결 채널은 아직 미정이어서 지금 연결해 드릴 수 없습니다.' };
  }
  function appendChat(text, type) {
    const el = document.createElement('div'); el.className = 'ai-message ' + type; el.textContent = text;
    $('#aiMessages').append(el); $('#aiMessages').scrollTop = $('#aiMessages').scrollHeight;
    while ($('#aiMessages').childElementCount > 40) $('#aiMessages').firstElementChild.remove();
  }
  function ask(question) {
    const q = question.trim(); if (!q) return;
    setChat(true); appendChat(q, 'user'); appendChat(answer(q).text, 'bot'); $('#aiInput').value = '';
  }
  function askReport(question) {
    const q = question.trim(); if (!q) return;
    clearPdf();
    const reply = answer(q);
    state.reportMessages.push({ type: 'user', text: q }, { type: 'bot', text: reply.text });
    if (state.reportMessages.length > 16) state.reportMessages = state.reportMessages.slice(-16);
    if (reply.known) state.reportReady = true;
    state.view = 'secretary'; render();
    $('#reportMessages').scrollTop = $('#reportMessages').scrollHeight;
  }
  const banners = [
    {
      kicker: '오늘의 브리핑 · 소상공인 뉴스·이슈',
      title: '소상공인 뉴스·이슈\n영업 준비와 연결해드려요',
      text: '확인된 출처와 게시일을 바탕으로 가게 운영에\n필요한 변화만 간결하게 안내해드려요.',
      action: '브리핑 자세히 보기 →', theme: 'news', image: './assets/dashboard-banners/briefing-market.png'
    },
    {
      kicker: '가게 주변 행사와 날씨',
      title: '가게 주변 행사와 날씨\n미리 준비할 수 있도록',
      text: '행사 일정과 날씨 자료가 연결되면 가게 운영에\n필요한 준비만 간결하게 안내해드려요.',
      action: '연결 예정 정보 보기 →', theme: 'weather', image: './assets/dashboard-banners/briefing-weather.png'
    },
    {
      kicker: '업종별 대목 준비',
      title: '장사가 잘되는 시기\n일주일 먼저 준비하세요',
      text: '확인된 행사·절기 자료를 바탕으로 가게 운영에\n필요한 준비 시점만 간결하게 안내해드려요.',
      action: '준비 항목 살펴보기 →', theme: 'season', image: './assets/dashboard-banners/briefing-season.png'
    }
  ];
  function updateBanner() {
    if (!$('#bannerTitle')) return;
    const banner = banners[state.bannerIndex];
    $('#dashboardBanner').dataset.bannerTheme = banner.theme;
    $('#bannerKicker').textContent = banner.kicker;
    $('#bannerTitle').textContent = banner.title;
    $('#bannerText').textContent = banner.text;
    $('#bannerAction').textContent = banner.action;
    $('#bannerImage').src = banner.image;
    $('#bannerCount').textContent = (state.bannerIndex + 1) + ' / ' + banners.length;
    $('#bannerPause').textContent = state.bannerPaused ? '▶' : 'Ⅱ';
    $('#bannerPause').setAttribute('aria-label', state.bannerPaused ? '배너 자동 전환 재개' : '배너 자동 전환 일시정지');
    banners.forEach((_, index) => {
      const dot = $('#bannerDot' + index);
      if (!dot) return;
      const active = index === state.bannerIndex;
      dot.classList.toggle('active', active);
      dot.setAttribute('aria-pressed', String(active));
    });
    const bannerRoot = $('#dashboardBanner');
    bannerRoot.classList.remove('is-changing');
    void bannerRoot.offsetWidth;
    bannerRoot.classList.add('is-changing');
  }
  function clearPdf() {
    state.reportRevision++;
    if (state.reportBlobUrl) URL.revokeObjectURL(state.reportBlobUrl);
    state.reportBlobUrl = null; state.pdfBusy = false;
  }
  function invalidateReport() {
    clearPdf();
    state.reportReady = false; state.reportMessages = [];
    $('#aiMessages').replaceChildren();
    appendChat('분석 조건이 바뀌었습니다. 새 조건을 기준으로 질문해 주세요.', 'bot');
  }
  function profileMenuItems() {
    const menu = $('#profileMenu');
    if (!menu || typeof menu.querySelectorAll !== 'function') return [];
    return Array.from(menu.querySelectorAll('[role="menuitem"]')).filter(item => !item.hidden && !item.hasAttribute('disabled'));
  }
  function focusProfileMenuItem(index) {
    const items = profileMenuItems();
    if (!items.length) return;
    const target = items[(index + items.length) % items.length];
    target.focus({ preventScroll: true });
    if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  }
  function setProfileMenu(open, focusIndex) {
    const menu = $('#profileMenu');
    const trigger = $('#profileMenuButton');
    if (!menu || !trigger) return;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open && Number.isInteger(focusIndex)) {
      const schedule = typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : callback => setTimeout(callback, 0);
      schedule(() => focusProfileMenuItem(focusIndex));
    }
  }
  async function makePdf() {
    if (state.pdfBusy || !state.reportReady) return;
    state.pdfBusy = true;
    const revision = ++state.reportRevision;
    const btn = $('#makePdfButton');
    btn.disabled = true; btn.textContent = '요약본 생성 중…';
    try {
      const blob = await window.IM_REPORT_PDF.generate({
        profile: Object.assign({}, state.profile), analysis, cause: causeText(), cost: costText(),
        discussion: state.reportMessages.filter(r => r.type === 'user').map(r => r.text).slice(-3)
      });
      if (revision !== state.reportRevision) return;
      if (state.reportBlobUrl) URL.revokeObjectURL(state.reportBlobUrl);
      state.reportBlobUrl = URL.createObjectURL(blob);
      if ($('#pdfLink')) { $('#pdfLink').href = state.reportBlobUrl; $('#pdfDownload').hidden = false; }
      notice('PDF가 생성되었습니다. 파란 파일명을 누르면 다운로드합니다.');
    } catch (error) {
      notice('PDF를 만들지 못했습니다. 다시 시도해 주세요.');
      console.error('PDF generation failed', error);
    } finally {
      if (revision === state.reportRevision) {
        state.pdfBusy = false;
        const current = $('#makePdfButton');
        if (current) { current.disabled = false; current.textContent = state.reportBlobUrl ? '최종 요약 PDF 다시 만들기' : '최종 요약 PDF 만들기'; }
      }
    }
  }
  document.addEventListener('im-profile-finance:open', event => {
    const detail = event.detail || {};
    if (detail.target !== 'finance-thermometer' || detail.source !== 'profile-menu') return;
    navigate('dashboard');
    const schedule = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : callback => setTimeout(callback, 0);
    schedule(() => {
      const title = $('#financeThermoTitle');
      if (!title) return;
      const card = title.closest('.v-finance-thermo-card');
      if (card && typeof card.scrollIntoView === 'function') card.scrollIntoView({ block: 'center', behavior: 'auto' });
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    });
  });
  document.addEventListener('focusin', event => {
    const account = event.target.closest ? event.target.closest('.sidebar-account') : null;
    if (!account && !$('#profileMenu').hidden) setProfileMenu(false);
  });
  document.addEventListener('click', event => {
    const series = event.target.closest('[data-series]');
    if (series && series.dataset.series) { highlightChartSeries(series.dataset.series); return; }
    const mode = event.target.closest('[data-chart-mode]');
    if (mode && mode.dataset.chartMode) {
      state.chartMode = mode.dataset.chartMode;
      document.querySelectorAll('.v-comparison-chart').forEach(chart => { chart.outerHTML = comparisonChart(); });
      syncChartSelection();
      return;
    }
    const contextMode = event.target.closest('[data-context-mode]');
    if (contextMode && ['traffic', 'consumption'].includes(contextMode.dataset.contextMode)) {
      state.contextMode = contextMode.dataset.contextMode;
      const card = document.querySelector('.v-dashboard-context');
      if (card) card.outerHTML = dashboardContextCard();
      document.querySelector('[data-context-mode="' + state.contextMode + '"]')?.focus({ preventScroll: true });
      return;
    }
    const accountArea = event.target.closest('.sidebar-account');
    const guidePickerArea = event.target.closest('.v-guide-hour-picker');
    const el = event.target.closest('button, a');
    if (!el) { if (!accountArea) setProfileMenu(false); if (!guidePickerArea) setGuideHourMenu(false); return; }
    if (el.id === 'profileMenuButton') {
      event.preventDefault?.();
      const opening = $('#profileMenu').hidden;
      setProfileMenu(opening, opening ? 0 : null);
      return;
    }
    if (!accountArea) setProfileMenu(false);
    if (!guidePickerArea) setGuideHourMenu(false);
    if (el.dataset.guideHour !== undefined) {
      event.preventDefault?.();
      selectGuideHour(el.dataset.guideHour);
      return;
    }
    if (el.dataset.view) { event.preventDefault?.(); navigate(el.dataset.view); }
    if (el.dataset.question) ask(el.dataset.question);
    if (el.dataset.reportQuestion) askReport(el.dataset.reportQuestion);
    if (el.dataset.bannerIndex !== undefined) { state.bannerIndex = Math.max(0, Math.min(banners.length - 1, Number(el.dataset.bannerIndex))); updateBanner(); }
    if (el.dataset.policyView) { state.policyView = el.dataset.policyView; state.offset = 0; render(); }
    if (el.dataset.policy) {
      const p = D.policies.find(row => row.id === Number(el.dataset.policy));
      $('#policyModalTitle').textContent = p.title;
      $('#policyModalContent').innerHTML = '<p class="v-subtitle">이것은 실제 지원사업이 아닌 조건 확인용 예시입니다.</p><div class="v-list">' +
        matchPolicy(p).map(r => '<p>' + r.name + ': <strong>' + r.status + '</strong></p>').join('') +
        '</div><p class="v-subtitle">창업일·규모의 세부 산정 기준은 원문 확인이 필요합니다. 적합도 %·접수기간·지원금액·신청 링크는 제공하지 않습니다.</p>';
      $('#policyModal').showModal();
    }
    switch (el.dataset.action) {
      case 'toggle-guide-hour': setGuideHourMenu($('#guideHourMenu').hidden); break;
      case 'banner-prev': state.bannerIndex = (state.bannerIndex + banners.length - 1) % banners.length; updateBanner(); break;
      case 'banner-next': state.bannerIndex = (state.bannerIndex + 1) % banners.length; updateBanner(); break;
      case 'banner-pause': state.bannerPaused = !state.bannerPaused; updateBanner(); break;
      case 'banner-detail': notice('현재는 배너 구성과 전환 동작을 확인하는 단계입니다. 실제 뉴스·날씨·행사 상세 정보는 아직 연결되지 않았습니다.'); break;
      case 'policy-prev': state.offset--; $('#policyResults').innerHTML = policyResults(); break;
      case 'policy-next': state.offset++; $('#policyResults').innerHTML = policyResults(); break;
      case 'make-pdf': makePdf(); break;
      case 'close-modal': $('#policyModal').close(); break;
      case 'show-recovery-definitions': $('#recoveryMetricModal').showModal(); break;
      case 'close-recovery-definitions': $('#recoveryMetricModal').close(); break;
      case 'start-recovery':
        state.recoveryStarted = true;
        render();
        notice('실행 기록 시안을 시작했습니다. 현재 브라우저에서만 유지되며 DB에는 저장되지 않습니다.');
        break;
    }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'policySearch') { state.keyword = event.target.value.trim(); state.offset = 0; $('#policyResults').innerHTML = policyResults(); }
  });
  document.addEventListener('change', event => {
    const el = event.target;
    if (el.id === 'policyCategory') { state.category = el.value; state.offset = 0; $('#policyResults').innerHTML = policyResults(); }
    if (el.id === 'mapRadius') { state.radius = Math.max(100, Math.min(1000, Number(el.value) || 500)); el.value = state.radius; $('#mapPreview').innerHTML = mapPreview(); }
    if (el.id === 'periodSelect' || el.id === 'sectionPeriodSelect') {
      state.periodMode = el.value;
      $('#periodSelect').value = state.periodMode;
      $('#customPeriod').hidden = true;
      if ($('#sectionPeriodSelect')) $('#sectionPeriodSelect').value = state.periodMode;
      if ($('#sectionCustomPeriod')) $('#sectionCustomPeriod').hidden = state.periodMode !== 'custom';
      if (el.value !== 'custom') { state.period = Object.assign({}, D.periods[el.value]); analysis = D.analyze(state.period); invalidateReport(); render(); }
    }
  });
  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.id === 'aiForm') { event.preventDefault(); ask($('#aiInput').value); }
    if (form.id === 'reportForm') { event.preventDefault(); askReport($('#reportInput').value); }
    if (form.id === 'customPeriod' || form.id === 'sectionCustomPeriod') {
      event.preventDefault();
      const sectionForm = form.id === 'sectionCustomPeriod';
      const startSelector = sectionForm ? '#sectionPeriodStart' : '#periodStart';
      const endSelector = sectionForm ? '#sectionPeriodEnd' : '#periodEnd';
      const p = D.customPeriod($(startSelector).value, $(endSelector).value);
      if (!p) { notice('생성 자료가 있는 2026.07.01~09.02 안에서 시작일과 종료일을 확인해 주세요.'); return; }
      state.periodMode = 'custom';
      state.period = p; analysis = D.analyze(p); invalidateReport(); render();
      if (!analysis.comparisonAvailable) notice('현재 기간은 분석할 수 있지만 직전 비교 기간의 자료가 부족합니다.');
    }
    if (form.id === 'profileForm') {
      event.preventDefault();
      const data = new FormData(form);
      if (['name', 'storeName', 'region', 'industry'].some(key => !String(data.get(key) || '').trim())) {
        notice('이름·가게 이름·소재지·업종을 공백 없이 입력해 주세요.'); return;
      }
      Object.keys(state.profile).forEach(key => { if (data.has(key)) state.profile[key] = String(data.get(key)).trim(); });
      invalidateReport(); render(); notice('현재 탭의 프로필에 반영했습니다. 새로고침하면 예시 정보로 돌아갑니다.');
    }
  });
  $('#sidebarToggle').addEventListener('click', () => {
    if (window.innerWidth <= 760) { $('#sidebar').classList.remove('open'); $('#navBackdrop').classList.remove('visible'); $('#menuButton').setAttribute('aria-expanded', 'false'); return; }
    const collapsed = $('.app-shell').classList.toggle('sidebar-collapsed');
    $('#sidebarToggle').setAttribute('aria-label', collapsed ? '파트너 메뉴 펼치기' : '파트너 메뉴 접기');
    $('#sidebarToggle').setAttribute('aria-expanded', String(!collapsed));
  });
  $('#menuButton').addEventListener('click', () => {
    $('.app-shell').classList.remove('sidebar-collapsed');
    const open = $('#sidebar').classList.toggle('open'); $('#navBackdrop').classList.toggle('visible', open);
    $('#menuButton').setAttribute('aria-expanded', String(open));
  });
  $('#navBackdrop').addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#navBackdrop').classList.remove('visible'); $('#menuButton').setAttribute('aria-expanded', 'false'); });
  $('#logoutLink').addEventListener('click', event => {
    event.preventDefault();
    window.location.replace(event.currentTarget.href);
  });
  $('#aiToggle').addEventListener('click', () => setChat(!state.chatOpen));
  $('#aiClose').addEventListener('click', () => setChat(false));
  document.addEventListener('keydown', event => {
    const guideMenu = $('#guideHourMenu');
    const guideTrigger = $('#guideHourButton');
    if (event.key === 'Escape' && guideMenu && !guideMenu.hidden) {
      event.preventDefault();
      setGuideHourMenu(false);
      if (guideTrigger) guideTrigger.focus({ preventScroll: true });
      return;
    }
    if (guideTrigger && event.target === guideTrigger && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setGuideHourMenu(true);
      return;
    }
    if (guideMenu && !guideMenu.hidden && typeof guideMenu.contains === 'function' && guideMenu.contains(event.target) && typeof guideMenu.querySelectorAll === 'function') {
      const options = Array.from(guideMenu.querySelectorAll('[data-guide-hour]'));
      const currentIndex = options.indexOf(event.target);
      let nextIndex = currentIndex;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % options.length;
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + options.length) % options.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = options.length - 1;
      if (nextIndex !== currentIndex && options[nextIndex]) {
        event.preventDefault();
        options[nextIndex].focus({ preventScroll: true });
        return;
      }
    }
    const menu = $('#profileMenu');
    const trigger = $('#profileMenuButton');
    const menuOpen = Boolean(menu && !menu.hidden);
    if (event.key === 'Escape') {
      if (menuOpen) {
        event.preventDefault();
        setProfileMenu(false);
        trigger.focus();
        return;
      }
      if (state.chatOpen) setChat(false);
      const mobileSidebarWasOpen = window.innerWidth <= 760 && $('#sidebar').classList.contains('open');
      $('#sidebar').classList.remove('open');
      $('#navBackdrop').classList.remove('visible');
      $('#menuButton').setAttribute('aria-expanded', 'false');
      if (mobileSidebarWasOpen) $('#menuButton').focus();
      return;
    }
    if (!menu || !trigger) return;
    if (event.target === trigger && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setProfileMenu(true, event.key === 'ArrowDown' ? 0 : -1);
      return;
    }
    if (!menuOpen || typeof menu.contains !== 'function' || !menu.contains(event.target)) return;
    const items = profileMenuItems();
    const currentIndex = items.indexOf(event.target);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusProfileMenuItem(currentIndex + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusProfileMenuItem(event.key === 'Home' ? 0 : -1);
    }
  });
  function setChatWidth(value) {
    const width = Math.round(Math.max(320, Math.min(560, value)));
    document.documentElement.style.setProperty('--chat-width', width + 'px');
    $('#chatResizeHandle').setAttribute('aria-valuenow', String(width));
  }
  $('#chatResizeHandle').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const width = Number(event.currentTarget.getAttribute('aria-valuenow'));
    setChatWidth(event.key === 'Home' ? 320 : event.key === 'End' ? 560 : width + (event.key === 'ArrowLeft' ? 10 : -10));
  });
  document.addEventListener('keydown', event => {
    const line = event.target.closest('[data-chart-line]');
    if (line && ['Enter', ' '].includes(event.key)) { event.preventDefault(); highlightChartSeries(line.dataset.series); }
  });
  $('#chatResizeHandle').addEventListener('pointerdown', event => {
    const handle = event.currentTarget; handle.setPointerCapture(event.pointerId);
    const startX = event.clientX, startWidth = $('#aiPanel').getBoundingClientRect().width;
    const move = e => { const width = Math.round(Math.max(320, Math.min(560, startWidth + startX - e.clientX))); setChatWidth(width); };
    const stop = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', stop); handle.removeEventListener('pointercancel', stop); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', stop); handle.addEventListener('pointercancel', stop);
  });
  setInterval(() => { if (!state.bannerPaused && !document.hidden && state.view === 'dashboard' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) { state.bannerIndex = (state.bannerIndex + 1) % banners.length; updateBanner(); } }, 8000);
  function refreshCurrentIndicators() {
    if (document.hidden) return;
    const clock = D.seoulClock();
    const key = clock.date + ':' + clock.hour + ':' + clock.minute;
    if (key === clockKey) return;
    const hourChanged = clockKey.split(':').slice(0, 2).join(':') !== [clock.date, clock.hour].join(':');
    clockKey = key;
    if (financeIndex.today !== clock.date) {
      financeIndex = D.financialIndex();
      const contextCard = document.querySelector('.v-dashboard-context');
      if (contextCard) contextCard.outerHTML = dashboardContextCard();
      const card = document.querySelector('.v-finance-thermo-card');
      if (card) card.outerHTML = financeThermometerCard();
      syncProfileFinance();
    }
    const guide = document.querySelector('.v-dashboard-guidance');
    if (guide && hourChanged && state.guideHour === null) guide.innerHTML = guidanceCard();
    const insight = document.querySelector('.v-dashboard-insight');
    if (insight) insight.outerHTML = dashboardInsight();
  }
  setInterval(refreshCurrentIndicators, 15000);
  document.addEventListener('visibilitychange', refreshCurrentIndicators);
  window.addEventListener('hashchange', () => { const view = normalizeView(location.hash.slice(1)); if (views[view]) navigate(view); });
  const initialView = normalizeView(location.hash.slice(1));
  state.view = views[initialView] ? initialView : 'dashboard';
  if (location.hash && location.hash !== '#' + state.view) history.replaceState(null, '', '#' + state.view);
  if (window.IM_SALES_DIAGNOSIS) window.IM_SALES_DIAGNOSIS.bind(render);
  render();
})();
