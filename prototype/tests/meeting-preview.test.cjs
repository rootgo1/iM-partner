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
check('Local assets exist and no external script/style dependency', () => {
  for (const m of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)) assert.ok(fs.existsSync(path.resolve(root, m[1])), m[1]);
  assert.ok(!/<(?:script|link)[^>]+(?:src|href)="https?:/i.test(html));
  assert.equal((html.match(/id="([^"]+)"/g) || []).length, new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1])).size);
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
    const e = new Element(attrs.id); e.attrs = attrs; e.className = attrs.class || ''; e.value = attrs.value || '';
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
let pendingPdf;
const context = {
  window: { IM_MEETING_DEMO: D, IM_REPORT_PDF: { generate: () => new Promise(resolve => { pendingPdf = resolve; }) }, scrollTo() {}, addEventListener() {}, matchMedia: () => ({ matches: false }), innerWidth: 1440 },
  document, location, history: { replaceState: (_, __, hash) => { location.hash = hash; } },
  Intl, Date, console, setInterval() {}, setTimeout() { return 1; }, clearTimeout() {},
  URL: { createObjectURL: () => 'blob:test-report', revokeObjectURL() {} },
  FormData: class { constructor(form) { this.data = form.values || {}; } get(k) { return this.data[k] ?? null; } has(k) { return k in this.data; } }
};
function click(dataset) { const e = new Element(); e.dataset = dataset; listeners.click({ target: e }); }
function change(id, value) { nodes.get(id).value = value; listeners.change({ target: nodes.get(id) }); }
function submit(id, values) { const form = nodes.get(id); form.values = values; listeners.submit({ target: form, preventDefault() {} }); }
vm.runInNewContext(code, context, { filename: 'meeting-ui.js' });
check('Initial render and all seven navigation targets', () => {
  assert.ok(nodes.get('viewRoot').innerHTML.includes('2,550.2'));
  for (const view of ['dashboard', 'market', 'finance', 'recovery', 'policies', 'secretary', 'profile']) {
    click({ view }); assert.equal(location.hash, '#' + view); assert.ok(nodes.get('viewRoot').innerHTML.length > 100);
  }
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
  nodes.get('aiClose').events.click(); assert.equal(nodes.get('aiPanel').inert, true);
  click({ view: 'policies' }); click({ policy: '1' }); assert.equal(nodes.get('policyModal').open, true);
  click({ action: 'close-modal' }); assert.equal(nodes.get('policyModal').open, false);
  click({ view: 'dashboard' }); assert.ok(nodes.get('bannerTitle').textContent.includes('뉴스'));
  click({ action: 'banner-next' }); assert.ok(nodes.get('bannerTitle').textContent.includes('행사'));
});
check('Profile strings are escaped and region mismatch is excluded', () => {
  click({ view: 'profile' });
  submit('profileForm', { name: '<img src=x onerror=alert(1)>', storeName: '테스트', region: '부산', industry: '음식점', employees: '3' });
  click({ view: 'secretary' }); assert.ok(!nodes.get('viewRoot').innerHTML.includes('<img'));
  assert.ok(nodes.get('viewRoot').innerHTML.includes('&lt;img'));
  click({ view: 'policies' }); assert.ok(nodes.get('viewRoot').innerHTML.includes('조건에 맞는 예시가 없습니다'));
});
async function asyncChecks() {
  click({ view: 'secretary' }); click({ reportQuestion: '회복 플랜을 요약해 주세요.' });
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
