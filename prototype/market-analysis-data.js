/* Ten-minute CCTV aggregates from the same fictional store receipts and entry cohorts. */
(function (root) {
  'use strict';
  const sourceData = root.IM_MEETING_DEMO || (typeof require === 'function' ? require('./meeting-data.js') : null);
  if (!sourceData) throw new Error('공통 고깃집 시연 자료를 먼저 불러와야 합니다.');
  const DAY = 86400000;
  const shift = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
  const weekday = date => new Date(date + 'T00:00:00Z').getUTCDay();
  const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] || 0), 0);
  const ratio = (a, b) => b > 0 && a != null ? a / b * 100 : null;
  const rate = (a, b) => b > 0 && a != null ? (a - b) / b * 100 : null;
  const dateRange = (start, end) => Array.from({ length: Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1) }, (_, index) => shift(start, index));
  const slots = sourceData.timeSlots;
  const timeWindows = [{ id: 'all', label: '전체 시간 · 17~23시', start: 17, end: 23 }, { id: '17-19', label: '17~19시', start: 17, end: 19 }, { id: '19-21', label: '19~21시', start: 19, end: 21 }, { id: '21-23', label: '21~23시', start: 21, end: 23 }];
  function defaultTimeWindow(now = new Date()) {
    const hour = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
    return timeWindows.slice(1).find(window => hour >= window.start && hour < window.end)?.id || 'all';
  }
  const cameras = [{ id: 'front', name: '매장 앞 CCTV', code: 'CAM-01', scope: '가상 고깃집 앞 보행로와 출입구', entry: true, connected: false }];
  const rows = sourceData.cctvRows;
  const validRow = row => row.status === 'valid' && row.plannedMinutes === 10 && row.analyzedMinutes === 10 &&
    Number.isFinite(row.passers) && row.passers >= 0 && Number.isFinite(row.entrants) && row.entrants >= 0 && row.entrants <= row.passers;
  function summarize(records, entry) {
    const valid = records.filter(validRow), passers = sum(valid, 'passers'), dwellers = sum(valid, 'dwellers');
    const entrants = entry && valid.length ? sum(valid, 'entrants') : null, observedMinutes = sum(valid, 'analyzedMinutes');
    const validPayments = entry && valid.length ? sum(valid, 'validPayments') : null, netSales = entry && valid.length ? sum(valid, 'netSales') : null;
    return { records: valid, passers: valid.length ? passers : null, dwellers: valid.length ? dwellers : null, entrants,
      dwellRate: ratio(dwellers, passers), entryRate: ratio(entrants, passers), validPayments, payments: validPayments, netSales,
      purchaseRate: ratio(validPayments, entrants), estimatedPurchaseRate: ratio(validPayments, entrants),
      customerAverage: validPayments > 0 ? netSales / validPayments : null,
      dwellAverage: dwellers ? sum(valid, 'dwellSeconds') / dwellers : null,
      directionA: valid.length ? sum(valid, 'directionA') : null, directionB: valid.length ? sum(valid, 'directionB') : null,
      dwellBins: [sum(valid, 'dwellShort'), sum(valid, 'dwellMedium'), sum(valid, 'dwellLong')],
      count: valid.length, excluded: records.length - valid.length, observedMinutes,
      averagePassers: observedMinutes ? passers / (observedMinutes / 10) : null,
      averagePerTenMinutes: observedMinutes ? passers / (observedMinutes / 10) : null };
  }
  function analyze(period, filters = {}, source = rows) {
    const camera = cameras[0], allDates = dateRange(period.start, period.end);
    const timeWindow = timeWindows.find(window => window.id === filters.timeWindow) || timeWindows[0];
    const selectedSlots = slots.filter(slot => slot.hour >= timeWindow.start && slot.hour < timeWindow.end), slotIds = new Set(selectedSlots.map(slot => slot.id));
    const offset = filters.comparison === 'previous' ? allDates.length : Math.ceil(allDates.length / 7) * 7;
    const previousStart = shift(period.start, -offset), previousEnd = shift(period.end, -offset);
    const selectedWeekdays = Array.isArray(filters.days) ? new Set(filters.days.map(Number).filter(day => day >= 0 && day <= 6)) : null;
    const matchesDay = date => selectedWeekdays && selectedWeekdays.size ? selectedWeekdays.has(weekday(date))
      : filters.dayType === 'weekday' ? ![0, 6].includes(weekday(date)) : filters.dayType === 'weekend' ? [0, 6].includes(weekday(date)) : true;
    const dates = allDates.filter(matchesDay), oldDates = dateRange(previousStart, previousEnd).filter(matchesDay);
    const currentDateSet = new Set(dates), oldDateSet = new Set(oldDates);
    const selected = source.filter(row => row.cameraId === camera.id && currentDateSet.has(row.date) && slotIds.has(row.slotId));
    const oldRows = source.filter(row => row.cameraId === camera.id && oldDateSet.has(row.date) && slotIds.has(row.slotId));
    const current = summarize(selected, camera.entry), old = summarize(oldRows, camera.entry);
    const completeDay = (records, date) => selectedSlots.every(slot => records.filter(row => row.date === date && row.slotId === slot.id && validRow(row)).length === 1);
    const completeDates = dates.filter(date => completeDay(selected, date)), completeOldDates = oldDates.filter(date => completeDay(oldRows, date));
    const complete = dates.length > 0 && completeDates.length === dates.length, oldComplete = oldDates.length > 0 && completeOldDates.length === oldDates.length;
    const comparable = complete && oldComplete, comparison = comparable ? old : null;
    const bucket = (id, label, predicate) => {
      const a = summarize(selected.filter(predicate), camera.entry), b = summarize(oldRows.filter(predicate), camera.entry);
      return { id, label, ...a, previous: comparable && b.count ? b : null };
    };
    const bySlot = selectedSlots.map(slot => ({ ...bucket(slot.id, '(' + slot.id + ')', row => row.slotId === slot.id), intervalLabel: slot.label, hour: slot.hour, minute: slot.minute }));
    // Compare full one-hour observations. Partial or duplicate 10-minute rows must not make an hour look quieter.
    const byHour = [...new Set(selectedSlots.map(slot => slot.hour))].map(hour => {
      const hourSlots = selectedSlots.filter(slot => slot.hour === hour), ids = new Set(hourSlots.map(slot => slot.id));
      const completeHours = (records, candidates) => candidates.filter(date => hourSlots.length === 6 && hourSlots.every(slot => records.filter(row => row.date === date && row.slotId === slot.id && validRow(row)).length === 1));
      const validDates = completeHours(selected, dates), beforeDates = completeHours(oldRows, oldDates);
      const a = summarize(selected.filter(row => validDates.includes(row.date) && ids.has(row.slotId)), camera.entry);
      const b = summarize(oldRows.filter(row => beforeDates.includes(row.date) && ids.has(row.slotId)), camera.entry);
      return { id: String(hour), label: hour + '~' + (hour + 1) + '시', ...a, days: validDates.length,
        averagePassers: validDates.length ? a.passers / validDates.length : null,
        previous: comparable && beforeDates.length ? { ...b, averagePassers: b.passers / beforeDates.length } : null };
    });
    const byWeekday = [1, 2, 3, 4, 5, 6, 0].map(day => {
      const validDates = completeDates.filter(date => weekday(date) === day), beforeDates = completeOldDates.filter(date => weekday(date) === day);
      const a = summarize(selected.filter(row => validDates.includes(row.date)), camera.entry), b = summarize(oldRows.filter(row => beforeDates.includes(row.date)), camera.entry);
      return { id: String(day), label: ['일', '월', '화', '수', '목', '금', '토'][day] + '요일', ...a,
        averagePassers: validDates.length ? a.passers / validDates.length : null, days: validDates.length,
        previous: comparable && beforeDates.length ? { ...b, averagePassers: b.passers / beforeDates.length } : null };
    });
    const ranked = bySlot.filter(row => row.averagePassers > 0).slice().sort((a, b) => b.averagePassers - a.averagePassers), peak = ranked[0] || null;
    const changes = bySlot.filter(row => row.previous && row.entryRate != null && row.previous.entryRate != null).sort((a, b) => (a.entryRate - a.previous.entryRate) - (b.entryRate - b.previous.entryRate));
    const insights = [];
    if (peak) insights.push({ id: 'peak', kind: 'observation', label: '관측 사실', title: peak.label + '에 통행 관측이 가장 많습니다',
      text: '같은 10분 구간의 관측일 평균은 ' + peak.averagePassers.toFixed(1) + '건입니다.', slotId: peak.id, caveat: '통행이 많다는 사실만으로 매출 기회나 구매 의사를 확정하지 않습니다.' });
    const weaker = changes.find(row => row.entryRate - row.previous.entryRate < -.1);
    if (weaker) insights.push({ id: 'entry-change', kind: 'comparison', label: '기간 비교', title: weaker.label + ' 입장률이 낮아졌습니다',
      text: '이전 ' + weaker.previous.entryRate.toFixed(1) + '% → 현재 ' + weaker.entryRate.toFixed(1) + '%로 ' + Math.abs(weaker.entryRate - weaker.previous.entryRate).toFixed(1) + '%p 낮습니다.',
      slotId: weaker.id, caveat: '집계만으로 메뉴 노출·품절·대기 등 입장률 변화의 실제 원인을 구분할 수 없습니다.' });
    const unavailable = dates.flatMap(date => selectedSlots.map(slot => ({ date, slotId: slot.id, row: selected.find(row => row.date === date && row.slotId === slot.id) }))).filter(item => !item.row || !validRow(item.row));
    return { period, camera, filters, timeWindow, selectedSlots, previousStart, previousEnd, dates, selected, current, comparison, comparable, complete, oldComplete,
      bySlot, byHour, byWeekday, peak, insights, expected: dates.length * selectedSlots.length, unavailable, observedHours: current.observedMinutes / 60, sourceType: 'synthetic_demo' };
  }
  function recoveryContext(analysis) {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const selectedDays = new Set((analysis.filters.days || []).map(Number));
    const days = [1, 2, 3, 4, 5, 6, 0].filter(day => selectedDays.has(day)).map(day => dayNames[day]).join('·') || '모든 요일';
    const context = { source: 'market', title: '상권분석', scope: analysis.camera.name + ' · ' + analysis.period.start + '~' + analysis.period.end + ' · ' + days + ' · ' + analysis.timeWindow.start + ':00~' + analysis.timeWindow.end + ':00', findings: [] };
    if (!analysis.current.count || !analysis.current.passers) {
      context.reason = !analysis.current.count ? '해당 월의 선택 요일에 분석 가능한 관측 자료가 없습니다.' : '유효 관측 구간의 통행이 0건이므로 입장률에 근거한 운영 제안을 보류합니다.';
      return context;
    }
    const actions = {
      peak: '통행이 가장 많은 이 시간대에 입구의 메뉴·가격 안내가 잘 보이는지 점검해 보세요. 개선이 필요하면 안내 위치 한 가지만 바꾼 뒤 같은 요일·시간의 입장률을 비교하는 소규모 시험을 권합니다.',
      'entry-change': '입장률이 낮아진 이 시간대의 품절·대기·메뉴 안내 기록을 먼저 대조해 보세요. 확인된 요인 한 가지만 조정하고 같은 요일·시간의 입장률을 다시 비교하는 순서를 권합니다.',
      'weekday-peak': '통행이 많은 요일의 실제 대기와 인력 배치를 먼저 확인해 보세요. 필요하면 한 항목만 조정하고 다음 같은 요일의 입장률을 비교해 보세요.',
      'entry-peak': '입장률이 높은 이 시간대의 메뉴 안내와 대기 상황을 기록해 보세요. 다른 시간대에 적용할 때는 한 항목씩 시험하고 같은 요일의 입장률을 비교해 보세요.',
      'monthly-coverage': '해당 월의 매장 앞 통행과 입장 집계를 매출진단 결과와 함께 확인해 보세요. 실제 관측과 판매 기록에서 원인이 확인된 항목부터 검토해 보세요.'
    };
    context.findings = analysis.insights.map(insight => ({
      id: 'market-' + insight.id,
      title: insight.title,
      evidence: insight.text + ' 유효 관측 ' + analysis.current.count + '/' + analysis.expected + '구간.',
      action: analysis.complete ? actions[insight.id] || '' : '',
      caveat: '생성한 CCTV 분석 집계입니다. ' + insight.caveat + (!analysis.complete ? ' 관측 누락이 있어 전체 시간대의 우선순위와 실행 제안을 보류합니다.' : !analysis.comparable ? ' 이전 기간 자료가 불완전해 증감 비교는 보류하며 현재 관측만 근거로 삼습니다.' : ''),
      status: analysis.complete ? 'ready' : 'insufficient'
    }));
    return context;
  }
  function kstClock(now) {
    const date = new Date(now instanceof Date ? now.getTime() : now);
    if (!Number.isFinite(date.getTime())) throw new TypeError('유효한 기준 시각이 필요합니다.');
    const local = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return { now: date, date: local.toISOString().slice(0, 10), hour: local.getUTCHours(), minute: local.getUTCMinutes() };
  }
  function lastCompleteMonth(now = new Date()) {
    const clock = kstClock(now), thisStart = clock.date.slice(0, 7) + '-01', end = shift(thisStart, -1), start = end.slice(0, 7) + '-01';
    return { id: 'completed-month', start, end, label: Number(start.slice(0, 4)) + '년 ' + Number(start.slice(5, 7)) + '월', closed: true };
  }
  // 월간 진단은 끝난 한 달 전체를 사용합니다. 진행 중인 달이나 미래 관측으로 바꾸지 않습니다.
  function monthlySummary(now = new Date(), filters = {}, source = rows) {
    const analysis = analyze(lastCompleteMonth(now), { ...filters, timeWindow: 'all' }, source);
    const insights = analysis.insights.filter(item => item.id !== 'dwell');
    const activeDays = analysis.byWeekday.filter(item => item.days >= 3 && item.averagePassers > 0).sort((a, b) => b.averagePassers - a.averagePassers);
    if (activeDays.length > 1) {
      const best = activeDays[0];
      insights.push({ id: 'weekday-peak', kind: 'observation', label: '요일별 진단', title: best.label + '의 일평균 통행이 가장 많습니다',
        text: '완전히 관측한 ' + best.days + '일 기준, 하루 평균 통행 관측은 ' + best.averagePassers.toFixed(1) + '건입니다.',
        caveat: '선택 요일 중 완전 관측일이 3일 이상인 요일끼리 비교했습니다. 반복 통행이 포함될 수 있습니다.' });
    }
    const entrySlots = analysis.bySlot.filter(item => item.count >= 3 && item.passers >= 30 && item.entryRate != null && item.entrants > 0).sort((a, b) => b.entryRate - a.entryRate);
    if (entrySlots.length > 1) {
      const best = entrySlots[0];
      insights.push({ id: 'entry-peak', kind: 'observation', label: '입장률 진단', title: '(' + best.id + ')의 입장률이 가장 높습니다',
        text: '유효 관측 ' + best.count + '일의 통행 ' + best.passers.toLocaleString('ko-KR') + '건 대비 입장 ' + best.entrants.toLocaleString('ko-KR') + '건으로 ' + best.entryRate.toFixed(1) + '%입니다.',
        slotId: best.id, caveat: '관측일 3일·통행 30건 이상인 구간끼리 비교했습니다. 집계 비율만으로 입장 원인을 확정하지 않습니다.' });
    }
    analysis.insights = insights;
    analysis.summaryInsights = insights;
    analysis.summaryScope = analysis.period.start + '~' + analysis.period.end + ' · 완료된 한 달';
    return analysis;
  }
  // 현재 시각보다 먼저 끝난 단 하나의 구간만 선택합니다. 해당 구간이 누락되면 이전 구간으로 대체하지 않습니다.
  function getLiveSnapshot(now = new Date(), source = rows) {
    const clock = kstClock(now), minuteOfDay = clock.hour * 60 + clock.minute;
    const minimumDays = 3, lookbackDays = 28, opening = 17 * 60, closing = 23 * 60;
    const duringHours = minuteOfDay >= opening && minuteOfDay < closing;
    let date = clock.date, slotMinute;
    if (minuteOfDay < opening) { date = shift(date, -1); slotMinute = closing - 10; }
    else if (minuteOfDay >= closing) slotMinute = closing - 10;
    else if (minuteOfDay < opening + 10) slotMinute = null;
    else slotMinute = Math.floor(minuteOfDay / 10) * 10 - 10;
    const slot = slotMinute == null ? null : slots.find(item => item.hour * 60 + item.minute === slotMinute);
    const nextBoundary = Math.floor(clock.now.getTime() / 600000) * 600000 + 600000;
    const base = { sourceType: 'synthetic_demo', camera: cameras[0], asOf: clock.now.toISOString(), date,
      slot: slot ? { ...slot, label: '(' + slot.id + ')', intervalLabel: slot.label } : null,
      current: null, baseline: { days: 0, averagePassers: null, entryRate: null, minimumDays, lookbackDays },
      traffic: { level: 'unavailable', text: '관측 자료를 확인 중입니다.', detail: '' }, byWeekday: [],
      nextRefreshAt: new Date(nextBoundary).toISOString(), sourceLabel: '생성한 CCTV 관측 예시 · 실제 CCTV 미연결',
      status: duringHours ? 'insufficient' : 'off_hours', isCurrent: duringHours, reason: '' };
    if (!slot) {
      base.reason = '첫 10분 관측이 완료되지 않았습니다. 17:10부터 완료된 구간을 표시합니다.';
      base.traffic.text = '첫 관측 결과를 기다리고 있습니다.'; base.traffic.detail = base.reason;
      return base;
    }
    const completedAt = Date.parse(date + 'T' + slot.id + ':00+09:00') + 600000;
    base.completedAt = new Date(completedAt).toISOString();
    const candidates = source.filter(row => row.cameraId === cameras[0].id && row.date === date && row.slotId === slot.id);
    const sample = candidates.length === 1 && validRow(candidates[0]) && completedAt <= clock.now.getTime() ? candidates[0] : null;
    const firstDate = shift(date, -lookbackDays), lastDate = shift(date, -1);
    const historical = source.filter(row => row.cameraId === cameras[0].id && row.date >= firstDate && row.date <= lastDate && row.slotId === slot.id);
    const historyByDate = new Map();
    historical.forEach(row => { const group = historyByDate.get(row.date) || []; group.push(row); historyByDate.set(row.date, group); });
    const history = [...historyByDate.values()].filter(group => group.length === 1 && validRow(group[0])).map(group => group[0]);
    const baselineRows = history.filter(row => weekday(row.date) === weekday(date));
    const baseline = summarize(baselineRows, true);
    base.baseline = { days: baselineRows.length, averagePassers: baselineRows.length >= minimumDays ? baseline.averagePerTenMinutes : null,
      entryRate: baselineRows.length >= minimumDays ? baseline.entryRate : null, minimumDays, lookbackDays, start: firstDate, end: lastDate,
      label: '직전 4주 같은 요일·같은 10분 구간' };
    base.byWeekday = [1, 2, 3, 4, 5, 6, 0].map(day => {
      const selected = history.filter(row => weekday(row.date) === day), summary = summarize(selected, true), sufficient = selected.length >= minimumDays;
      return { id: String(day), label: ['일', '월', '화', '수', '목', '금', '토'][day] + '요일', days: selected.length,
        averagePassers: sufficient ? summary.averagePerTenMinutes : null, entryRate: sufficient ? summary.entryRate : null,
        sufficient, slotId: slot.id, scope: firstDate + '~' + lastDate + ' · ' + slot.id };
    });
    if (!sample) {
      base.status = duringHours ? 'missing' : 'off_hours';
      base.reason = '마지막 완료 구간 ' + date + ' ' + slot.id + '의 유효 관측이 없습니다. 누락을 0건으로 표시하지 않습니다.';
      base.traffic.text = duringHours ? '최근 관측 자료가 없습니다.' : '지금은 관측 운영시간 밖입니다.';
      base.traffic.detail = base.reason;
      return base;
    }
    base.current = summarize([sample], true);
    const offHoursText = duringHours ? '' : '관측 운영시간(17~23시) 밖입니다. ' + date + ' ' + slot.id + '의 마지막 완료 구간입니다. ';
    if (baselineRows.length < minimumDays || !(base.baseline.averagePassers > 0)) {
      base.status = duringHours ? 'insufficient' : 'off_hours';
      base.reason = '비교 가능한 과거 관측일이 3일 미만이거나 과거 평균이 0건이라 많고 적음을 판단하지 않습니다.';
      base.traffic.text = duringHours ? '평소와 비교할 자료가 부족합니다.' : '지금은 관측 운영시간 밖입니다.';
      base.traffic.detail = offHoursText + base.reason;
      return base;
    }
    const change = (sample.passers - base.baseline.averagePassers) / base.baseline.averagePassers;
    const level = change >= .2 ? 'high' : change <= -.2 ? 'low' : 'similar';
    const text = { high: '평소보다 사람이 많은 편입니다.', low: '평소보다 사람이 적은 편입니다.', similar: '평소와 사람이 비슷한 편입니다.' }[level];
    base.status = duringHours ? 'available' : 'off_hours';
    base.traffic = { level, text: duringHours ? text : '지금은 관측 운영시간 밖입니다.', comparisonText: text,
      detail: offHoursText + '직전 4주 같은 요일·같은 구간 ' + baselineRows.length + '일 평균 ' + base.baseline.averagePassers.toFixed(1) + '건과 비교했습니다. ±20%를 기준으로 구분합니다. 통행 관측은 고유 인원 수가 아닙니다.' };
    return base;
  }
  const api = { rows, cameras, slots, timeWindows, defaultTimeWindow, analyze, recoveryContext, summarize, ratio, rate, weekday, shift,
    lastCompleteMonth, monthlySummary, getLiveSnapshot, start: sourceData.dataStart, end: sourceData.dataEnd, ruleVersion: 'restaurant-ten-minute-demo-2' };
  root.IM_MARKET_DATA = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
