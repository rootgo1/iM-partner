/* Non-browser regression checks. Run with Node; set IM_PREVIEW_DEPS for optional PDF QA. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const D = require('../meeting-data.js');
const sum = (rows, key) => rows.reduce((n, r) => n + r[key], 0);
let passed = 0;
function check(name, fn) { fn(); console.log('PASS ' + name); passed++; }
const html = fs.readFileSync(path.join(root, 'main-screen.html'), 'utf8');
const code = fs.readFileSync(path.join(root, 'meeting-ui.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'meeting-preview.css'), 'utf8');
const smoothCode = fs.readFileSync(path.join(root, 'smooth-scroll.js'), 'utf8');
check('Local assets exist and no external script/style dependency', () => {
  for (const m of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)) assert.ok(fs.existsSync(path.resolve(root, m[1])), m[1]);
  assert.ok(!/<(?:script|link)[^>]+(?:src|href)="https?:/i.test(html));
  assert.equal((html.match(/id="([^"]+)"/g) || []).length, new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1])).size);
  assert.match(html, /<a class="topbar-brand" href="#dashboard" data-view="dashboard" aria-label="iM파트너 홈으로 이동">/);
  assert.match(html, /<a class="brand-mark" href="#dashboard" data-view="dashboard" aria-label="iM파트너 메인 페이지로 이동">/);
  assert.equal((html.match(/src="\.\/assets\/brand\/im-bank-symbol\.png"/g) || []).length, 2);
  assert.match(html, /class="topbar-brand-name"><span>iM<\/span><span class="brand-korean">파트너<\/span>/);
  assert.ok(fs.existsSync(path.resolve(root, 'assets/brand/im-bank-symbol.gif')));
  assert.ok(fs.existsSync(path.resolve(root, 'assets/brand/im-bank-symbol.png')));
  assert.ok(fs.existsSync(path.resolve(root, 'assets/brand/im-bank-favicon.ico')));
  for (const asset of ['briefing-market.png', 'briefing-weather.png', 'briefing-season.png']) {
    assert.ok(fs.existsSync(path.resolve(root, 'assets/dashboard-banners', asset)), asset);
  }
  assert.match(html, /<title>iM파트너 - 소상공인 경영·금융 도우미<\/title>/);
  assert.match(html, /<link rel="icon" type="image\/x-icon" href="\.\/assets\/brand\/im-bank-favicon\.ico">/);
  assert.match(html, /id="logoutLink" href="\.\/login-preview\/index\.html\?signed_out=1"/);
  assert.match(html, /id="profileMenuFinanceMount"/);
  assert.match(html, /id="profileMenuTemperatureBadge"[^>]*>51\.9°<\/span>/);
  assert.match(html, /id="profileTemperatureBadge"[^>]*>51\.9°<\/span>/);
  assert.match(code, /window\.location\.replace\(event\.currentTarget\.href\)/);
  assert.ok(!html.includes('class="toggle-label"'));
  assert.match(html, /<span class="toggle-icon" aria-hidden="true"><\/span>/);
  assert.ok(!code.includes("toggle-icon').textContent"));
  assert.ok(!code.includes('v-screen-count'));
  assert.ok(!css.includes('.v-screen-count'));
  assert.match(css, /\.v-decision-action > \.v-guidance-time \{ z-index: 10; \}/);
  assert.ok(!html.includes('class="top-nav"'));
  assert.ok(!html.includes('class="data-chip"'));
  assert.match(html, /<div class="demo-label">생성 데이터 기반 시연/);
  assert.ok(!html.includes('iM 파트너'));
  assert.ok(html.includes('iM챗봇'));
  assert.ok(!code.includes("addEventListener('wheel'"));
  assert.ok(!code.includes('handleSectionWheel'));
  assert.match(html, /vendor\/lenis\/lenis\.min\.js/);
  assert.ok(!html.includes('lenis-snap.min.js'));
  assert.match(html, /smooth-scroll\.js/);
  assert.match(smoothCode, /lerp: 0\.18/);
  assert.match(smoothCode, /INPUT_QUIET_TIME = 120/);
  assert.match(smoothCode, /SECTION_COMMIT_RATIO = 0\.38/);
  assert.match(smoothCode, /data-scroll-mode/);
  assert.ok(!smoothCode.includes('new window.Snap'));
  assert.match(smoothCode, /prefers-reduced-motion: no-preference/);
  assert.ok(fs.existsSync(path.resolve(root, 'vendor/lenis/LICENSE')));
});
for (const [label, p] of Object.entries(D.periods)) check(label + ': POS, costs, daily chart and categories reconcile', () => {
  const a = D.analyze(p);
  assert.equal(a.sales, sum(a.pos, 'netAmount'));
  assert.equal(a.sales, sum(a.daily, 'sales'));
  assert.equal(a.expense, sum(a.daily, 'expense'));
  assert.equal(a.expense, sum(a.byCategory, 'amount'));
  assert.equal(a.byCategory.find(c => c.id === 'purchase').amount, sum(a.topPurchases, 'amount'));
  assert.equal(a.delta, a.sales - a.expense);
  assert.equal(a.soldUnits, sum(a.pos, 'netQuantity'));
  assert.equal(a.focus.label, '12~14시');
  assert.ok(a.pos.every(r => r.netAmount === r.netQuantity * r.unitPrice));
  assert.ok(a.slots.every(r => r.trafficIndex >= 0 && r.trafficIndex <= 100 && r.cardIndex >= 0 && r.cardIndex <= 100));
});
check('Date validation, short periods and missing comparison', () => {
  for (const [start, end] of [['2026-08-32', '2026-09-02'], ['2026-08-11', '2026-08-01'], ['2026-06-30', '2026-07-10'], ['2026-08-01', '2026-09-03'], ['', '']]) assert.equal(D.customPeriod(start, end), null);
  const a = D.analyze(D.customPeriod('2026-07-01', '2026-07-01'));
  assert.equal(a.daily.length, 1); assert.equal(a.comparisonAvailable, false); assert.equal(a.salesRate, null);
  assert.equal(D.analyze(D.customPeriod('2026-08-01', '2026-08-01')).comparisonAvailable, true);
  assert.equal(D.guidance(2).average, null); assert.ok(D.guidance(14).average > 0);
});
check('Generated policies and undefined metrics remain explicit', () => {
  assert.equal(D.policies.length, 10);
  assert.ok(D.policies.every(p => p.sourceType === 'synthetic_demo' && p.score === null));
  assert.ok(!code.includes('650000')); assert.ok(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage/.test(code));
});
check('CCTV and POS recovery scenario reconciles without invented outcomes', () => {
  const r = D.analyzeRecovery();
  assert.equal(r.sourceType, 'synthetic_demo');
  assert.equal(r.opportunity.label, '18~20시');
  assert.equal(r.opportunity.passersby, 310);
  assert.equal(r.opportunity.entrants, 21);
  assert.equal(r.opportunity.validPayments, 14);
  assert.equal(r.opportunity.netSales, 286000);
  assert.equal(r.opportunity.entryRate.toFixed(1), '6.8');
  assert.equal(r.opportunity.estimatedPurchaseRate.toFixed(1), '66.7');
  assert.equal(Math.round(r.opportunity.averageTicket), 20429);
  assert.ok(r.slots.every(row => row.passersby >= row.dwellers && row.dwellers >= row.entrants && row.entrants >= row.validPayments));
  assert.equal(r.opportunitySelection.ruleVersion, null);
  assert.equal(r.comparison.status, 'waiting');
  assert.equal(r.comparison.followUpMetrics, null);
});
// A deliberately small DOM contract stub: tests logic/markup, not actual browser layout.
const nodes = new Map(), listeners = {}, buttons = [];
function classes(owner) {
  return {
    contains: v => owner.className.split(/\s+/).includes(v),
    add: v => { if (!owner.classList.contains(v)) owner.className += ' ' + v; },
    remove: v => { owner.className = owner.className.split(/\s+/).filter(c => c !== v).join(' '); },
    toggle: (v, force) => { const next = force === undefined ? !owner.classList.contains(v) : force; next ? owner.classList.add(v) : owner.classList.remove(v); return next; }
  };
}
class Element {
  constructor(id) { this.id = id || ''; this.className = ''; this.classList = classes(this); this.dataset = {}; this.attrs = {}; this.children = []; this.events = {}; this.value = ''; this.hidden = false; this.isConnected = true; this.style = { setProperty: (k, v) => { this.style[k] = v; } }; }
  set innerHTML(text) { this.markup = text; parse(text); }
  get innerHTML() { return this.markup || ''; }
  set textContent(text) { this.text = String(text); this.children = []; }
  get textContent() { return this.text || this.children.map(c => c.textContent).join('\n'); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(k, fn) { this.events[k] = fn; }
  removeEventListener(k) { delete this.events[k]; }
  focus() { document.activeElement = this; }
  append(e) { e.parent = this; this.children.push(e); }
  remove() { this.parent.children = this.parent.children.filter(e => e !== this); this.isConnected = false; }
  replaceChildren() { this.children = []; }
  get firstElementChild() { return this.children[0]; }
  get childElementCount() { return this.children.length; }
  get scrollHeight() { return this.children.length * 70; }
  closest() { return this; }
  getBoundingClientRect() { return { width: 380 }; }
  setPointerCapture() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
}
function parse(text) {
  for (const tag of text.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const attrs = Object.fromEntries([...tag[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    if (!attrs.id && tag[1] !== 'button') continue;
    const e = new Element(attrs.id); e.attrs = attrs; e.className = attrs.class || ''; e.value = attrs.value || ''; e.href = attrs.href;
    for (const [k, v] of Object.entries(attrs)) if (k.startsWith('data-')) e.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
    if (attrs.id) nodes.set(attrs.id, e);
    if (tag[1] === 'button') buttons.push(e);
  }
}
parse(html);
const shell = new Element(); shell.className = 'app-shell';
const toggleIcon = new Element();
const document = {
  hidden: true, activeElement: null,
  querySelector: s => s === '.app-shell' ? shell : s === '#sidebarToggle .toggle-icon' ? toggleIcon : nodes.get(s.slice(1)) || null,
  querySelectorAll: () => buttons.filter(e => e.dataset.view),
  getElementById: id => nodes.get(id),
  addEventListener: (name, fn) => { listeners[name] = fn; },
  createElement: () => new Element(), documentElement: new Element()
};
const location = { hash: '' };
let replacedUrl = '';
let pendingPdf;
const context = {
  window: { IM_MEETING_DEMO: D, IM_REPORT_PDF: { generate: () => new Promise(resolve => { pendingPdf = resolve; }) }, location: { replace: url => { replacedUrl = url; } }, scrollTo() {}, addEventListener() {}, matchMedia: () => ({ matches: false }), innerWidth: 1440 },
  document, location, history: { replaceState: (_, __, hash) => { location.hash = hash; } },
  Intl, Date, console, setInterval() {}, setTimeout() { return 1; }, clearTimeout() {},
  URL: { createObjectURL: () => 'blob:test-report', revokeObjectURL() {} },
  FormData: class { constructor(form) { this.data = form.values || {}; } get(k) { return this.data[k] ?? null; } has(k) { return k in this.data; } }
};
function click(dataset) { const e = new Element(); e.dataset = dataset; listeners.click({ target: e }); }
function change(id, value) { nodes.get(id).value = value; listeners.change({ target: nodes.get(id) }); }
function submit(id, values) { const form = nodes.get(id); form.values = values; listeners.submit({ target: form, preventDefault() {} }); }
vm.runInNewContext(code, context, { filename: 'meeting-ui.js' });
check('Initial render and the consolidated navigation targets', () => {
  assert.ok(nodes.get('viewRoot').innerHTML.includes('2,550.2'));
  assert.ok(nodes.get('viewRoot').innerHTML.includes('<span class="trend-caution">▲ 7.2% 증가</span>'));
  assert.ok(nodes.get('viewRoot').innerHTML.includes('class="v-signal-context"'));
  assert.ok(nodes.get('viewRoot').innerHTML.includes('class="v-recovery-signal-followup"'));
  assert.ok(nodes.get('viewRoot').innerHTML.includes('id="guideHourButton"'));
  assert.ok(nodes.get('viewRoot').innerHTML.includes('id="guideHourMenu"'));
  assert.ok(!nodes.get('viewRoot').innerHTML.includes('id="guideHour"'));
  click({ guideHour: '8' });
  assert.match(nodes.get('guidanceContent').innerHTML, /오전 운영 · 08:00/);
  assert.equal(nodes.get('pageHeading').hidden, true);
  assert.equal(nodes.get('dataNotice').hidden, true);
  assert.ok(!nodes.get('viewRoot').innerHTML.includes('id="dashboardPeriodSelect"'));
  assert.equal(nodes.get('profileInitials').textContent, '소현');
  assert.equal(nodes.get('profileMenuInitials').textContent, '소현');
  assert.equal(nodes.get('profileMenuTemperatureBadge').textContent, '51.9°');
  assert.equal(nodes.get('profileTemperatureBadge').textContent, '51.9°');
  assert.match(nodes.get('profileMenuButton').attrs['aria-label'], /나의 금융 온도 51\.9도/);
  assert.match(nodes.get('mainNavigation').innerHTML, />홈</);
  assert.match(nodes.get('mainNavigation').innerHTML, />매출진단</);
  assert.match(nodes.get('mainNavigation').innerHTML, />회복전략</);
  assert.match(nodes.get('mainNavigation').innerHTML, />지원사업</);
  assert.match(nodes.get('mainNavigation').innerHTML, /aria-label="iM비서"/);
  assert.match(nodes.get('mainNavigation').innerHTML, /class="im-product-name"/);
  assert.ok(!nodes.get('mainNavigation').innerHTML.includes('상권·시간 분석'));
  assert.ok(!nodes.get('mainNavigation').innerHTML.includes('매출·지출 분석'));
  for (const view of ['dashboard', 'analysis', 'recovery', 'policies', 'secretary', 'profile']) {
    click({ view }); assert.equal(location.hash, '#' + view); assert.ok(nodes.get('viewRoot').innerHTML.length > 100);
  }
  click({ view: 'analysis' });
  assert.ok(nodes.get('viewRoot').innerHTML.includes('class="v-finance-summary"'));
  assert.ok(nodes.get('viewRoot').innerHTML.includes('class="v-connection-grid"'));
  assert.ok(nodes.get('viewRoot').innerHTML.includes('시간대별 소비 흐름'));
  click({ view: 'market' });
  assert.equal(location.hash, '#analysis');
  click({ view: 'policies' });
  assert.ok(nodes.get('viewRoot').innerHTML.includes('class="v-policy-criteria"'));
  assert.equal(nodes.get('pageHeading').hidden, true);
  assert.equal(nodes.get('dataNotice').hidden, true);
});
check('Finance thermometer uses the declared partial formula without calling it comprehensive', () => {
  click({ view: 'dashboard' });
  const markup = nodes.get('viewRoot').innerHTML;
  assert.match(markup, /class="v-finance-thermometer"/);
  assert.match(markup, /style="--v-thermo-level:51\.9%"/);
  assert.match(markup, /나의 금융 체온계/);
  assert.match(markup, /연결 데이터 2\/4/);
  assert.match(markup, /데이터 연결도/);
  assert.match(markup, /매출·지출 기반 참고 온도/);
  assert.match(markup, /나의 금융 온도<br><strong>51\.9°/);
  assert.match(markup, /직전 기간 60\.7도에서 현재 51\.9도로 변화/);
  assert.match(markup, /전월보다 8\.8° 낮음/);
  assert.match(markup, /현금잔액/);
  assert.match(markup, /예정 입출금/);
  assert.match(markup, /\(참고용 지표\)<\/span><span>신용평가·대출심사 결과와는 무관합니다\./);
  assert.ok(!markup.includes('영업이익률이나 현금잔액을 뜻하지 않습니다'));
  assert.ok(!markup.includes('—°'));
  assert.ok(!markup.includes('role="progressbar"'));
});
check('Profile avatar shows the given name for common Korean name lengths', () => {
  const base = { storeName: '서문시장 음식점', region: '대구 중구', industry: '음식점', employees: '3' };
  click({ view: 'profile' }); submit('profileForm', Object.assign({ name: '황보민지' }, base));
  assert.equal(nodes.get('profileInitials').textContent, '민지');
  assert.equal(nodes.get('profileMenuInitials').textContent, '민지');
  click({ view: 'profile' }); submit('profileForm', Object.assign({ name: '고수' }, base));
  assert.equal(nodes.get('profileInitials').textContent, '수');
  assert.equal(nodes.get('profileMenuInitials').textContent, '수');
  click({ view: 'profile' }); submit('profileForm', Object.assign({ name: '이소현' }, base));
});
check('Chatbot answers follow period changes and do not invent absent data', () => {
  click({ question: '현재 매출이 왜 떨어졌나요?' });
  assert.ok(nodes.get('aiMessages').textContent.includes('-12.4%'));
  assert.ok(nodes.get('aiMessages').textContent.includes('-7.6%'));
  change('periodSelect', 'week');
  click({ question: '현재 매출이 왜 떨어졌나요?' });
  assert.ok(nodes.get('aiMessages').textContent.includes('+0.1%'));
  assert.ok(!nodes.get('aiMessages').textContent.includes('-12.4%'));
  click({ question: '어떤 고객층을 노려야 하나요?' });
  assert.ok(nodes.get('aiMessages').textContent.includes('근거가 부족'));
  click({ question: '양자컴퓨터 알려주세요' });
  assert.ok(nodes.get('aiMessages').textContent.includes('연결 채널은 아직 미정'));
  assert.equal(nodes.get('aiPanel').inert, false);
});
check('Report prompts, sidebar, chat controls, calendar and policy modal', () => {
  click({ view: 'secretary' }); click({ reportQuestion: '매출과 지출을 분석해 주세요.' });
  assert.ok(nodes.get('viewRoot').innerHTML.includes('5,730,500원'));
  assert.ok(!nodes.get('viewRoot').innerHTML.includes('id="reportResult" hidden'));
  nodes.get('sidebarToggle').events.click(); assert.ok(shell.classList.contains('sidebar-collapsed'));
  nodes.get('logoutLink').events.click({ preventDefault() {}, currentTarget: nodes.get('logoutLink') }); assert.equal(replacedUrl, './login-preview/index.html?signed_out=1');
  nodes.get('aiClose').events.click(); assert.equal(nodes.get('aiPanel').inert, true);
  click({ view: 'policies' }); click({ policy: '1' }); assert.equal(nodes.get('policyModal').open, true);
  click({ action: 'close-modal' }); assert.equal(nodes.get('policyModal').open, false);
  click({ view: 'dashboard' }); assert.ok(nodes.get('bannerTitle').textContent.includes('뉴스'));
  click({ action: 'banner-next' }); assert.ok(nodes.get('bannerTitle').textContent.includes('행사'));
});
check('Recovery funnel, definitions, action state and chatbot share one source', () => {
  click({ view: 'recovery' });
  assert.ok(nodes.get('viewRoot').innerHTML.includes('통행자는 <b>310명</b>'));
  assert.ok(nodes.get('viewRoot').innerHTML.includes('매장 유입률이 <b>6.8%</b>'));
  assert.ok(nodes.get('viewRoot').innerHTML.includes('유효 결제'));
  assert.ok(nodes.get('viewRoot').innerHTML.includes('데이터 집계 대기'));
  click({ action: 'show-recovery-definitions' }); assert.equal(nodes.get('recoveryMetricModal').open, true);
  click({ action: 'close-recovery-definitions' }); assert.equal(nodes.get('recoveryMetricModal').open, false);
  click({ action: 'start-recovery' });
  assert.ok(nodes.get('viewRoot').innerHTML.includes('실행 기록 시안 진행 중'));
  assert.ok(nodes.get('viewRoot').innerHTML.includes('DB에 저장되지 않습니다'));
  click({ question: 'CCTV 유입률과 구매전환율을 알려주세요' });
  assert.ok(nodes.get('aiMessages').textContent.includes('통행자 310명'));
  assert.ok(nodes.get('aiMessages').textContent.includes('추정 구매전환율은 66.7%'));
});
check('Profile strings are escaped and region mismatch is excluded', () => {
  click({ view: 'profile' });
  submit('profileForm', { name: '<img src=x onerror=alert(1)>', storeName: '테스트', region: '부산', industry: '음식점', employees: '3' });
  click({ view: 'secretary' }); assert.ok(!nodes.get('viewRoot').innerHTML.includes('<img'));
  assert.ok(nodes.get('viewRoot').innerHTML.includes('&lt;img'));
  click({ view: 'policies' }); assert.ok(nodes.get('viewRoot').innerHTML.includes('조건에 맞는 예시가 없습니다'));
  click({ view: 'dashboard' });
  assert.match(nodes.get('viewRoot').innerHTML, /data-status="unavailable"/);
  assert.match(nodes.get('viewRoot').innerHTML, /연결 데이터 0\/4/);
  assert.match(nodes.get('viewRoot').innerHTML, /나의 금융 온도<br><strong>측정 전/);
  assert.equal(nodes.get('profileMenuTemperatureBadge').textContent, '측정 전');
  assert.equal(nodes.get('profileTemperatureBadge').textContent, '측정 전');
});
async function asyncChecks() {
  click({ view: 'secretary' }); click({ reportQuestion: '회복전략을 요약해 주세요.' });
  click({ action: 'make-pdf' }); const stale = pendingPdf;
  change('periodSelect', 'month'); stale({}); await new Promise(resolve => setImmediate(resolve));
  assert.equal(nodes.get('pdfLink').attrs.href, undefined);
  console.log('PASS Stale PDF is discarded after analysis conditions change'); passed++;
  click({ reportQuestion: '시간대별 운영 전략을 정리해 주세요.' });
  click({ action: 'make-pdf' }); pendingPdf({}); await new Promise(resolve => setImmediate(resolve));
  assert.equal(nodes.get('pdfLink').href, 'blob:test-report');
  assert.equal(nodes.get('pdfDownload').hidden, false);
  console.log('PASS PDF completion enables actual download URL'); passed++;
  if (process.env.IM_PREVIEW_DEPS) await pdfQa();
  console.log('TOTAL ' + passed + ' checks passed (no browser/layout assertions).');
}
async function pdfQa() {
  const deps = process.env.IM_PREVIEW_DEPS;
  const { createCanvas, GlobalFonts } = require(path.join(deps, '@napi-rs/canvas'));
  const { PDFDocument } = require(path.join(deps, 'pdf-lib'));
  const pdfjs = await import(require('node:url').pathToFileURL(path.join(deps, 'pdfjs-dist/legacy/build/pdf.mjs')).href);
  const R = require('../report-pdf.js');
  const fontPath = 'C:/Windows/Fonts/malgun.ttf';
  if (fs.existsSync(fontPath)) GlobalFonts.registerFromPath(fontPath, 'Malgun Gothic');
  const a = D.analyze(D.periods.month);
  const p = a.byCategory.find(r => r.id === 'purchase');
  const canvases = R.renderCanvases({
    profile: D.profile, analysis: a,
    cause: '내 가게 매출 ' + a.salesRate.toFixed(1) + '%, 상권 카드소비 ' + a.cardRate.toFixed(1) + '%, 유동인구 +' + a.trafficRate.toFixed(1) + '%입니다. ' + a.focus.label + ' 상대 지수 차이를 운영 점검의 요인 후보로 살펴보세요.',
    cost: '매입비는 ' + p.amount.toLocaleString('ko-KR') + '원입니다. 매출·지출 차이는 회계상 영업이익이나 현재 현금잔액이 아닙니다.',
    discussion: ['매출과 지출을 함께 분석해 주세요.']
  }, createCanvas);
  const bytes = R.buildPdf(canvases.map(c => c.toBuffer('image/jpeg')), 1240, 1754);
  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), canvases.length);
  assert.equal(parsed.getPage(0).getWidth(), 595.28);
  const out = path.resolve(root, '../tmp/pdfs');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'im-preview-summary.pdf'), bytes);
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    fs.writeFileSync(path.join(out, 'im-preview-summary-' + n + '.png'), canvas.toBuffer('image/png'));
  }
  console.log('PASS Real PDF bytes parsed and rendered: ' + pdf.numPages + ' page(s)'); passed++;
}
asyncChecks().catch(error => { console.error(error); process.exitCode = 1; });
