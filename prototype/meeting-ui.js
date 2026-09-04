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
  const dateText = value => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1.$2.$3');
  const button = (label, attrs, primary) => '<button type="button" class="v-button' + (primary ? ' primary' : '') + '" ' + attrs + '>' + label + '</button>';
  const badge = (label, variant) => '<span class="v-tag ' + (variant || '') + '">' + esc(label) + '</span>';
  const note = (text, variant) => '<div class="v-note ' + (variant || '') + '">' + text + '</div>';
  const card = body => '<article class="card v-card">' + body + '</article>';
  const head = (title, extra) => '<div class="v-row v-between"><h2>' + title + '</h2>' + (extra || '') + '</div>';
  const views = { dashboard: '대시보드', market: '상권·시간 분석', finance: '매출·지출 분석', recovery: '골목상권 회복 플랜', policies: '정책·지원사업', secretary: 'AI 비서', profile: '내 프로필' };
  const captions = {
    dashboard: '가게의 오늘을 살펴보세요.',
    market: '언제, 무엇을 준비해야 할까요?',
    finance: '매출과 남는 돈을 함께 보세요.',
    recovery: '분석에서, 오늘의 실행으로.',
    policies: '내 가게에 맞는 지원을 찾아보세요.',
    secretary: '질문으로 분석하고, 문서로 남기세요.',
    profile: '내 가게의 기준 정보를 확인하세요.'
  };
  const state = {
    view: 'dashboard', periodMode: 'month', period: Object.assign({}, D.periods.month), profile: Object.assign({}, D.profile),
    policyView: 'recommended', keyword: '', category: 'all', offset: 0,
    reportMessages: [], reportBlobUrl: null, reportReady: false, reportRevision: 0, pdfBusy: false,
    bannerIndex: 0, bannerPaused: false, chatOpen: false, radius: 500, recoveryStarted: false
  };
  let analysis = D.analyze(state.period);
  const recoveryData = D.analyzeRecovery();
  const sourceFoot = '<p class="v-footer">생성 데이터 기반 시연 · 실제 POS·카드사·통신사 원자료가 아닙니다. 이 화면에는 DB·외부 API·실제 AI가 연결되어 있지 않습니다.</p>';
  function icon(name) {
    const paths = {
      dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
      market: '<path d="M3 20V10m6 10V4m6 16v-7m6 7V7"/>',
      finance: '<path d="M4 4h16v16H4zM7 8h10M7 12h4M7 16h4"/>',
      recovery: '<path d="M3 17l6-6 4 4 8-11M14 4h7v7"/>',
      policies: '<path d="M4 7l8-4 8 4M4 20h16M6 9v8m6-8v8m6-8v8"/>',
      secretary: '<path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
      profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + '</svg>';
  }
  $('#mainNavigation').innerHTML = Object.entries(views).map(([id, name]) =>
    '<button type="button" class="nav-item" data-view="' + id + '" title="' + name + '"><span class="nav-icon">' + icon(id) + '</span><span class="nav-label">' + name + '</span></button>'
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
  function comparisonChart() {
    const rows = analysis.slots;
    const x = i => 46 + i * 98, y = value => 210 - value * 1.7;
    const path = key => rows.map((r, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(r[key]).toFixed(2)).join(' ');
    const focus = rows.indexOf(analysis.focus);
    let svg = '<svg class="v-chart" viewBox="0 0 590 260" role="img" aria-label="시간대별 유동인구와 카드소비 상대 지수, 각 지표 최댓값 100 기준"><rect x="' + (x(focus) - 26) + '" y="26" width="52" height="184" rx="9" fill="#fff2df"/>';
    [0, 25, 50, 75, 100].forEach(v => { svg += '<line x1="45" x2="548" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#e9efeb"/><text x="8" y="' + (y(v) + 5) + '">' + v + '</text>'; });
    svg += '<path d="' + path('trafficIndex') + '" fill="none" stroke="#399b87" stroke-width="3"/><path d="' + path('cardIndex') + '" fill="none" stroke="#e7a04f" stroke-width="3"/>';
    rows.forEach((r, i) => { svg += '<circle cx="' + x(i) + '" cy="' + y(r.trafficIndex) + '" r="4" fill="#399b87"/><circle cx="' + x(i) + '" cy="' + y(r.cardIndex) + '" r="4" fill="#e7a04f"/><text x="' + x(i) + '" y="241" text-anchor="middle">' + r.label + '</text>'; });
    return '<div class="v-legend"><span><i class="v-dot"></i>유동인구</span><span><i class="v-dot orange"></i>카드소비</span></div>' + svg + '</svg><p class="v-metadata">생성 상권 자료 · 각 지표의 선택 기간 내 시간대 최댓값=100<br>개인의 구매전환율이 아닌 상대 수준의 비교입니다.</p>';
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
  function causeMarkup() {
    const text = causeText(), boundary = text.indexOf('. ');
    if (boundary < 0) return '<span>' + esc(text) + '</span>';
    return '<span>' + esc(text.slice(0, boundary + 1)) + '</span><span>' + esc(text.slice(boundary + 2)) + '</span>';
  }
  function costText() {
    const purchase = analysis.byCategory.find(r => r.id === 'purchase');
    return '매출 ' + money(analysis.sales) + '에 지출 ' + money(analysis.expense) + '입니다. 매입비는 ' + money(purchase.amount) + '이며, ' +
      (analysis.comparisonAvailable ? '직전 기간보다 ' + pct(D.rate(purchase.amount, purchase.previous)) + ' 변했습니다. ' : '직전 기간 비교 자료가 부족합니다. ') +
      '매출·지출 차이는 회계상 영업이익이나 현재 현금잔액이 아닙니다.';
  }
  function guidanceCard() {
    const hour = Number(new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', hour12: false, timeZone: 'Asia/Seoul' }).format(new Date()).replace(/\D/g, '')) % 24;
    return head('지금, 무엇을 하면 좋을까요?', badge('지난 7일 참고')) +
      '<label class="v-row v-subtitle">확인 시간 <select id="guideHour" class="v-select" aria-label="행동 안내 기준 시간">' +
      Array.from({ length: 24 }, (_, h) => '<option value="' + h + '"' + (h === hour ? ' selected' : '') + '>' + String(h).padStart(2, '0') + ':00</option>').join('') +
      '</select></label><div id="guidanceContent" class="v-space">' + guidanceContent(hour) + '</div>';
  }
  function guidanceContent(hour) {
    const g = D.guidance(hour);
    return '<h3>' + g.title + '</h3><p class="v-subtitle">' + g.text + '</p>' +
      (g.average == null ? '' : '<p class="v-space"><span class="v-big">' + money(g.average) + '</span> <span class="v-metadata">해당 시간 일평균 매출</span></p>') +
      '<p class="v-metadata v-space">시연 기준일 2026.09.03 · 8/27~9/2 생성 자료<br>관측 ' + g.count + '일 · 같은 요일은 1회 관측이며 반복 수요를 보장하지 않습니다.</p>';
  }
  function calendar() {
    let cells = ['일', '월', '화', '수', '목', '금', '토'].map(d => '<span class="day-name">' + d + '</span>').join('');
    cells += '<span></span><span></span>';
    for (let d = 1; d <= 30; d++) cells += '<span class="' + (d === 3 ? 'today' : '') + '">' + d + '</span>';
    return '<div class="v-row v-between"><h3>2026년 9월</h3><span class="v-metadata">시연 기준 달력</span></div><div class="v-calendar">' + cells + '</div><p class="v-metadata">행사 일정은 아직 연결되지 않았습니다.</p>';
  }
  function periodOptions(selected) {
    return [
      ['month', '2026년 8월 · 한 달'],
      ['week', '최근 7일 · 8/27~9/2'],
      ['custom', '직접 기간 선택']
    ].map(option => '<option value="' + option[0] + '"' + (option[0] === selected ? ' selected' : '') + '>' + option[1] + '</option>').join('');
  }
  function dashboardLead() {
    const expenseRatio = analysis.expenseRatio;
    const expenseRatioText = expenseRatio == null ? '—' : expenseRatio.toFixed(1) + '%';
    const expenseRatioWidth = expenseRatio == null ? 0 : Math.max(0, Math.min(100, expenseRatio));
    return '<section class="v-dashboard-lead" aria-label="오늘의 브리핑과 골목금융 체온계">' +
      '<div class="v-feature-banner" id="dashboardBanner" data-banner-theme="news" aria-roledescription="carousel" aria-label="오늘의 브리핑 자동 배너">' +
      '<div class="v-feature-banner-copy"><div class="v-feature-banner-top"><span class="v-feature-banner-kicker" id="bannerKicker"></span><span class="v-feature-period-wrap"><select class="v-feature-period-select" id="dashboardPeriodSelect" aria-label="분석 기간">' + periodOptions(state.periodMode) + '</select></span></div>' +
      '<form class="v-feature-custom-period" id="dashboardCustomPeriod"' + (state.periodMode === 'custom' ? '' : ' hidden') + '><label>시작일<input id="dashboardPeriodStart" type="date" value="' + state.period.start + '" min="2026-07-01" max="2026-09-02" required></label><label>종료일<input id="dashboardPeriodEnd" type="date" value="' + state.period.end + '" min="2026-07-01" max="2026-09-02" required></label><button type="submit">적용</button></form>' +
      '<h1 id="bannerTitle" tabindex="-1"></h1><p id="bannerText"></p><button class="v-feature-banner-action" id="bannerAction" data-action="banner-detail" type="button"></button></div>' +
      '<div class="v-feature-banner-image" aria-hidden="true"><span></span><img id="bannerImage" src="./assets/dashboard-banners/briefing-market.png" width="640" height="640" alt=""></div>' +
      '<div class="v-feature-banner-footer"><div class="v-feature-banner-pages"><span id="bannerCount"></span><button class="v-feature-banner-dot active" id="bannerDot0" data-banner-index="0" type="button" aria-label="첫 번째 배너" aria-pressed="true"></button><button class="v-feature-banner-dot" id="bannerDot1" data-banner-index="1" type="button" aria-label="두 번째 배너" aria-pressed="false"></button><button class="v-feature-banner-dot" id="bannerDot2" data-banner-index="2" type="button" aria-label="세 번째 배너" aria-pressed="false"></button></div>' +
      '<div class="v-feature-banner-controls"><button data-action="banner-prev" aria-label="이전 배너" type="button">‹</button><button data-action="banner-pause" id="bannerPause" type="button" aria-label="배너 자동 전환 일시정지">Ⅱ</button><button data-action="banner-next" aria-label="다음 배너" type="button">›</button></div></div></div>' +
      '<article class="v-finance-thermo-card" aria-labelledby="financeThermoTitle"><div class="v-finance-thermo-head"><div><p>금융상태 한눈에 보기</p><h2 id="financeThermoTitle">골목금융 체온계</h2></div><span>핵심 금융 지표</span></div>' +
      '<div class="v-finance-thermo-visual"><div class="v-finance-thermo-ring" aria-hidden="true"><div class="v-finance-thermo-symbol"><i></i></div></div><div class="v-finance-thermo-state"><strong>—°</strong><span>점수 산출 기준<br>확인 중입니다.</span></div></div>' +
      '<div class="v-finance-ratio"><div class="v-finance-ratio-head"><span>현재 확인 가능한 지표</span><strong>' + expenseRatioText + '</strong></div><div class="v-finance-ratio-track" role="progressbar" aria-label="매출 대비 지출 비율" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + expenseRatioWidth.toFixed(1) + '" aria-valuetext="' + expenseRatioText + '"><span style="width:' + expenseRatioWidth + '%"></span></div><p>매출 대비 지출 비율 · 체온계 점수나 신용평가가 아닙니다.</p></div></article></section>';
  }
  function recoveryDashboardCard() {
    const r = recoveryData.opportunity;
    return '<section class="card v-recovery-signal" aria-label="최근 CCTV와 POS 회복 신호">' +
      '<div><div class="v-row"><span class="v-tag amber">CCTV·POS 생성 분석</span><span class="v-metadata">분석일 ' + dateText(recoveryData.analysisDate) + '</span></div>' +
      '<h2>' + r.label + ', 통행은 많지만<br>입장 전환을 먼저 점검해 보세요.</h2>' +
      '<p>통행자 <strong>' + number(r.passersby) + '명</strong> 중 입장객은 <strong>' + number(r.entrants) + '명</strong>, 매장 유입률은 <strong>' + ratioText(r.entryRate) + '</strong>입니다. 확정 원인이 아닌 요인 후보를 행동으로 연결합니다.</p>' +
      '<button class="v-button primary" type="button" data-view="recovery">전환 흐름과 회복 플랜 보기 →</button></div>' +
      '<div class="v-signal-flow" aria-label="통행에서 결제까지의 핵심 수치"><div><span>통행</span><strong>' + number(r.passersby) + '명</strong></div><i>→</i><div class="focus"><span>입장</span><strong>' + number(r.entrants) + '명</strong></div><i>→</i><div><span>결제</span><strong>' + number(r.validPayments) + '건</strong></div></div>' +
      '</section>';
  }
  function recoveryFunnel() {
    const r = recoveryData.opportunity;
    const steps = [
      { label: '매장 앞 통행', value: number(r.passersby) + '명', meta: '기준 100%', icon: '길' },
      { label: '매장 앞 체류', value: number(r.dwellers) + '명', meta: '체류율 ' + ratioText(r.dwellRate), icon: '눈' },
      { label: '매장 입장', value: number(r.entrants) + '명', meta: '유입률 ' + ratioText(r.entryRate), icon: '문', focus: true },
      { label: '유효 결제', value: number(r.validPayments) + '건', meta: '추정 전환 ' + ratioText(r.estimatedPurchaseRate), icon: '결' },
      { label: '순매출', value: money(r.netSales), meta: '매장 결제 생성값', icon: '원' }
    ];
    return '<div class="v-funnel">' + steps.map(step => '<article class="v-funnel-step' + (step.focus ? ' focus' : '') + '"><span class="v-funnel-icon" aria-hidden="true">' + step.icon + '</span><span class="v-funnel-label">' + step.label + '</span><strong>' + step.value + '</strong><span class="v-funnel-meta">' + step.meta + '</span></article>').join('') + '</div>' +
      '<div class="v-funnel-metrics"><div><span>객단가</span><strong>' + money(r.averageTicket) + '</strong></div><div><span>가장 큰 점검 구간</span><strong>통행 → 입장</strong></div><div><span>비교 범위</span><strong>매장 내 결제 시나리오</strong></div></div>';
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
    let svg = '<svg class="v-recovery-chart" viewBox="0 0 620 275" role="img" aria-label="시간대별 통행자 수 막대와 매장 유입률 선 그래프">';
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
    return '<div class="v-row v-between"><div class="v-legend"><span><i class="v-dot"></i>통행자 수 · 왼쪽 축</span><span><i class="v-line-dot"></i>매장 유입률 · 오른쪽 축</span></div><span class="v-tag amber">' + recoveryData.opportunity.label + ' 시나리오</span></div>' + svg +
      '<p class="v-metadata">CCTV 형식 익명 집계 생성값 · 시간대 선택은 기능 검토용 시나리오이며 자동 추천 산식은 아직 확정되지 않았습니다.</p>';
  }
  function dashboard() {
    return dashboardLead() + '<section class="metric-grid v-dashboard-metrics" aria-label="선택 기간 핵심 지표">' +
      metric('내 가게 매출', compact(analysis.sales) + '<small> 원</small>', analysis.salesRate, state.period.comparison, true) +
      metric('총지출', compact(analysis.expense) + '<small> 원</small>', analysis.expenseRate, state.period.comparison, false, 'expense') +
      metric('상권 카드소비 변화', pct(analysis.cardRate), undefined, state.period.comparison + ' · 생성 자료') +
      metric('상권 유동인구 변화', pct(analysis.trafficRate), undefined, state.period.comparison + ' · 생성 자료') +
      '</section><div class="v-grid2">' +
      '<article class="card insight-card"><span class="v-tag">내 가게와 상권을 함께 보는 인사이트</span><h2>사람의 흐름과<br>소비의 흐름은 다릅니다.</h2><p class="v-insight-copy">' + causeMarkup() + '</p><button class="ghost-button" type="button" data-view="recovery">골목상권 회복 플랜 확인 →</button></article>' +
      card(head('유동인구와 카드소비', '<button class="text-button" type="button" data-view="market">상세 분석 →</button>') + comparisonChart()) + '</div>' + recoveryDashboardCard() +
      '<div class="v-grid2 v-dashboard-support">' + card(guidanceCard()) + card(head('가게 주변의 오늘', badge('연결 준비', 'neutral')) + '<div class="v-weather"><div><h3>대구 중구 날씨</h3><p class="v-subtitle">실시간 날씨 미연결</p></div><strong>—</strong></div><div class="v-space">' + calendar() + '</div>') + '</div>';
  }
  function market() {
    const max = Math.max(1, ...analysis.byWeekday.map(r => r.sales || 0));
    return note('상권 유동인구와 매장 방문자 수는 다릅니다. 이 시안은 생성 POS 판매 집계와 생성 상권 지표를 비교합니다.') +
      '<div class="v-grid2">' + card(head('시간대별 소비 흐름', badge(analysis.focus.label + ' 점검')) + comparisonChart()) +
      card(head('요일별 일평균 매출', badge('영업 기록 기준', 'neutral')) + analysis.byWeekday.map(r =>
        '<div class="v-row v-between"><span>' + r.label + '요일 <small class="v-metadata">' + r.count + '일</small></span><strong>' + (r.sales == null ? '자료 없음' : money(r.sales)) + '</strong></div><div class="v-progress"><span style="width:' + ((r.sales || 0) / max * 100) + '%"></span></div>').join('') +
        '<p class="v-metadata">합계가 아닌 관측 일수로 나눈 일평균입니다.</p>') + '</div>' +
      '<div class="v-grid2">' + card(guidanceCard()) + card(head('구분해서 해석해 주세요') +
        '<div class="v-list"><div class="v-list-item"><span class="v-number">01</span><div><strong>판매 수량</strong><p>생성 POS에서 취소 수량을 차감한 ' + number(analysis.soldUnits) + '개입니다. 주문 건수나 방문 인원으로 바꾸어 표시하지 않습니다.</p></div></div><div class="v-list-item"><span class="v-number">02</span><div><strong>매장 방문자 수</strong><p>별도 방문 자료는 아직 연결하지 않았습니다.</p></div></div><div class="v-list-item"><span class="v-number">03</span><div><strong>고객층·경기일 비교</strong><p>연령·직장인·행사 근거가 없어 특정 고객층이나 효과를 단정하지 않습니다.</p></div></div></div>') + '</div>';
  }
  function finance() {
    const purchase = analysis.byCategory.find(r => r.id === 'purchase');
    return '<section class="metric-grid">' + metric('선택 기간 매출', compact(analysis.sales) + '<small> 원</small>', analysis.salesRate, state.period.comparison, true) +
      metric('선택 기간 지출', compact(analysis.expense) + '<small> 원</small>', analysis.expenseRate, state.period.comparison, false, 'expense') +
      '<article class="card metric-card"><div class="metric-label">매출·지출 차이</div><div class="metric-value">' + compact(analysis.delta) + '<small> 원</small></div><p class="v-metadata v-space">영업이익·현금잔액과 구분</p></article>' +
      '<article class="card metric-card"><div class="metric-label">매입비</div><div class="metric-value">' + compact(purchase.amount) + '<small> 원</small></div><p class="v-metadata v-space">품목별 매입금액 합계</p></article></section>' +
      '<div class="v-grid2">' + card(head('일별 매출·지출') + salesChart()) +
      card(head('어디에 지출하고 있나요?') + analysis.byCategory.map(r =>
        '<div class="v-row v-between"><span>' + r.name + '</span><strong>' + money(r.amount) + '</strong></div><div class="v-progress"><span style="width:' + r.amount / Math.max(analysis.expense, 1) * 100 + '%"></span></div>').join('')) + '</div>' +
      '<div class="v-space">' + note(costText()) + '</div><div class="v-grid2">' +
      card(head('매입금액 TOP 3', badge('선택 기간')) + '<div class="v-table-wrap"><table class="v-table"><thead><tr><th>품목</th><th class="right">매입량</th><th class="right">매입금액</th></tr></thead><tbody>' +
        analysis.topPurchases.slice(0, 3).map(r => '<tr><td>' + r.name + '</td><td class="right">' + r.quantity.toFixed(1) + ' ' + r.unit + '</td><td class="right">' + money(r.amount) + '</td></tr>').join('') +
        '</tbody></table></div><p class="v-metadata v-space">생성 매입 자료 · 매입량은 실제 사용량과 다를 수 있습니다.</p>') +
      card(head('발주 전에 확인할 것') + '<div class="v-list"><div class="v-list-item"><span class="v-number">01</span><div><strong>판매 메뉴와 재료를 연결하세요</strong><p>메뉴별 레시피·단위 대응 자료가 필요합니다.</p></div></div><div class="v-list-item"><span class="v-number">02</span><div><strong>남은 재고·폐기를 확인하세요</strong><p>자료가 없어 과다 매입 수량이나 다음 달 발주량은 계산하지 않습니다.</p></div></div></div>') + '</div>' +
      '<div class="v-grid2">' + card(head('자금 흐름') + note('현금잔액·정산 예정일·예상 입출금 자료가 아직 없습니다. 매출 합계를 현재 보유 현금으로 해석하지 않습니다.', 'neutral')) +
      card(head('POS 집계 확인', badge('DB 대신 로컬 생성 자료', 'neutral')) + '<div class="v-table-wrap"><table class="v-table"><thead><tr><th>최근 일자</th><th>시간</th><th>품목</th><th class="right">순매출</th></tr></thead><tbody>' +
        analysis.pos.filter(r => r.netAmount > 0).slice(-5).map(r => '<tr><td>' + r.date.slice(5) + '</td><td>' + r.hour + '시</td><td>' + D.menu.find(m => m.id === r.itemId).name + '</td><td class="right">' + money(r.netAmount) + '</td></tr>').join('') +
        '</tbody></table></div><p class="v-metadata v-space">취소 ' + number(analysis.cancellations) + '개 차감 · 실 DB/POS 기기 미연결</p>') + '</div>';
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
      '<p>매장 앞 통행자는 <b>' + number(r.passersby) + '명</b>으로 많았지만 입장객은 <b>' + number(r.entrants) + '명</b>으로, 매장 유입률이 <b>' + ratioText(r.entryRate) + '</b>였습니다.</p></div>' +
      '<div class="v-recovery-hero-stats" aria-label="회복 플랜 핵심 지표"><div><span>통행량</span><strong>' + number(r.passersby) + '명</strong><small>매장 앞 익명 집계</small></div><div><span>입장객</span><strong>' + number(r.entrants) + '명</strong><small>통행 대비 입장</small></div><div class="warn"><span>매장 유입률</span><strong>' + ratioText(r.entryRate) + '</strong><small>입장객 ÷ 통행자</small></div><div><span>판단 상태</span><strong>요인 후보</strong><small>확정 원인 아님</small></div></div></section>' +
      '<div class="v-recovery-source"><span class="v-tag amber">생성 데이터 기반 시연</span><span>CCTV 형식 익명 집계와 매장 내 POS 결제 형식의 생성값입니다. 실제 영상·장비·POS·외부 AI는 연결되지 않았습니다.</span></div>' +
      '<div class="v-recovery-layout"><div class="v-stack">' +
      card(head(r.label + ' 매출 전환 흐름', '<button class="text-button" type="button" data-action="show-recovery-definitions">지표 기준 보기 →</button>') + '<p class="v-subtitle">매장 앞 통행에서 결제까지 이탈이 큰 구간을 확인합니다.</p>' + recoveryFunnel()) +
      card(head('시간대별 통행·입장 비교', badge('통행량 + 유입률', 'neutral')) + '<p class="v-subtitle">서로 다른 단위를 같은 축으로 오해하지 않도록 통행량과 유입률을 각각 표시합니다.</p>' + recoveryChart()) + '</div>' +
      '<aside class="v-stack">' +
      '<article class="card v-card v-diagnosis"><span class="v-tag">규칙 기반 진단 시안 · 요인 후보</span><h2>' + recoveryData.diagnosis.title + '</h2><p>' + recoveryData.diagnosis.explanation + '</p><div class="v-evidence"><div><span>' + r.label + ' 통행량</span><strong>' + number(r.passersby) + '명</strong></div><div><span>같은 시간 입장객</span><strong>' + number(r.entrants) + '명</strong></div><div><span>매장 유입률</span><strong>' + ratioText(r.entryRate) + '</strong></div></div><p class="v-metadata">판단 임계값과 규칙 버전은 미정이며, 이 화면은 승인된 생성 시나리오를 표시합니다.</p></article>' +
      '<article class="card v-card v-action-plan"><div class="v-row v-between"><div><h2>회복 플랜 제안</h2><p class="v-subtitle">분석을 오늘 실행할 행동으로 바꿉니다.</p></div>' + badge('규칙 기반 시안', 'neutral') + '</div><div class="v-plan-list">' + recoveryData.actions.map((item, i) => '<div class="v-plan-item"><span>0' + (i + 1) + '</span><div><small>' + item.time + '</small><strong>' + item.title + '</strong><p>' + item.detail + '</p></div></div>').join('') + '</div><button class="v-button primary v-plan-start" type="button" data-action="start-recovery"' + (state.recoveryStarted ? ' disabled' : '') + '>' + (state.recoveryStarted ? '실행 기록 시안 진행 중' : '실행 기록 시안 시작하기') + '</button><p class="v-metadata">현재 브라우저 안에서만 상태가 바뀌며 DB에 저장되지 않습니다.</p></article>' +
      '</aside></div>' +
      '<section class="card v-card v-recovery-compare"><div class="v-row v-between"><div><h2>실행 전·후 비교</h2><p class="v-subtitle">같은 매장·요일·시간대의 유입률, 결제 건수, 순매출을 함께 비교합니다.</p></div>' + badge('7일 비교', 'amber') + '</div><div class="v-compare-flow"><article class="current"><span>분석일 · 실행 전</span><strong>유입률 ' + ratioText(r.entryRate) + '</strong><p>유효 결제 ' + number(r.validPayments) + '건 · 순매출 ' + money(r.netSales) + '</p></article><i aria-hidden="true">→</i><article class="' + (state.recoveryStarted ? 'active' : '') + '"><span>이번 주 · 실행</span><strong>' + recoveryData.comparison.actionLabel + '</strong><p>' + actionState + '</p></article><i aria-hidden="true">→</i><article class="future"><span>' + dateText(recoveryData.comparison.followUpDate) + ' · 결과</span><strong>데이터 집계 대기</strong><p>자료가 준비되기 전에는 성공·효과 수치를 표시하지 않습니다.</p></article></div></section>' +
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
    return note('목록·조건 매칭을 확인하기 위한 가상 공고입니다. 실제 신청 가능한 사업이 아니며, 지원금·접수기간·적합도 %를 임의로 표시하지 않습니다.', 'amber') +
      '<div class="card v-card v-space"><div class="v-tabs" role="tablist" aria-label="정책 목록 종류"><button type="button" role="tab" data-policy-view="recommended" aria-selected="' + (state.policyView === 'recommended') + '" class="' + (state.policyView === 'recommended' ? 'active' : '') + '">오늘의 추천공고</button><button type="button" role="tab" data-policy-view="all" aria-selected="' + (state.policyView === 'all') + '" class="' + (state.policyView === 'all' ? 'active' : '') + '">전체 리스트</button></div>' +
      '<div class="v-row v-space"><input class="v-search" id="policySearch" type="search" placeholder="공고 제목 검색" aria-label="공고 제목 검색" value="' + esc(state.keyword) + '"><select class="v-select" id="policyCategory" aria-label="지원 분야"><option value="all">전체 분야</option><option value="금융"' + (state.category === '금융' ? ' selected' : '') + '>금융</option><option value="창업"' + (state.category === '창업' ? ' selected' : '') + '>창업</option></select></div>' +
      '<p class="v-metadata v-space">수집 계획: 금융·창업 분야 + 제목에 소상공인/골목/전통시장 포함. 현재는 실제 수집 없이 예시 순서로 표시합니다. 추천은 불일치 예시를 제외한 목록이며, 미확인 조건이 남아 있을 수 있습니다.</p></div>' +
      '<div id="policyResults" class="v-space">' + policyResults() + '</div>';
  }
  const reportPrompts = ['매출과 지출을 함께 분석해 주세요.', '시간대별 운영 전략을 정리해 주세요.', '회복 플랜을 요약해 주세요.'];
  function secretary() {
    return '<div class="v-grid2" style="margin-top:0"><article class="card v-card"><div class="v-row v-between"><h2>' + esc(state.profile.name) + '님의 AI 비서</h2>' + badge('규칙 기반 시안', 'neutral') +
      '</div><p class="v-subtitle">질문에 맞춰 생성 데이터를 분석하고 PDF 요약본으로 정리합니다.</p><div class="v-row v-space">' +
      reportPrompts.map(q => button(esc(q), 'data-report-question="' + esc(q) + '"')).join('') + '</div><div class="v-report-chat" id="reportMessages" aria-live="polite">' +
      (state.reportMessages.length ? state.reportMessages.map(m => '<div class="ai-message ' + m.type + '">' + esc(m.text) + '</div>').join('') :
        '<div class="ai-message bot">어떤 부분을 살펴볼까요?\n매출·지출, 시간대, 회복 플랜에 관해 질문해 주세요.\n외부 AI 대신 현재 생성 데이터를 읽는 규칙 기반 분석입니다.</div>') +
      '</div><form class="v-compose" id="reportForm"><textarea id="reportInput" maxlength="500" required placeholder="예: 지출을 줄이려면 무엇부터 확인해야 하나요?" aria-label="AI 비서 분석 질문"></textarea><button class="v-button primary" type="submit">분석하기</button></form>' +
      '<div id="reportResult"' + (state.reportReady ? '' : ' hidden') + ' class="v-report-result"><h3>분석 내용이 준비되었습니다.</h3><p class="v-subtitle">근거·실행 제안·제한 사항을 한 장으로 정리합니다.</p>' +
      button(state.pdfBusy ? '요약본 생성 중…' : '최종 요약 PDF 만들기', 'data-action="make-pdf" id="makePdfButton"' + (state.pdfBusy ? ' disabled' : ''), true) +
      '<div id="pdfDownload"' + (state.reportBlobUrl ? '' : ' hidden') + '><p class="v-subtitle">최종 요약본 분석이 완료되었습니다.</p><a class="v-download" id="pdfLink"' +
      (state.reportBlobUrl ? ' href="' + state.reportBlobUrl + '"' : '') + ' download="iM파트너_분석요약.pdf">iM파트너_분석요약.pdf 다운로드</a></div></div></article>' +
      '<div class="v-stack">' + card(head('iM챗봇과 이렇게 달라요') + '<div class="v-list"><div><h3>iM챗봇</h3><p class="v-subtitle">어느 탭에서든 짧은 데이터 질문에 답합니다.</p></div><div><h3>AI 비서</h3><p class="v-subtitle">분석을 요청하고 최종 요약본을 PDF로 보관합니다.</p></div></div>') +
      card(head('이번 분석의 기준') + '<p class="v-subtitle">' + esc(state.profile.region) + ' · ' + esc(state.profile.industry) + '<br>' + state.period.start + ' ~ ' + state.period.end + '</p><div class="v-space">' +
      badge('생성 데이터') + '</div><p class="v-metadata v-space">실제 AI·DB 미연결<br>상담원 연결 채널은 아직 정해지지 않았습니다.</p>') + '</div></div>';
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
  function render() {
    const dashboardView = state.view === 'dashboard';
    $('#mainContent').classList.toggle('dashboard-view', dashboardView);
    $('#pageHeading').hidden = dashboardView;
    $('#dataNotice').hidden = dashboardView;
    $('#pageTitle').textContent = captions[state.view];
    $('#viewEyebrow').textContent = views[state.view];
    $('#pageContext').textContent = state.profile.name + '님 · ' + state.profile.region + ' · ' + state.profile.industry;
    $('#periodContext').textContent = state.period.start + ' ~ ' + state.period.end + ' · ' + state.period.comparison;
    $('#profileName').textContent = state.profile.name;
    $('#profileInitials').textContent = state.profile.name.slice(0, 2);
    $('#storeContext').textContent = state.profile.storeName + ' · ' + state.profile.industry;
    $('#aiContext').textContent = state.profile.storeName + ' 생성 자료 · ' + state.period.start + '~' + state.period.end;
    document.querySelectorAll('[data-view]').forEach(el => { el.classList.toggle('active', el.dataset.view === state.view); if (el.classList.contains('nav-item')) { if (el.dataset.view === state.view) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); } });
    const renders = { dashboard, market, finance, recovery, policies, secretary, profile };
    $('#viewRoot').innerHTML = renders[state.view]() + sourceFoot;
    $('#periodSelect').value = state.periodMode;
    $('#customPeriod').hidden = dashboardView || state.periodMode !== 'custom';
    if ($('#dashboardPeriodSelect')) $('#dashboardPeriodSelect').value = state.periodMode;
    if ($('#dashboardCustomPeriod')) $('#dashboardCustomPeriod').hidden = state.periodMode !== 'custom';
    updateBanner();
  }
  function navigate(view) {
    if (!views[view]) return;
    state.view = view; render();
    $('#sidebar').classList.remove('open'); $('#navBackdrop').classList.remove('visible');
    $('#menuButton').setAttribute('aria-expanded', 'false');
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    window.scrollTo({ top: 0, behavior: 'auto' });
    (state.view === 'dashboard' ? $('#bannerTitle') : $('#pageTitle')).focus({ preventScroll: true });
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
    if (/(날씨|뉴스|행사|축제|캘린더|달력)/.test(question)) return { known: true, text: '현재 날씨·뉴스·행사 일정은 연결 전입니다. 대시보드와 회복 플랜에서 예정 영역을 확인할 수 있습니다.\n실제 일정이나 추천 상품을 임의로 안내하지 않습니다.' };
    if (/(정책|지원|공고)/.test(question)) return { known: true, text: '근거: 현재는 실제 공고 대신 화면 구성용 예시만 있습니다.\n확인: 지역·업종·직원 수·나이 조건을 구분합니다. 적합도 % 산식은 미정입니다.\n행동: 정책·지원사업 탭에서 예시 조건을 확인하세요. 실제 신청 자격은 확정할 수 없습니다.' };
    if (/(고객|직장|연령|나이)/.test(question)) return { known: true, text: '근거: 연령대·직장인 비중 자료는 연결되지 않았습니다.\n해석: 특정 고객층을 추천할 근거가 부족합니다.\n행동: 방문·소비 고객층 자료를 확보한 뒤 메뉴와 홍보 대상을 정하세요.' };
    if (/(CCTV|통행|체류|입장|유입|구매전환|객단가|전환율)/i.test(question)) return { known: true, text: '근거: ' + recoveryData.analysisDate + ' ' + r.label + ' 생성 집계에서 통행자 ' + number(r.passersby) + '명, 입장객 ' + number(r.entrants) + '명, 유효 결제 ' + number(r.validPayments) + '건입니다.\n해석: 매장 유입률은 ' + ratioText(r.entryRate) + ', 추정 구매전환율은 ' + ratioText(r.estimatedPurchaseRate) + '로 통행→입장 구간을 먼저 살펴볼 요인 후보입니다.\n행동: 17시 30분부터 대표 메뉴와 가격을 노출하고 7일 후 같은 조건을 비교하세요. 실제 CCTV·POS가 아닌 생성 시나리오입니다.' };
    if (/(현금|자금|잔액|대출|금융|체온)/.test(question)) return { known: true, text: '근거: 매출 ' + money(analysis.sales) + ', 지출 ' + money(analysis.expense) + '입니다.\n해석: 이 차이는 현재 현금이나 영업이익이 아닙니다. 체온계 점수·금융 효과 산식은 미정입니다.\n행동: 보유 현금, 정산일, 예정 출금을 확인하세요. 대출 심사·신청은 제공하지 않습니다.' };
    if (/(지출|매입|비용|재고|발주|남는|돈)/.test(question)) return { known: true, text: '근거: ' + costText() + '\n행동: 매입금액 상위 품목의 재고·폐기를 먼저 확인하세요. 재고와 메뉴 대응이 없어 발주 수량은 계산하지 않습니다.' };
    if (/(시간|언제|요일|준비)/.test(question)) return { known: true, text: '근거: 최근 완료된 CCTV·POS 생성 시나리오에서 ' + r.label + ' 통행자는 ' + number(r.passersby) + '명, 매장 유입률은 ' + ratioText(r.entryRate) + '입니다.\n해석: 이 시간대는 자동 산식이 아닌 기능 검토용 매출 기회 후보입니다.\n행동: 17시 30분부터 대표 메뉴 노출과 혜택 안내를 준비하고 같은 요일·시간대를 7일 뒤 비교하세요.' };
    if (/(행동|실행|플랜|회복|방법)/.test(question)) return { known: true, text: '근거: ' + r.label + ' 통행자 ' + number(r.passersby) + '명 중 입장객은 ' + number(r.entrants) + '명으로 유입률은 ' + ratioText(r.entryRate) + '입니다.\n해석: 통행→입장 구간의 외부 주목도를 먼저 점검할 요인 후보입니다.\n행동: 17시 30분 대표 메뉴 입간판과 18~20시 2인 세트 안내를 실행한 뒤 7일 후 유입률·결제·순매출을 비교하세요. 할인율과 효과 수치는 정해진 값이 없습니다.' };
    if (/(매출|왜|떨어|변화|소비|유동|상권)/.test(question)) return { known: true, text: '근거: ' + causeText() + '\n해석: 실제 관측이 아닌 생성 자료이며, 매출 변화의 확정 원인은 아닙니다.\n행동: ' + analysis.action };
    return { known: false, text: '현재 데이터로는 답변하기 어렵습니다. 매출·지출, 시간대, 회복 플랜, 정책 조건에 관해 간단히 질문해 주세요.\n상담원과 연결 채널은 아직 미정이어서 지금 연결해 드릴 수 없습니다.' };
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
      title: '소상공인 뉴스·이슈,\n영업 준비와 연결해드려요.',
      text: '확인된 출처와 게시일을 바탕으로 가게 운영에 필요한 변화만 간결하게 안내할 예정입니다.',
      action: '브리핑 자세히 보기 →', theme: 'news', image: './assets/dashboard-banners/briefing-market.png'
    },
    {
      kicker: '가게 주변 행사와 날씨',
      title: '가게 주변 행사와 날씨,\n미리 준비할 수 있도록.',
      text: '실시간 자료가 연결되면 행사 일정과 날씨 변화를 영업·배달·재료 준비와 함께 안내합니다.',
      action: '연결 예정 정보 보기 →', theme: 'weather', image: './assets/dashboard-banners/briefing-weather.png'
    },
    {
      kicker: '업종별 대목 준비',
      title: '장사가 잘되는 시기,\n일주일 먼저 준비하세요.',
      text: '확인된 행사·절기 자료를 바탕으로 판매상품과 재고 준비 시점을 안내할 예정입니다.',
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
  document.addEventListener('click', event => {
    const el = event.target.closest('button, a'); if (!el) return;
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
    if (event.target.id === 'chatWidth') document.documentElement.style.setProperty('--chat-width', event.target.value + 'px');
  });
  document.addEventListener('change', event => {
    const el = event.target;
    if (el.id === 'policyCategory') { state.category = el.value; state.offset = 0; $('#policyResults').innerHTML = policyResults(); }
    if (el.id === 'guideHour') $('#guidanceContent').innerHTML = guidanceContent(Number(el.value));
    if (el.id === 'mapRadius') { state.radius = Math.max(100, Math.min(1000, Number(el.value) || 500)); el.value = state.radius; $('#mapPreview').innerHTML = mapPreview(); }
    if (el.id === 'periodSelect' || el.id === 'dashboardPeriodSelect') {
      state.periodMode = el.value;
      $('#periodSelect').value = state.periodMode;
      $('#customPeriod').hidden = state.view === 'dashboard' || state.periodMode !== 'custom';
      if ($('#dashboardPeriodSelect')) $('#dashboardPeriodSelect').value = state.periodMode;
      if ($('#dashboardCustomPeriod')) $('#dashboardCustomPeriod').hidden = state.periodMode !== 'custom';
      if (el.value !== 'custom') { state.period = Object.assign({}, D.periods[el.value]); analysis = D.analyze(state.period); invalidateReport(); render(); }
    }
  });
  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.id === 'aiForm') { event.preventDefault(); ask($('#aiInput').value); }
    if (form.id === 'reportForm') { event.preventDefault(); askReport($('#reportInput').value); }
    if (form.id === 'customPeriod' || form.id === 'dashboardCustomPeriod') {
      event.preventDefault();
      const dashboardForm = form.id === 'dashboardCustomPeriod';
      const p = D.customPeriod($(dashboardForm ? '#dashboardPeriodStart' : '#periodStart').value, $(dashboardForm ? '#dashboardPeriodEnd' : '#periodEnd').value);
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
  $('#aiToggle').addEventListener('click', () => setChat(!state.chatOpen));
  $('#aiClose').addEventListener('click', () => setChat(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { if (state.chatOpen) setChat(false); $('#sidebar').classList.remove('open'); $('#navBackdrop').classList.remove('visible'); $('#menuButton').setAttribute('aria-expanded', 'false'); } });
  $('#chatResizeHandle').addEventListener('pointerdown', event => {
    const handle = event.currentTarget; handle.setPointerCapture(event.pointerId);
    const startX = event.clientX, startWidth = $('#aiPanel').getBoundingClientRect().width;
    const move = e => { const width = Math.round(Math.max(320, Math.min(560, startWidth + startX - e.clientX))); $('#chatWidth').value = width; document.documentElement.style.setProperty('--chat-width', width + 'px'); };
    const stop = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', stop); handle.removeEventListener('pointercancel', stop); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', stop); handle.addEventListener('pointercancel', stop);
  });
  setInterval(() => { if (!state.bannerPaused && !document.hidden && state.view === 'dashboard' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) { state.bannerIndex = (state.bannerIndex + 1) % banners.length; updateBanner(); } }, 8000);
  window.addEventListener('hashchange', () => { const view = location.hash.slice(1); if (views[view]) navigate(view); });
  state.view = views[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard';
  render();
})();
