/* Frontend-only execution records. All comparisons use explicitly synthetic POS data. */
(function (root) {
  'use strict';
  const KEY = 'im-partner.aftercare.v1';
  const DAY = 86400000;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shift = (date, offset) => new Date(Date.parse(date + 'T00:00:00Z') + offset * DAY).toISOString().slice(0, 10);
  const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '') && Number.isFinite(Date.parse(date + 'T00:00:00Z')) && new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date;
  const money = n => Math.round(n).toLocaleString('ko-KR') + '원';
  let storageMessage = '';
  let selectedId = '';
  function validate(record) {
    return record && typeof record.id === 'string' && validDate(record.date) && Number.isInteger(record.startHour) && Number.isInteger(record.endHour) && record.startHour >= 17 && record.endHour <= 23 && record.startHour < record.endHour && Array.isArray(record.actions) && record.actions.length > 0 && record.actions.length <= 10 && record.actions.every(a => typeof a.id === 'string' && typeof a.title === 'string' && a.title.length <= 160) && typeof record.note === 'string' && record.note.length <= 500;
  }
  function read(storage) {
    try {
      const raw = (storage || root.localStorage).getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('invalid records');
      const safe = parsed.filter(validate).slice(0, 200);
      if (safe.length !== parsed.length) storageMessage = '읽을 수 없는 시연 기록을 제외했습니다.';
      return safe;
    } catch (_) { storageMessage = '이 브라우저의 저장 기록을 읽을 수 없습니다. 브라우저 저장 허용 상태를 확인해 주세요.'; return []; }
  }
  function save(record, storage) {
    if (!validate(record)) throw new Error('실행일·시간·행동지침을 확인해 주세요.');
    const target = storage || root.localStorage;
    const records = read(target);
    if (records.length >= 200) throw new Error('시연 기록은 최대 200개까지 보관할 수 있습니다.');
    try { target.setItem(KEY, JSON.stringify([record, ...records])); storageMessage = ''; selectedId = record.id; }
    catch (_) { throw new Error('브라우저에 저장하지 못했습니다. 저장 허용 상태와 남은 공간을 확인해 주세요.'); }
    return record;
  }
  function compare(source, record) {
    if (!validate(record)) return null;
    const beforeDates = Array.from({length:7}, (_, i) => shift(record.date, i - 7));
    const afterDates = Array.from({length:7}, (_, i) => shift(record.date, i + 1));
    const counts = new Map();
    source.records.forEach(row => counts.set(row.date, (counts.get(row.date) || 0) + 1));
    const coverage = new Map((source.coverage || []).map(row => [row.date, row]));
    const collected = date => {
      if (!source.coverage) return counts.has(date);
      const row = coverage.get(date);
      return row && row.open === true && row.status === 'valid' && row.analyzedMinutes === row.plannedMinutes &&
        (row.expectedRecords == null || row.expectedRecords === (counts.get(date) || 0));
    };
    function total(dates) {
      const missing = dates.filter(date => !collected(date));
      const rows = source.records.filter(row => dates.includes(row.date) && collected(row.date) && row.hour >= record.startHour && row.hour < record.endHour);
      return {start:dates[0], end:dates[6], days:7, complete:!missing.length, missing, sales:rows.reduce((a,r)=>a+r.netAmount,0), units:rows.reduce((a,r)=>a+r.netQuantity,0)};
    }
    const before = total(beforeDates), after = total(afterDates);
    const complete = before.complete && after.complete;
    return {before, after, complete, delta:complete ? after.sales - before.sales : null, rate:complete && before.sales > 0 ? (after.sales-before.sales)/before.sales*100 : null};
  }
  function render(source) {
    const records = read();
    const chosen = records.find(r => r.id === selectedId) || records[0];
    selectedId = chosen ? chosen.id : '';
    const result = chosen && compare(source, chosen);
    const summary = result ? '<div class="v-aftercare-metrics">' + [ ['실행 전 7일',result.before], ['실행 후 7일',result.after] ].map(([label, value]) => '<article><span>'+label+'</span><strong>'+(value.complete ? money(value.sales) : '자료 부족')+'</strong><small>'+value.start+' ~ '+value.end+'</small><small>판매수량 '+(value.complete ? value.units.toLocaleString('ko-KR')+'개' : '집계 불가')+'</small></article>').join('') + '<article><span>매출 변화</span><strong class="'+(result.delta > 0 ? 'trend-up' : result.delta < 0 ? 'trend-down' : '')+'">'+(result.rate == null ? (result.complete ? '증감률 계산 불가' : '비교 자료 부족') : (result.rate > 0 ? '▲ ' : result.rate < 0 ? '▼ ' : '')+Math.abs(result.rate).toFixed(1)+'%')+'</strong><small>'+(result.complete ? '금액 차이 '+money(result.delta) : '전후 7일의 자료가 모두 필요합니다.')+'</small></article></div>' : '';
    return '<article class="card v-card v-aftercare"><div class="v-row v-between"><div><span class="v-tag">브라우저 시연 기록</span><h1>실행을 기록하고, 변화를 살펴보세요</h1></div><button class="v-button" data-view="secretary">iM비서 행동지침 보기 →</button></div><p class="v-subtitle">직접 수행한 행동을 기록하는 흐름입니다. 아래 금액은 고깃집 시연 자료로 계산하며, 실제 매장 성과가 아닙니다.</p>'+(storageMessage ? '<p class="v-note amber" role="status">'+esc(storageMessage)+'</p>' : '') +
      (records.length ? '<label class="v-aftercare-select">실행 기록 선택<select id="aftercareSelection">'+records.map(record=>'<option value="'+esc(record.id)+'"'+(record.id===selectedId?' selected':'')+'>'+esc(record.date+' · '+record.actions.map(a=>a.title).join(' + '))+'</option>').join('')+'</select></label><div class="v-aftercare-record"><h2>'+esc(chosen.actions.map(a=>a.title).join(' + '))+'</h2><p>'+esc(chosen.date)+' 실행 · '+chosen.startHour+'~'+chosen.endHour+'시 · '+chosen.actions.length+'개 행동 '+(chosen.actions.length>1?'묶음':'')+'</p>'+chosen.actions.map(a=>'<p class="v-metadata">근거: '+esc(a.evidence || '직접 기록한 운영 점검')+'</p>').join('')+(chosen.note?'<p class="v-note">'+esc(chosen.note)+'</p>':'')+'</div>'+summary+'<p class="v-note">실행일은 제외하고 전후 각각 7일, 같은 영업시간을 비교합니다. 요일 구성과 기간 길이는 같습니다. 여러 행동을 함께 기록한 경우 묶음의 변화이며, 특정 행동의 효과나 인과관계를 입증하지 않습니다.</p>' : '<div class="v-aftercare-empty"><h2>아직 기록한 행동이 없습니다</h2><p>iM비서에서 분석한 뒤 행동지침의 ‘실행 기록하기’를 선택하세요.</p><button class="v-button primary" data-view="secretary">행동지침 확인하기 →</button></div>')+
      '<p class="v-metadata">기록은 이 기기의 같은 브라우저에만 보관됩니다. 서버 전송·다른 기기 동기화는 없습니다. 브라우저 사이트 데이터를 지우면 기록도 삭제됩니다.</p></article>';
  }
  function bind(rerender) {
    if (!root.document) return;
    document.addEventListener('change', event => { if (event.target.id === 'aftercareSelection') { selectedId = event.target.value; rerender(); } });
  }
  const api = {KEY, read, save, compare, validate, validDate, render, bind};
  root.IM_AFTERCARE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
