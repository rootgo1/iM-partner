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
  let bound = false;
  let renderedSource = null;
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
  // Calendar-month totals share the diagnostic's generated receipt rows, without
  // applying its current product, weekday, or hour filters.
  function monthlyComparison(source, previousMonth = '2026-07', currentMonth = '2026-08') {
    if (![previousMonth, currentMonth].every(month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month))) throw new Error('올바른 비교 월이 필요합니다.');
    const rowsByDate = new Map(), transactionsByDate = new Map();
    (source.records || []).forEach(row => {
      if (!rowsByDate.has(row.date)) rowsByDate.set(row.date, []);
      rowsByDate.get(row.date).push(row);
    });
    (source.transactions || []).forEach(row => transactionsByDate.set(row.date, (transactionsByDate.get(row.date) || 0) + 1));
    const coverage = new Map((source.coverage || []).map(row => [row.date, row]));
    function total(month) {
      const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
      const daily = Array.from({length:days}, (_, index) => {
        const date = month + '-' + String(index + 1).padStart(2, '0');
        const rows = rowsByDate.get(date) || [], collected = coverage.get(date);
        const complete = source.coverage ? !!collected && collected.open === true && collected.status === 'valid' &&
          collected.analyzedMinutes === collected.plannedMinutes &&
          (collected.expectedRecords == null || collected.expectedRecords === rows.length) &&
          (!source.transactions || collected.expectedTransactions == null || collected.expectedTransactions === (transactionsByDate.get(date) || 0)) : rows.length > 0;
        return {date, complete, sales:complete ? rows.reduce((value, row) => value + row.netAmount, 0) : null,
          units:complete ? rows.reduce((value, row) => value + row.netQuantity, 0) : null};
      });
      const missing = daily.filter(day => !day.complete).map(day => day.date), complete = missing.length === 0;
      return {month, start:daily[0].date, end:daily[days - 1].date, days, daily, missing, complete,
        sales:complete ? daily.reduce((value, day) => value + day.sales, 0) : null,
        units:complete ? daily.reduce((value, day) => value + day.units, 0) : null};
    }
    const previous = total(previousMonth), current = total(currentMonth), complete = previous.complete && current.complete;
    const maximum = Math.max(previous.sales || 0, current.sales || 0);
    const step = maximum ? 10 ** Math.floor(Math.log10(maximum)) : 1;
    const axisMax = Math.max(step, Math.ceil(maximum / step) * step);
    return {previous, current, complete, axisMax, delta:complete ? current.sales - previous.sales : null,
      rate:complete && previous.sales > 0 ? (current.sales - previous.sales) / previous.sales * 100 : null};
  }
  function render(source) {
    renderedSource = source;
    const records = read();
    const chosen = records.find(r => r.id === selectedId) || records[0];
    selectedId = chosen ? chosen.id : '';
    const result = monthlyComparison(source);
    const direction = result.delta > 0 ? '증가' : result.delta < 0 ? '감소' : '동일';
    const rate = result.rate == null ? (result.complete ? '증감률 계산 불가' : '비교 자료 부족') : (result.rate > 0 ? '+' : '') + result.rate.toFixed(1) + '%';
    const axisLabel = amount => amount === 0 ? '0원' : (amount / 10000).toLocaleString('ko-KR', {maximumFractionDigits:1}) + '만원';
    const bars = [['전전월', result.previous, 'previous'], ['전월', result.current, 'current']].map(([label, month, kind]) => {
      const value = month.complete ? money(month.sales) : '자료 부족';
      return '<div class="v-month-row is-' + kind + '"><div class="v-month-row-head"><div><strong>' + Number(month.month.slice(5, 7)) + '월</strong><span>' + label + ' · ' + month.days + '일 전체</span></div><b>' + value + '</b></div><div class="v-month-track" role="img" aria-label="2026년 ' + Number(month.month.slice(5, 7)) + '월 전체 매출 ' + value + '"><span class="v-month-bar" style="width:' + (month.complete ? month.sales / result.axisMax * 100 : 0).toFixed(4) + '%"></span></div><small>' + month.start.replaceAll('-', '.') + ' ~ ' + month.end.replaceAll('-', '.') + '</small></div>';
    }).join('');
    return '<article class="card v-card v-aftercare v-aftercare-monthly"><header class="v-aftercare-head"><div><span class="v-tag">월간 사후관리</span><h2>월간 매출 비교</h2></div><p class="v-subtitle">전월과 전전월의 한 달 전체 매출을 살펴보세요.</p></header>' +
      '<div class="v-aftercare-monthly-body"><div class="v-month-change"><div><span>7월 대비 8월 매출</span><strong class="' + (result.delta > 0 ? 'is-up' : result.delta < 0 ? 'is-down' : '') + '">' + rate + '</strong></div><p>' + (result.complete ? (result.delta ? money(Math.abs(result.delta)) + ' ' + direction : '매출 변동 없음') : '두 달의 전체 자료가 필요합니다.') + '</p></div>' +
      '<figure class="v-month-chart" aria-labelledby="aftercareChartTitle"><figcaption id="aftercareChartTitle">월별 전체 매출<span>같은 눈금으로 비교</span></figcaption><div class="v-month-bars">' + bars + '</div><div class="v-month-axis" aria-hidden="true"><span>0원</span><span>' + axisLabel(result.axisMax / 2) + '</span><span>' + axisLabel(result.axisMax) + '</span></div></figure></div>' +
      '<div class="v-month-bottom"><p>전체 품목 · 모든 요일 · 전체 영업시간 합산</p>' + (records.length ? '<button type="button" class="v-button" data-aftercare-detail="' + esc(chosen.id) + '" aria-haspopup="dialog">실행 기록 ' + records.length + '개 보기</button>' : '<button type="button" class="v-button" data-view="secretary">회복전략 보기 →</button>') + '</div></article>';
  }
  function renderDetails(record, source = renderedSource, records = []) {
    const result = source ? compare(source, record) : null;
    const picker = records.length > 1 ? '<label class="v-aftercare-select">실행 기록 선택<select id="aftercareSelection">' + records.map(item => '<option value="' + esc(item.id) + '"' + (item.id === record.id ? ' selected' : '') + '>' + esc(item.date + ' · ' + item.startHour + '~' + item.endHour + '시 · 행동 ' + item.actions.length + '개') + '</option>').join('') + '</select></label>' : '';
    const summary = result ? '<section class="v-aftercare-detail-note"><h3>이 실행의 전후 7일 비교</h3><p>실행 전: ' + result.before.start + ' ~ ' + result.before.end + ' · ' + (result.before.complete ? money(result.before.sales) : '자료 부족') + '</p><p>실행 후: ' + result.after.start + ' ~ ' + result.after.end + ' · ' + (result.after.complete ? money(result.after.sales) : '자료 부족') + '</p><p>매출 변화: ' + (result.complete ? money(result.delta) + (result.rate == null ? ' · 증감률 계산 불가' : ' (' + (result.rate > 0 ? '+' : '') + result.rate.toFixed(1) + '%)') : '비교 자료 부족') + '</p></section>' : '';
    return '<div class="v-row v-between"><h2 id="aftercareRecordTitle">실행 기록 상세</h2><button type="button" class="v-button" data-aftercare-close aria-label="실행 기록 상세 닫기" autofocus>닫기</button></div>'+picker+'<p class="v-metadata">'+esc(record.date)+' 실행 · '+record.startHour+'~'+record.endHour+'시 · 행동 '+record.actions.length+'개</p><div class="v-aftercare-detail-actions">'+record.actions.map((action,index)=>'<section class="v-aftercare-detail-action"><h3>'+(index+1)+'. '+esc(action.title)+'</h3><p><strong>근거</strong><br>'+esc(action.evidence || '직접 기록한 운영 점검')+'</p>'+(action.caveat?'<p><strong>해석 범위</strong><br>'+esc(action.caveat)+'</p>':'')+'</section>').join('')+'</div>'+(record.note?'<section class="v-aftercare-detail-note"><h3>실행 메모</h3><p>'+esc(record.note)+'</p></section>':'')+summary+'<section class="v-aftercare-detail-note"><h3>비교·해석 기준</h3><p>이 실행의 비교는 실행일을 제외한 전후 각각 7일, 선택 영업시간의 매장 전체 매출입니다. 기본 화면의 월간 비교와는 기간이 다르며 진단에서 선택한 품목·요일 필터는 적용하지 않습니다.</p><p>여러 행동을 함께 기록한 경우 묶음의 변화이며, 특정 행동의 효과나 인과관계를 입증하지 않습니다. 화면의 금액은 고깃집 시연 자료로 계산하며, 실제 매장 성과가 아닙니다.</p></section><p class="v-metadata">기록은 이 기기의 같은 브라우저에만 보관됩니다. 서버 전송·다른 기기 동기화는 없습니다. 브라우저 사이트 데이터를 지우면 기록도 삭제됩니다.</p>';
  }
  function bind(rerender) {
    if (!root.document || bound) return;
    bound = true;
    const document = root.document;
    let dialog = document.getElementById('aftercareRecordDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'aftercareRecordDialog';
      dialog.className = 'v-modal v-aftercare-dialog';
      dialog.setAttribute('aria-labelledby', 'aftercareRecordTitle');
      document.body.appendChild(dialog);
    }
    document.addEventListener('change', event => {
      if (event.target.id !== 'aftercareSelection') return;
      selectedId = event.target.value;
      const records = read(), record = records.find(item => item.id === selectedId);
      if (record && dialog.open) {
        dialog.innerHTML = renderDetails(record, renderedSource, records);
        dialog.querySelector('#aftercareSelection')?.focus({preventScroll:true});
      } else rerender();
    });
    document.addEventListener('click', event => {
      const trigger = event.target.closest('[data-aftercare-detail]');
      if (trigger) {
        const records = read(), record = records.find(item => item.id === selectedId) || records.find(item => item.id === trigger.dataset.aftercareDetail);
        if (!record) return;
        selectedId = record.id;
        dialog.innerHTML = renderDetails(record, renderedSource, records);
        dialog.showModal();
      }
      if (event.target.closest('[data-aftercare-close]')) dialog.close();
    });
  }
  const api = {KEY, read, save, compare, monthlyComparison, validate, validDate, render, renderDetails, bind};
  root.IM_AFTERCARE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
