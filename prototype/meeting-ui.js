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
  const productName = korean => '<span class="im-product-name"><span>' + (korean === '챗봇' ? 'AI' : 'iM') + '</span><span class="im-product-korean">' + korean + '</span></span>';
  const avatarName = value => {
    const characters = Array.from(String(value || '').trim().replace(/\s+/g, ''));
    if (characters.length <= 1) return characters[0] || '?';
    if (characters.length === 2) return characters[1];
    return characters.slice(-2).join('');
  };
  const views = { dashboard: '홈', analysis: '매출진단', market: '상권분석', policies: '지원사업', aftercare: '사후관리', secretary: 'iM비서', profile: '내 프로필' };
  const navigationViews = ['dashboard', 'analysis', 'market', 'policies', 'secretary', 'aftercare'];
  const legacyViews = { recovery: 'market', finance: 'analysis' };
  const normalizeView = view => legacyViews[view] || view;
  const captions = {
    dashboard: '가게의 오늘을 살펴보세요.',
    analysis: '상권의 기회와 가게의 매출을 함께 보세요.',
    market: 'CCTV 관측에서 상권의 흐름을 읽으세요.',
    policies: '내 가게에 맞는 지원을 찾아보세요.',
    secretary: '질문으로 분석하고, 문서로 남기세요.',
    aftercare: '실행을 기록하고 변화를 살펴보세요.',
    profile: '내 가게의 기준 정보를 확인하세요.'
  };
  const state = {
    view: 'dashboard', periodMode: 'month', period: Object.assign({}, D.periods.month), profile: Object.assign({}, D.profile),
    policyView: 'recommended', keyword: '', category: 'all', offset: 0,
    reportMessages: [], secretaryActions: [], reportBlobUrl: null, reportReady: false, reportRevision: 0, pdfBusy: false,
    guideHour: null, contextMode: 'traffic', chartMode: 'hour', chartSeries: [], bannerIndex: 0, bannerPaused: false, weatherPage: 5, chatOpen: false, radius: 500
  };
  let analysis = D.analyze(state.period);
  const recoveryData = D.analyzeRecovery();
  let financeIndex = D.financialIndex();
  let clockKey = "";
  const sourceFoot = '<p class="v-footer">생성 데이터 기반 시연 · 실제 POS·카드사·통신사 원자료가 아닙니다. 이 화면에는 DB·외부 API·실제 AI가 연결되어 있지 않습니다.</p>';
  function icon(name) {
    const paths = {
      dashboard: '<path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9"/>',
      analysis: '<path d="M4 4v16h16M8 15v-4M12 15V7M16 15V5"/>',
      market: '<path d="m4 17 6-6 4 4 6-10M14 5h6v6"/>',
      policies: '<path d="M14 3H6v18h12V7l-4-4v4h4M8 14l3 3 4-5"/>',
      secretary: '<path d="m11 5 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6ZM19 2v4M17 4h4"/>',
      aftercare: '<path d="M9 3h6v4H9zM7 5H5v16h14V5h-2M8 13l3 3 5-6"/>',
      check: '<path d="m5 12 4 4 10-10"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + '</svg>';
  }
  $('#mainNavigation').innerHTML = navigationViews.map(id =>
    '<button type="button" class="nav-item" data-view="' + id + '" title="' + views[id] + '" aria-label="' + views[id] + '"><span class="nav-icon">' + icon(id) + '</span><span class="nav-label">' + (id === 'secretary' ? productName('비서') : views[id]) + '</span></button>'
  ).join('');
  function metricTrend(delta) {
    if (delta === undefined) return '';
    if (delta == null) return '<span class="trend-neutral">비교 자료 없음</span>';
    if (!delta) return '<span class="trend-neutral">변동 없음</span>';
    return '<span class="'+(delta > 0 ? 'trend-up' : 'trend-down')+'">'+(delta > 0 ? '▲ ' : '▼ ')+Math.abs(delta).toFixed(1)+'%</span>';
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
      { key: 'storefront', label: '우리 가게 앞 유동인구', color: '#9560b4', dash: '3 5', unit: '건' }
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
    rows.forEach((row,i) => { svg += '<rect class="v-chart-hit" data-chart-index="'+i+'" x="'+(x(i)-Math.min(60,245/Math.max(1,rows.length-1)))+'" y="36" width="'+Math.min(120,490/Math.max(1,rows.length-1))+'" height="180" fill="transparent" tabindex="0" role="button" aria-label="'+esc(row.label+' 모든 지표 보기')+'"/>'; });
    rows.forEach((row, i) => { svg += '<text x="' + x(i) + '" y="241" text-anchor="middle">' + row.label + '</text>'; });
    return '<div class="v-comparison-chart"><div class="v-chart-mode" aria-label="그래프 집계 단위">' + ['hour', 'weekday'].map(mode => '<button type="button" data-chart-mode="' + mode + '" aria-pressed="' + (state.chartMode === mode) + '">' + (mode === 'hour' ? '시간대별' : '요일별') + '</button>').join('') + '</div><p class="v-chart-selection-note">비교할 지표를 여러 개 선택하세요. 선택을 모두 해제하면 전체를 표시합니다.</p><div class="v-legend v-series-legend">' + series.map(item => '<button type="button" data-series="' + item.key + '" aria-pressed="false"><svg width="24" height="10" aria-hidden="true"><line x1="0" x2="24" y1="5" y2="5" stroke="' + item.color + '" stroke-width="3" stroke-dasharray="' + item.dash + '"/></svg>' + item.label + '</button>').join('') + '</div>' + svg + '</svg><div class="v-chart-tooltip" role="status" hidden></div><p class="v-metadata">' + esc(state.period.start + ' ~ ' + state.period.end) + ' · 생성 자료<br>각 지표의 최댓값 = 100 · ' + (state.chartMode === 'weekday' ? '관측일 수로 나눈 요일별 일평균' : '선택 기간의 시간대별 합계') + ' · 점 위에서 실제 수치 확인<br>카드소비는 별도 상권 표본이며, 서비스 이용 가게 소비 흐름과 표본 범위가 다릅니다.</p></div>';
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
      '<h2>' + title + '</h2><p class="v-dashboard-insight-lead">' + (available ? '현재 시간대의 평소 판매·통행 흐름입니다.' : insight.status === 'off_hours' ? '분석 가능한 시간대는 17~23시입니다.' : '선택 기간에 비교할 매출 자료가 없습니다.') + '</p>' +
      (available ? '<div class="v-dashboard-insight-values"><div><span>시간대 일평균 매출</span><strong>' + compact(insight.salesAverage) + '<small> 원</small></strong></div><div><span>가게 앞 일평균 통행 관측</span><strong>' + (insight.storefrontAverage == null ? '자료 없음' : number(insight.storefrontAverage) + '<small>건</small>') + '</strong></div></div>' : '') +
      '<div class="v-dashboard-insight-point"><span>해석과 다음 행동</span><strong>' + (available ? insight.title : '재료와 정산 일정을 확인하세요.') + '</strong><p>' + (available ? insight.action : '다음 영업시간의 준비 수량과 예정 지출을 점검하세요.') + '</p>' +
      (available ? '<small>하루 매출 중 이 시간대 비중 <b>' + ratioText(insight.share) + '</b></small>' : '') + '</div>' +
      '<p class="v-dashboard-insight-source">' + dateText(state.period.start) + '~' + dateText(state.period.end) + ' 기준 · 실시간 실적 아님</p>' +
      '</article>';
  }
  function costText() {
    const purchase = analysis.byCategory.find(r => r.id === 'purchase');
    return '매출 ' + money(analysis.sales) + '에 지출 ' + money(analysis.expense) + '입니다. 매입비는 ' + money(purchase.amount) + '이며, ' +
      (analysis.comparisonAvailable ? '직전 기간보다 ' + pct(D.rate(purchase.amount, purchase.previous)) + ' 변했습니다. ' : '직전 기간 비교 자료가 부족합니다. ') +
      '매출·지출 차이는 회계상 영업이익이나 현재 현금잔액이 아닙니다.';
  }
  function guideHourPicker(hour) {
    const hours = Array.from({ length: 6 }, (_, index) => index + 17);
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
    const hour = Math.max(17, Math.min(22, Number(value)));
    state.guideHour = hour;
    const triggerValue = $('#guideHourValue');
    if (triggerValue) triggerValue.textContent = String(hour).padStart(2, '0') + ':00';
    document.querySelectorAll('[data-guide-hour]').forEach(option => option.setAttribute('aria-selected', String(Number(option.dataset.guideHour) === hour)));
    if ($('#guidanceContent')) $('#guidanceContent').innerHTML = state.view === 'dashboard' ? homeGuidanceContent() : guidanceContent(hour);
    const contextCard = document.querySelector('.v-dashboard-context');
    if (contextCard) contextCard.outerHTML = dashboardContextCard();
    setGuideHourMenu(false);
    if ($('#guideHourButton')) $('#guideHourButton').focus({ preventScroll: true });
  }
  function selectedGuideHour() {
    return state.guideHour === null ? Math.max(17, Math.min(22, D.seoulClock().hour)) : state.guideHour;
  }
  function guidanceCard(home = false) {
    if (home) return '<div id="guidanceContent" class="v-guidance-content" role="group" aria-label="현재 시간에 맞춘 운영 안내">' + homeGuidanceContent() + '</div>';
    const hour = selectedGuideHour();
    return '<div class="v-guidance-head"><div><span class="v-guidance-kicker">시간대별 운영 안내</span><h2>지금 무엇을 하면 좋을까요</h2></div>' + badge('최근 30일 참고', 'neutral') + '</div>' +
      '<div class="v-guidance-time"><span id="guideHourLabel">확인 시간</span>' + guideHourPicker(hour) + '</div><div id="guidanceContent" class="v-guidance-content">' + guidanceContent(hour) + '</div>' +
      '';
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
  function homeGuidanceContent() {
    const hour = D.seoulClock().hour;
    const g = D.guidance(hour);
    const operating = hour >= 17 && hour < 23;
    if (operating && g.average == null) return '<div class="v-guidance-empty"><h3>' + esc(g.title) + '</h3><p>' + esc(g.text) + '</p></div>';
    let currentAction, nextAction, facts;
    if (operating) {
      currentAction = g.opening
        ? '첫 손님을 맞이할 테이블과 주문 준비를 확인하세요.'
        : g.quiet ? '현재 손님과 주문 대기를 살펴 역할을 나누세요.'
          : '주력 메뉴의 준비 수량과 주문 대기를 확인하세요.';
      const nextDay = g.nextPeak.hour <= hour;
      const nextTime = g.nextPeak.hour + '시부터 ' + (g.nextPeak.hour + 1) + '시까지';
      nextAction = (nextDay ? '다음 영업일 ' : '오늘 ') + nextTime + ' 운영에 맞춰 재료를 준비하세요.';
      facts = '<div class="v-home-guide-facts" aria-label="' + hour + '시 최근 30일 참고 지표"><span>이 시간 평균 매출 <strong>' + money(g.average) + '</strong></span><span title="해당 시간 매출을 하루 매출로 나눈 비율">하루 매출 비중 <strong>' + ratioText(g.share) + '</strong></span></div>';
    } else {
      currentAction = hour < 6
        ? '지난 영업의 정산 내역과 재료 보관 상태를 확인하세요.'
        : hour < 17 ? '영업에 필요한 재료와 매장 상태를 확인하세요.'
          : '오늘 영업을 정산하고 남은 재료의 보관 상태를 확인하세요.';
      nextAction = (hour === 23 ? '내일' : '오늘') + ' 17시 영업에 맞춰 준비할 재료와 수량을 정하세요.';
      facts = '';
    }
    const period = g.period ? dateText(g.period.start) + '부터 ' + dateText(g.period.end) + '까지의 생성 판매 기록' : '최근 30일 생성 판매 기록';
    return '<div class="v-home-action-list"><article><span>지금 확인</span><h3>' + currentAction + '</h3></article><article><span>다음 준비</span><h3>' + nextAction + '</h3></article></div>' +
      '<div class="v-home-guidance-bottom"><div class="v-home-guide-meta">' + facts +
      '<p class="v-home-guidance-note" title="' + esc(period) + '">현재 시간에 맞춰 지금 확인할 사항과 다음에 준비할 일을 안내합니다.</p></div><button class="v-button v-guidance-action" type="button" data-view="analysis" aria-label="매출진단에서 자세히 보기">자세히 보기</button></div>';
  }
  function dashboardContextCard() {
    const context = D.neighborhoodInsights();
    const date = dateText(context.today) + ' ' + context.weekdayLabel;
    const header = '<div class="v-dashboard-context-head"><div><span class="v-context-kicker">' + date + ' · 영업 준비 참고</span><h2>주변 상권 흐름</h2></div>' + badge('30일 패턴', 'neutral') + '</div>';
    if (!context.slots.length) return '<article class="card v-card v-dashboard-context">' + header + '<p class="v-subtitle">최근 30일의 상권 자료가 준비되면 같은 요일의 소비·유동 패턴을 안내합니다.</p></article>';
    const mode = state.contextMode, trafficMode = mode === 'traffic';
    const hour = selectedGuideHour();
    const selected = context.slots.find(row => hour >= row.hour && hour < row.hour + 2);
    const max = Math.max(1, ...context.slots.map(row => row[mode]));
    const unit = trafficMode ? '명' : '원';
    const total = trafficMode ? context.traffic : context.consumption;
    const share = total > 0 ? selected[mode] / total * 100 : null;
    return '<article class="card v-card v-dashboard-context">' + header +
      '<div class="v-context-tabs" aria-label="주변 상권 분석 지표"><button type="button" data-context-mode="traffic" aria-pressed="' + trafficMode + '">유동인구</button><button type="button" data-context-mode="consumption" aria-pressed="' + !trafficMode + '">소비 흐름</button></div>' +
      '<div class="v-context-highlight"><span>운영 안내 ' + String(hour).padStart(2, '0') + ':00 선택과 연동</span><h3>' + selected.label + '</h3><p>최근 30일 중 ' + context.weekdayLabel + '의 해당 시간대 평균입니다.</p></div>' +
      '<p class="v-context-chart-unit">선택 구간 강조 · 단위: ' + (trafficMode ? '명' : '만 원') + ' · 시간(시)</p><div class="v-context-bars" role="img" aria-label="' + context.weekdayLabel + ' 시간대별 일평균 ' + (trafficMode ? '유동인구' : '서비스 소비 흐름') + ', 선택 구간 ' + selected.label + '">' + context.slots.map(row => '<div class="' + (row.hour === selected.hour ? 'is-selected' : '') + '" title="' + row.label + ' · ' + number(row[mode]) + unit + '"><span class="v-context-bar-track"><i style="height:' + Math.max(2, row[mode] / max * 100).toFixed(1) + '%"></i></span><strong>' + (trafficMode ? number(row[mode]) : compact(row[mode]).replace('만', '')) + '</strong><small>' + row.label.replace('시', '') + '</small></div>').join('') + '</div>' +
      '<div class="v-context-summary" aria-label="선택 구간 ' + selected.label + '의 일평균"><div><span>유동인구 · 일평균</span><strong>' + number(selected.traffic) + '명</strong></div><div><span>소비 흐름 · 일평균</span><strong>' + money(selected.consumption) + '</strong></div></div>' +
      '<div class="v-context-action"><span>선택 시간대 운영 참고</span><p>' + (share === null ? '선택 지표의 기록을 확인한 뒤 운영을 준비하세요.' : selected.label + '에 하루 ' + (trafficMode ? '통행' : '소비') + '의 ' + ratioText(share) + '가 관측됐습니다. ' + (trafficMode ? '메뉴·가격 안내를 점검하세요.' : '재료 준비와 주문 응대를 점검하세요.')) + '</p><button class="text-button" type="button" data-view="analysis">매출진단과 함께 보기 →</button></div>' +
      '<p class="v-context-source">' + dateText(context.period.start) + '~' + dateText(context.period.end) + ' 중 같은 요일 ' + context.count + '일 평균 · 생성 자료<br>상권 유동인구 표본 · 서비스 이용 가게 ' + context.merchantCount + '곳의 소비<br>오늘 실적·수요 예측 아님 · 날씨·행사 미연결</p></article>';
  }
  function periodOptions(selected) {
    return [
      ['month', '2026년 8월 · 한 달'],
      ['week', '최근 7일 · 8/28~9/3'],
      ['custom', '직접 기간 선택']
    ].map(option => '<option value="' + option[0] + '"' + (option[0] === selected ? ' selected' : '') + '>' + option[1] + '</option>').join('');
  }
  function sectionPeriodControl() {
    return '<div class="v-section-period-control"><span>분석 기간</span><select class="v-select" id="sectionPeriodSelect" aria-label="분석 기간">' + periodOptions(state.periodMode) + '</select></div>' +
      '<form class="v-section-custom-period" id="sectionCustomPeriod"' + (state.periodMode === 'custom' ? '' : ' hidden') + '><label>시작일<input id="sectionPeriodStart" type="date" value="' + state.period.start + '" min="2026-06-01" max="2026-09-30" required></label><label>종료일<input id="sectionPeriodEnd" type="date" value="' + state.period.end + '" min="2026-06-01" max="2026-09-30" required></label><button class="v-button" type="submit">기간 적용</button></form>';
  }
  function sectionPeriodNodes() {
    const holder = document.createElement('div');
    holder.innerHTML = sectionPeriodControl();
    return Array.from(holder.children);
  }
  function screenGroups(view, children) {
    if (view === 'dashboard' || view === 'secretary' || view === 'aftercare') return [children];
    const footer = children.filter(node => node.classList.contains('v-footer'));
    const content = children.filter(node => !node.classList.contains('v-footer'));
    const groups = content.map(node => [node]);
    if (groups.length) groups[groups.length-1].push(...footer);
    return groups;
  }
  function sectionizeView(view) {
    const root = $('#viewRoot');
    const children = Array.from(root.children);
    if (!children.length || typeof root.querySelectorAll !== 'function') return;
    const groups = screenGroups(view, children).filter(group => group.length);
    if (view === 'analysis' && root.querySelector('#sd-period-mount')) root.querySelector('#sd-period-mount').append(...sectionPeriodNodes());
    else if (view === 'market' && groups[0]) groups[0].unshift(...sectionPeriodNodes());
    const filterDock = root.querySelector('#sd-filter-dock');
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
    if (filterDock) root.prepend(filterDock);
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
        : Math.abs(temperatureDelta).toFixed(1) + '° ' + (temperatureDelta > 0 ? '증가' : '감소');
    const deltaClass = temperatureDelta === null || temperatureDelta === 0 ? 'is-neutral' : temperatureDelta > 0 ? 'is-improved' : 'is-caution';
    const comparison = previousTemperature !== null
      ? '<div class="v-finance-thermo-compare" aria-label="직전 기간 ' + previousTemperatureText.replace('°', '도') + '에서 현재 ' + currentTemperatureText.replace('°', '도') + '로 변화"><span><small>직전 기간</small><strong>' + previousTemperatureText + '</strong></span><i aria-hidden="true">→</i><span class="current"><small>현재</small><strong>' + currentTemperatureText + '</strong></span></div>'
      : '<p class="v-finance-thermo-empty">연결 데이터를 확인한 뒤 참고 온도를 표시합니다.</p>';
    return '<article class="v-finance-thermo-card" data-status="' + summary.status + '" aria-labelledby="financeThermoTitle"><div class="v-finance-thermo-head"><div><p>가게 금융신호 한눈에 보기</p><h2 id="financeThermoTitle">나의 금융 체온계</h2></div><span>연결 데이터 ' + measuredCount + '/' + totalCount + '</span></div>' +
      '<div class="v-finance-thermo-main"><div class="v-finance-thermo-gauge" style="--v-thermo-level:' + thermometerLevel.toFixed(1) + '%" aria-hidden="true"><div class="v-finance-thermometer"><div class="v-finance-thermometer-tube"><span></span></div><div class="v-finance-thermometer-bulb"><span></span></div><div class="v-finance-thermometer-marks"><i></i><i></i><i></i><i></i></div></div><div class="v-finance-thermo-gauge-label"><strong>' + measuredCount + '/' + totalCount + '</strong><small>데이터 연결도</small></div><p class="v-finance-thermo-basis">최근 1개월 일별 이동평균 지수</p></div>' +
      '<div class="v-finance-thermo-summary"><span title="자료 기준 ' + esc(financeIndex.asOf || '없음') + ' · 지수 갱신 ' + esc(financeIndex.today) + '">현재 나의 금융지수</span><h3>나의 금융 온도<br><strong>' + currentTemperatureText + '</strong></h3>' + comparison + '<span class="v-finance-thermo-change ' + deltaClass + '">' + (temperatureDelta > 0 ? '▲ ' : temperatureDelta < 0 ? '▼ ' : '') + deltaText + '</span></div></div>' +
      '<p class="v-finance-thermo-notice">(참고용 지표) 신용평가·대출심사 결과와는 무관합니다.</p></article>';
  }
  function weatherIcon(night) {
    return '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">' + (night
      ? '<path d="M34 32A17 17 0 0 1 17 8a17 17 0 1 0 23 23c-2 .7-4 1-6 1Z" fill="#fff0b4"/><path d="m35 6 1.5 4.5L41 12l-4.5 1.5L35 18l-1.5-4.5L29 12l4.5-1.5Z" fill="#fff"/>'
      : '<circle cx="24" cy="24" r="10" fill="#ffe7a2"/><path d="M24 3v6m0 30v6M3 24h6m30 0h6M9 9l4 4m22 22 4 4M9 39l4-4m22-22 4-4" stroke="#ffe7a2" stroke-width="3" stroke-linecap="round"/>') + '</svg>';
  }
  function weatherCard() {
    return '<article class="v-weather-widget" aria-labelledby="weatherTitle"><div class="v-weather-heading"><h2 id="weatherTitle">대구 중구</h2><span>시연 날씨</span></div>' +
      '<div class="v-weather-current"><div><strong>26<span>°</span></strong><p>맑음</p><small>최고 28°　최저 20°</small></div><div class="v-weather-sun">'+weatherIcon(false)+'</div></div>' +
      '<div class="v-weather-forecast"><div class="v-weather-forecast-head"><span>시간대별 날씨</span><div><button type="button" data-action="weather-prev" aria-label="이전 시간대 날씨">‹</button><button type="button" data-action="weather-next" aria-label="다음 시간대 날씨">›</button></div></div><div id="weatherHours" class="v-weather-hourly" aria-live="polite" aria-label="시연용 시간대별 날씨">'+weatherHours()+'</div></div>' +
      '<p class="v-weather-note">2026.09.03 시연 자료로 실제 날씨가 아닙니다.</p></article>';
  }
  function weatherHours() {
    const temperatures = [22,21,21,20,20,20,21,22,23,24,25,26,27,28,28,28,27,26,25,24,23,22,21,21];
    return temperatures.slice(state.weatherPage * 3, state.weatherPage * 3 + 3).map((temp, index) => {
      const hour = state.weatherPage * 3 + index;
      return '<div><span>' + hour + '시</span>' + weatherIcon(hour < 6 || hour >= 19) + '<strong>' + temp + '°</strong></div>';
    }).join('');
  }
  function changeWeatherPage(page) {
    state.weatherPage = ((page % 8) + 8) % 8;
    if (!$('#weatherHours')) return;
    $('#weatherHours').innerHTML = weatherHours();
  }
  function dashboardLead() {
    return '<div class="v-home-board"><div class="v-home-primary">' +
      '<article class="v-feature-banner" id="dashboardBanner" aria-roledescription="carousel" aria-label="주요 기능 소개 자동 배너">' +
      '<div class="v-feature-banner-copy"><div class="v-feature-banner-top"><span class="v-feature-banner-kicker" id="bannerKicker"></span></div>' +
      '<h1 id="bannerTitle" tabindex="-1"></h1><p id="bannerText"></p><button class="v-feature-banner-action" id="bannerAction" data-action="banner-detail" type="button"></button></div>' +
      '<div class="v-feature-banner-image" aria-hidden="true"><span></span><img id="bannerImage" src="./assets/dashboard-banners/feature-sales.svg" width="320" height="280" alt=""></div>' +
      '<div class="v-feature-banner-footer"><div class="v-feature-banner-pages"><span id="bannerCount"></span>'+banners.map((item,index)=>'<button class="v-feature-banner-dot" id="bannerDot'+index+'" data-banner-index="'+index+'" type="button" aria-label="'+views[item.view]+' 소개 배너" aria-pressed="false"></button>').join('')+'</div>' +
      '<div class="v-feature-banner-controls"><button data-action="banner-prev" aria-label="이전 배너" type="button">‹</button><button data-action="banner-pause" id="bannerPause" type="button" aria-label="배너 자동 전환 일시정지">Ⅱ</button><button data-action="banner-next" aria-label="다음 배너" type="button">›</button></div></div></article>' +
      card(guidanceCard(true), 'v-dashboard-guidance v-decision-action v-home-guidance')+'</div><div class="v-home-secondary">'+financeThermometerCard()+weatherCard()+'</div></div>';
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
  function recoveryDashboardCard(marketResult) {
    const observed = marketResult || window.IM_MARKET_DATA.analyze(state.period);
    const c = observed.current;
    if (!c.count) return card(head('통행에서 결제까지')+note('선택 조건에 분석 가능한 관측 자료가 없습니다.'),'v-conversion-summary');
    const r = {passersby:c.passers, entrants:c.entrants, validPayments:c.validPayments};
    const entry = r.passersby ? r.entrants/r.passersby*100:null;
    const conversion = r.entrants ? r.validPayments/r.entrants*100:null;
    return '<article class="card v-card v-conversion-summary"><div class="v-row v-between"><h2>통행에서 결제까지</h2>'+badge('같은 매장 · 시연 집계')+'</div><div class="v-conversion-metrics"><div><span>통행</span><strong>'+number(r.passersby)+'건</strong></div><i>→</i><div><span>입장</span><strong>'+number(r.entrants)+'건</strong></div><i>→</i><div><span>유효 결제</span><strong>'+number(r.validPayments)+'건</strong></div></div><div class="v-transfer-kpis">'+metric('유입률',ratioText(entry),undefined,'입장 관측 ÷ 통행 관측')+metric('결제 전환율 · 추정',ratioText(conversion),undefined,'유효 결제 ÷ 입장 관측')+'</div><p class="v-metadata">'+state.period.start+' ~ '+state.period.end+' · 결제 건수는 구매 인원과 다릅니다. 입장과 결제 사이의 시간 차이가 있어 기간 합산 추정치로 봅니다.</p></article>';
  }
  function dashboard() { return dashboardLead(); }
  function relocatedSales() {
    return '<div class="v-relocated-sales"><h2>영업 준비와 시간대별 안내</h2><div class="v-grid2">'+card(guidanceCard(),'v-dashboard-guidance v-decision-action')+dashboardInsight()+'</div></div>';
  }
  function relocatedMarket(marketResult) {
    return '<div class="v-relocated-market">'+recoveryDashboardCard(marketResult)+'<details class="v-related-analysis"><summary>주변 소비 흐름과 우리 가게 매출 함께 보기</summary><p class="v-metadata">주변 상권은 최근 30일의 같은 요일 패턴, 비교 그래프는 선택 기간의 모든 요일 기준입니다. 위 상권 요일 필터와 별도로 표시합니다.</p><div class="v-grid2">'+dashboardContextCard()+card(head('상권과 우리 가게의 흐름')+comparisonChart(),'v-evidence-panel')+'</div><p class="v-metadata">통행·입장은 매장 전면 관측이며, 주변 상권과 서비스 이용 가게 소비는 별도 시연 표본입니다.</p></details></div>';
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
  function marketAnalysis() {
    return window.IM_MARKET_ANALYSIS ? window.IM_MARKET_ANALYSIS.render(state.period) : note('상권분석 모듈을 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
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
  const reportPrompts = ['고깃집 매출과 지출을 함께 분석해 주세요.', '저녁 시간대 운영 준비를 정리해 주세요.', '오늘 실행할 행동지침을 알려 주세요.'];
  function secretary() {
    return '<article class="card v-card v-secretary-main"><div class="v-row v-between"><div><span class="v-tag">고깃집 시연 데이터 분석</span><h1>'+esc(state.profile.name)+'님의 iM비서</h1></div><button class="v-button" type="button" data-action="open-document-guide">분석에서 문서까지 ↗</button></div><p class="v-subtitle">'+esc(state.profile.storeName)+' · '+state.period.start+' ~ '+state.period.end+'의 자료에서 근거와 다음 행동을 정리합니다.</p><div class="v-report-chat" id="reportMessages" role="log" aria-live="polite">'+(state.reportMessages.length?state.reportMessages.map(m=>'<div class="ai-message '+m.type+'">'+esc(m.text)+'</div>').join(''):'<div class="ai-message bot">어떤 부분을 살펴볼까요? 매출·지출과 저녁 운영에 관해 질문해 주세요. 시연 데이터를 읽어 답변합니다.</div>')+'</div><div class="v-report-suggestions" aria-label="추천 질문">'+reportPrompts.map(q=>button(esc(q),'data-report-question="'+esc(q)+'"')).join('')+'</div><form class="v-compose" id="reportForm"><textarea id="reportInput" maxlength="500" required placeholder="분석하고 싶은 내용을 적어 주세요" aria-label="iM비서 분석 질문"></textarea><button class="v-button primary" type="submit">분석하기</button></form>'+
      (state.secretaryActions.length?'<section class="v-secretary-actions"><div class="v-row v-between"><h2>확인한 뒤 실행할 행동지침</h2><button class="v-button" data-action="record-execution">실행 기록하기 →</button></div>'+state.secretaryActions.map((a,i)=>'<div class="v-list-item"><span class="v-number">'+(i+1)+'</span><div><strong>'+esc(a.title)+'</strong><p>'+esc(a.evidence)+'</p></div></div>').join('')+'<p class="v-metadata">실제로 수행한 날짜와 시간을 직접 기록하세요. 이 안내를 읽은 것만으로 실행 처리하지 않습니다.</p></section>':'')+
      '<div id="reportResult"'+(state.reportReady?'':' hidden')+' class="v-report-result"><h2>분석 내용을 문서로 보관하세요</h2><p class="v-subtitle">매출·지출, 근거와 운영 점검 제안을 PDF로 정리합니다.</p>'+button(state.pdfBusy?'리포트 생성 중…':'회복전략 리포트 PDF 만들기','data-action="make-pdf" id="makePdfButton"'+(state.pdfBusy?' disabled':''),true)+'<div id="pdfDownload"'+(state.reportBlobUrl?'':' hidden')+'><a class="v-download" id="pdfLink"'+(state.reportBlobUrl?' href="'+state.reportBlobUrl+'"':'')+' download="iM파트너_회복전략_리포트.pdf">리포트 PDF 다운로드</a></div></div></article>';
  }
  function executionActions(question) {
    const actions=[];
    if (/지출|매입|비용|재고/.test(question)) actions.push({id:'stock-review',title:'매입·재고 기록 점검',evidence:costText()});
    if (/매출|행동|실행|시간|운영|준비/.test(question) || !actions.length) {
      const peak = analysis.slots.slice().sort((a,b)=>b.sales-a.sales)[0];
      actions.push({id:'menu-visibility',title:'대표 메뉴와 가격 안내 점검',evidence:'선택 기간 매출 '+money(analysis.sales)+'. 매장 앞 안내와 실제 판매 조건이 일치하는지 확인하세요.'});
      if (peak) actions.push({id:'peak-preparation',title:peak.label+' 재료·응대 준비',evidence:'이 구간의 시연 매출 합계는 '+money(peak.sales)+'입니다. 재고와 응대 준비를 점검하세요.'});
    }
    return actions;
  }
  function openExecutionDialog() {
    if (!state.secretaryActions.length) return;
    const modal=$('#executionModal');
    $('#executionActionOptions').innerHTML=state.secretaryActions.map(a=>'<label class="v-execution-option"><input type="checkbox" name="action" value="'+esc(a.id)+'" checked><span>'+esc(a.title)+'</span></label>').join('');
    $('#executionDate').value='2026-09-03';
    $('#executionNote').value=''; $('#executionError').textContent='';
    modal.showModal();
  }
  function aftercare() { return window.IM_AFTERCARE.render(D); }
  function field(label, name, type, extra) {
    return '<label class="v-field">' + label + '<input name="' + name + '" type="' + (type || 'text') + '" value="' + esc(state.profile[name]) + '" ' + (extra || '') + '></label>';
  }
  function profile() {
    return note('프로필 입력값은 화면 표기·가상 공고 조건 확인에만 적용되고 새로고침하면 초기화됩니다. 생성 POS·상권 자료는 예시 음식점의 고정 자료입니다. 실제 개인정보를 입력할 필요가 없으며, 계정 생성·DB 저장은 하지 않습니다.') +
      '<form id="profileForm"><div class="v-grid2">' + card(head('사용자 정보', badge('화면 입력 시안', 'neutral')) + '<div class="v-form-grid">' +
      field('이름', 'name', 'text', 'required maxlength="40"') + field('나이 · 시연 인물은 50대', 'age', 'number', 'min="0" max="120" placeholder="정확한 나이는 미입력"') +
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
    if (menuBadge) menuBadge.setAttribute('aria-label', '나의 가게 온도 ' + spokenTemperature);
    $('#profileMenuButton').setAttribute(
      'aria-label',
      state.profile.name + ' 프로필 메뉴, 나의 가게 온도 ' + spokenTemperature
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
    $('.app-shell').classList.toggle('home-view', dashboardView);
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
    $('#aiContext').hidden = true;
    document.querySelectorAll('[data-view]').forEach(el => { el.classList.toggle('active', el.dataset.view === state.view); if (el.classList.contains('nav-item')) { if (el.dataset.view === state.view) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); } });
    const renders = { dashboard, analysis: combinedAnalysis, market: marketAnalysis, policies, secretary, profile, aftercare };
    $('#viewRoot').innerHTML = renders[state.view]() + sourceFoot;
    sectionizeView(state.view);
    $('#periodSelect').value = state.periodMode;
    $('#customPeriod').hidden = true;
    if ($('#sectionPeriodSelect')) $('#sectionPeriodSelect').value = state.periodMode;
    if ($('#sectionCustomPeriod')) $('#sectionCustomPeriod').hidden = state.periodMode !== 'custom';
    syncChartSelection();
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
    const observed = window.IM_MARKET_DATA.analyze(state.period), r = observed.current;
    const salesResult = window.IM_SALES_DATA.analyze(D, state.period, {comparison:'weekday'});
    const peak = salesResult.slots.filter(row=>row.sales>0).slice().sort((a,b)=>b.sales-a.sales)[0];
    const scope = state.period.start + ' ~ ' + state.period.end + ' · 전체 메뉴·요일 · 17~23시';
    if (/(프로필|내 이름|내 정보|가입|비밀번호)/.test(question)) return { known: true, text: '현재 화면 프로필은 ' + state.profile.name + '님, ' + state.profile.region + ' 소재 ' + state.profile.industry + '입니다.\n프로필 수정은 표시·가상 공고 조건 확인에만 적용됩니다. 생성 POS는 예시 음식점 자료이며 실제 계정 생성·비밀번호 저장은 제공하지 않습니다.' };
    if (/(날씨|뉴스|행사|축제|캘린더|달력)/.test(question)) return { known: true, text: '홈은 대구 중구의 9월 3일 26°C, 맑음을 가정한 시연 날씨입니다. 실제 현재 날씨가 아닙니다.\n더운 날 저녁 영업의 환기와 음료 준비 상태를 점검하세요. 날씨를 매출 변화의 확정 원인으로 해석하지 않습니다.' };
    if (/(정책|지원|공고)/.test(question)) return { known: true, text: '근거: 현재는 실제 공고 대신 화면 구성용 예시만 있습니다.\n확인: 지역·업종·직원 수·나이 조건을 구분합니다. 적합도 % 산식은 미정입니다.\n행동: 지원사업 메뉴에서 예시 조건을 확인하세요. 실제 신청 자격은 확정할 수 없습니다.' };
    if (/(고객|직장|연령|나이)/.test(question)) return { known: true, text: '근거: 연령대·직장인 비중 자료는 연결되지 않았습니다.\n해석: 특정 고객층을 추천할 근거가 부족합니다.\n행동: 방문·소비 고객층 자료를 확보한 뒤 메뉴와 홍보 대상을 정하세요.' };
    if (/(CCTV|통행|체류|입장|유입|구매전환|객단가|전환율)/i.test(question)) return { known: true, text: '기준: '+scope+'\n근거: '+(r.count?'통행 관측 '+number(r.passers)+'건, 입장 관측 '+number(r.entrants)+'건, 유효 결제 '+number(r.validPayments)+'건입니다. 입장률 '+ratioText(r.entryRate)+', 결제 전환율 추정 '+ratioText(r.estimatedPurchaseRate)+', 객단가 '+(r.customerAverage==null?'계산 불가':money(r.customerAverage))+'입니다.':'분석 가능한 관측 자료가 없습니다.')+'\n해석: 결제는 인원수가 아니며, 입장과 결제 사이에 시간 차이가 있습니다. 같은 매장의 생성 자료를 기간 합산한 값입니다.\n행동: 매장 앞 메뉴·가격 안내와 주문 대기 기록을 함께 점검하세요.' };
    if (/(현금|자금|잔액|대출|금융|체온)/.test(question)) return { known: true, text: '근거: 매출 ' + money(analysis.sales) + ', 지출 ' + money(analysis.expense) + '입니다.\n해석: 이 차이는 현재 현금이나 영업이익이 아닙니다. 금융지수는 일별 매출·지출 참고 지수의 최근 30일 평균이며 종합 신용점수가 아닙니다. 현금보유량·미정산 매출·예정 지출은 미연결입니다.\n행동: 보유 현금, 정산일, 예정 출금을 확인하세요. 대출 심사·신청은 제공하지 않습니다.' };
    if (/(지출|매입|비용|재고|발주|남는|돈)/.test(question)) return { known: true, text: '기준: '+scope+'\n근거: '+costText()+' 매출−지출 차이는 '+money(analysis.sales-analysis.expense)+'입니다.\n행동: 매입금액 상위 품목의 재고·폐기를 먼저 확인하세요. 실제 재고가 없어 발주 수량은 계산하지 않습니다.' };
    if (/(시간|언제|요일|준비)/.test(question)) return { known: true, text: '기준: '+scope+'\n근거: '+(peak?peak.label+' 매출 합계가 '+money(peak.sales)+'로 가장 높습니다.':'선택 기간에 판매 기록이 없습니다.')+'\n행동: 해당 시간 전 대표 메뉴의 준비 수량과 응대 상태를 점검하세요. 이 자료는 수요 예측이 아닌 생성 판매 기록입니다.' };
    if (/(행동|실행|플랜|회복|방법)/.test(question)) return { known: true, text: '기준: '+scope+'\n근거: 매출 '+money(analysis.sales)+(peak?', '+peak.label+' 매출 '+money(peak.sales):'')+'입니다.\n행동: 매장 앞 대표 메뉴·가격 안내, 피크 시간의 재료·응대 준비 상태를 확인하세요. 실제 수행 후 실행일과 시간을 기록하면 전후 각각 7일의 같은 영업시간 매출을 비교합니다. 할인율이나 효과를 미리 확정하지 않습니다.' };
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
    if (reply.known) { state.reportReady = true; state.secretaryActions = executionActions(q); }
    state.view = 'secretary'; render();
    $('#reportMessages').scrollTop = $('#reportMessages').scrollHeight;
  }
  const banners = [
    { view: 'analysis', kicker: '매출진단 · 우리 가게의 판매 흐름',
      title: '잘 팔린 메뉴와 시간,\n매출에서 답을 찾아요',
      text: '매출 변화와 품목·시간대별 흐름을 살펴보고,\n오늘 영업에서 점검할 부분을 찾아보세요.',
      action: '매출진단 살펴보기 →', theme: 'sales', image: './assets/dashboard-banners/feature-sales.svg' },
    { view: 'market', kicker: '상권분석 · 매장 앞에서 시작하는 관찰',
      title: '가게 앞 사람들의 흐름,\n방문으로 이어지는 순간',
      text: '통행·체류·입장 흐름을 시간대별로 비교하고,\n우리 가게 앞에서 생기는 기회를 살펴보세요.',
      action: '상권분석 살펴보기 →', theme: 'market', image: './assets/dashboard-banners/feature-market.svg' },
    { view: 'policies', kicker: '지원사업 · 내 가게의 조건부터',
      title: '우리 가게에 맞는 지원,\n필요한 조건부터 확인해요',
      text: '업종과 지역 등 가게의 조건을 바탕으로\n지원사업과 신청 전 확인할 항목을 살펴보세요.',
      action: '지원사업 살펴보기 →', theme: 'support', image: './assets/dashboard-banners/feature-support.svg' },
    { view: 'secretary', kicker: 'iM비서 · 질문에서 행동까지',
      title: '궁금한 점은 물어보고,\n오늘 할 일을 정리해요',
      text: '가게 데이터로 궁금한 점을 살펴보고,\n행동지침과 분석 결과를 문서로 남겨보세요.',
      action: 'iM비서에게 물어보기 →', theme: 'secretary', image: './assets/dashboard-banners/feature-secretary.svg' },
    { view: 'aftercare', kicker: '사후관리 · 실행 이후의 변화',
      title: '실천한 일을 기록하고,\n가게의 변화를 살펴봐요',
      text: '실행한 행동과 날짜를 기록하고,\n실행 전후 7일의 매출을 비교해 보세요.',
      action: '사후관리 살펴보기 →', theme: 'aftercare', image: './assets/dashboard-banners/feature-aftercare.svg' }
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
    state.reportReady = false; state.reportMessages = []; state.secretaryActions = [];
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
    btn.disabled = true; btn.textContent = '회복전략 리포트 생성 중…';
    try {
      const blob = await window.IM_REPORT_PDF.generate({
        profile: Object.assign({}, state.profile), analysis, cause: causeText(), cost: costText(),
        discussion: state.reportMessages.filter(r => r.type === 'user').map(r => r.text).slice(-3), actions: state.secretaryActions.map(row=>({...row}))
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
        if (current) { current.disabled = false; current.textContent = state.reportBlobUrl ? '회복전략 리포트 PDF 다시 만들기' : '회복전략 리포트 PDF 만들기'; }
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
    if (el.dataset.reportQuestion) { $('#reportInput').value = el.dataset.reportQuestion; $('#reportInput').focus(); }
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
      case 'banner-detail': navigate(banners[state.bannerIndex].view); break;
      case 'weather-prev': changeWeatherPage(state.weatherPage - 1); break;
      case 'weather-next': changeWeatherPage(state.weatherPage + 1); break;
      case 'policy-prev': state.offset--; $('#policyResults').innerHTML = policyResults(); break;
      case 'policy-next': state.offset++; $('#policyResults').innerHTML = policyResults(); break;
      case 'make-pdf': makePdf(); break;
      case 'open-document-guide': $('#documentGuideModal').showModal(); break;
      case 'close-document-guide': $('#documentGuideModal').close(); break;
      case 'record-execution': openExecutionDialog(); break;
      case 'close-execution': $('#executionModal').close(); break;
      case 'close-modal': $('#policyModal').close(); break;
    }
  });
  function showChartTooltip(event) {
    const hit=event.target.closest?.('[data-chart-index]'); if(!hit)return;
    const wrap=hit.closest('.v-comparison-chart'), row=(state.chartMode==='weekday'?analysis.weekdaySlots:analysis.slots)[Number(hit.dataset.chartIndex)];
    if(!row)return;
    const fields=[['traffic','상권 유동인구','명'],['storefront','우리 가게 앞 통행 관측','건'],['card','카드 소비','원'],['sales','우리 가게 매출','원']].filter(([key])=>!state.chartSeries.length||state.chartSeries.includes(key));
    const tip=wrap.querySelector('.v-chart-tooltip'); tip.innerHTML='<strong>'+esc(row.label)+'</strong>'+fields.map(([key,label,unit])=>'<span>'+label+' <b>'+(row[key]==null?'자료 없음':number(row[key])+unit)+'</b></span>').join(''); tip.hidden=false;
  }
  document.addEventListener('pointerover',showChartTooltip);
  document.addEventListener('focusin',showChartTooltip);
  document.addEventListener('click',showChartTooltip);
  document.addEventListener('input', event => {
    if (event.target.id === 'policySearch') { state.keyword = event.target.value.trim(); state.offset = 0; $('#policyResults').innerHTML = policyResults(); }
  });
  document.addEventListener('change', event => {
    const el = event.target;
    if (el.id === 'policyCategory') { state.category = el.value; state.offset = 0; $('#policyResults').innerHTML = policyResults(); }
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
      if (!p) { notice('시연 자료가 있는 2026.06.01~09.30 안에서 시작일과 종료일을 확인해 주세요.'); return; }
      state.periodMode = 'custom';
      state.period = p; analysis = D.analyze(p); invalidateReport(); render();
      if (!analysis.comparisonAvailable) notice('현재 기간은 분석할 수 있지만 직전 비교 기간의 자료가 부족합니다.');
    }
    if (form.id === 'executionForm') {
      event.preventDefault();
      const formData=new FormData(form);
      const ids=formData.getAll('action');
      const record={id:'execution-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),date:String(formData.get('date')),startHour:Number(formData.get('startHour')),endHour:Number(formData.get('endHour')),note:String(formData.get('note')||'').trim(),actions:state.secretaryActions.filter(a=>ids.includes(a.id)),analysisPeriod:{...state.period},sourceType:'synthetic_demo'};
      try { window.IM_AFTERCARE.save(record); $('#executionModal').close(); navigate('aftercare'); notice('이 브라우저에 시연 실행 기록을 저장했습니다.'); }
      catch(error) { $('#executionError').textContent=error.message; }
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
    if (guide && hourChanged && (state.view === 'dashboard' || state.guideHour === null)) {
      guide.innerHTML = guidanceCard(state.view === 'dashboard');
      const contextCard = document.querySelector('.v-dashboard-context');
      if (contextCard) contextCard.outerHTML = dashboardContextCard();
    }
    const insight = document.querySelector('.v-dashboard-insight');
    if (insight) insight.outerHTML = dashboardInsight();
  }
  setInterval(refreshCurrentIndicators, 15000);
  document.addEventListener('visibilitychange', refreshCurrentIndicators);
  window.addEventListener('hashchange', () => { const view = normalizeView(location.hash.slice(1)); if (views[view]) navigate(view); });
  const initialView = normalizeView(location.hash.slice(1));
  state.view = views[initialView] ? initialView : 'dashboard';
  if (location.hash && location.hash !== '#' + state.view) history.replaceState(null, '', '#' + state.view);
  if (window.IM_SALES_DIAGNOSIS) { window.IM_SALES_DIAGNOSIS.bind(render); window.IM_SALES_DIAGNOSIS.setExtrasRenderer?.(relocatedSales); }
  if (window.IM_AFTERCARE) window.IM_AFTERCARE.bind(render);
  if (window.IM_MARKET_ANALYSIS) { window.IM_MARKET_ANALYSIS.bind(render); window.IM_MARKET_ANALYSIS.setExtrasRenderer?.(relocatedMarket); }
  render();
})();
