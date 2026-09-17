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
  const cameras = [{ id: 'front', name: '매장 전면', code: 'CAM-01', scope: '가상 고깃집 앞 보행로와 출입구', entry: true, connected: true }];
  const rows = sourceData.cctvRows;
  const validRow = row => row.status === 'valid' && row.plannedMinutes === 10 && row.analyzedMinutes === 10;
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
    const offset = filters.comparison === 'previous' ? allDates.length : Math.ceil(allDates.length / 7) * 7;
    const previousStart = shift(period.start, -offset), previousEnd = shift(period.end, -offset);
    const selectedWeekdays = Array.isArray(filters.days) ? new Set(filters.days.map(Number).filter(day => day >= 0 && day <= 6)) : null;
    const matchesDay = date => selectedWeekdays && selectedWeekdays.size ? selectedWeekdays.has(weekday(date))
      : filters.dayType === 'weekday' ? ![0, 6].includes(weekday(date)) : filters.dayType === 'weekend' ? [0, 6].includes(weekday(date)) : true;
    const dates = allDates.filter(matchesDay), oldDates = dateRange(previousStart, previousEnd).filter(matchesDay);
    const currentDateSet = new Set(dates), oldDateSet = new Set(oldDates);
    const selected = source.filter(row => row.cameraId === camera.id && currentDateSet.has(row.date));
    const oldRows = source.filter(row => row.cameraId === camera.id && oldDateSet.has(row.date));
    const current = summarize(selected, camera.entry), old = summarize(oldRows, camera.entry);
    const completeDay = (records, date) => slots.every(slot => records.filter(row => row.date === date && row.slotId === slot.id && validRow(row)).length === 1);
    const completeDates = dates.filter(date => completeDay(selected, date)), completeOldDates = oldDates.filter(date => completeDay(oldRows, date));
    const complete = dates.length > 0 && completeDates.length === dates.length, oldComplete = oldDates.length > 0 && completeOldDates.length === oldDates.length;
    const comparable = complete && oldComplete, comparison = comparable ? old : null;
    const bucket = (id, label, predicate) => {
      const a = summarize(selected.filter(predicate), camera.entry), b = summarize(oldRows.filter(predicate), camera.entry);
      return { id, label, ...a, previous: comparable && b.count ? b : null };
    };
    const bySlot = slots.map(slot => ({ ...bucket(slot.id, slot.label, row => row.slotId === slot.id), hour: slot.hour, minute: slot.minute }));
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
      slotId: weaker.id, caveat: '메뉴 노출·품절·대기 등 실제 원인은 운영 기록과 함께 확인해야 합니다.' });
    const linger = bySlot.filter(row => row.dwellers > 0).slice().sort((a, b) => b.dwellRate - a.dwellRate)[0];
    if (linger) insights.push({ id: 'dwell', kind: 'observation', label: '관측 사실', title: linger.label + '에 머무는 비율이 가장 높습니다',
      text: '통행 대비 10초 이상 체류 비율은 ' + linger.dwellRate.toFixed(1) + '%입니다.', slotId: linger.id, caveat: '대기·대화·상품 관심의 이유는 집계만으로 구분하지 않습니다.' });
    const unavailable = dates.flatMap(date => slots.map(slot => ({ date, slotId: slot.id, row: selected.find(row => row.date === date && row.slotId === slot.id) }))).filter(item => !item.row || !validRow(item.row));
    return { period, camera, filters, previousStart, previousEnd, dates, selected, current, comparison, comparable, complete, oldComplete,
      bySlot, byWeekday, peak, insights, expected: dates.length * slots.length, unavailable, observedHours: current.observedMinutes / 60, sourceType: 'synthetic_demo' };
  }
  const api = { rows, cameras, slots, analyze, summarize, ratio, rate, weekday, shift, start: sourceData.dataStart, end: sourceData.dataEnd, ruleVersion: 'restaurant-ten-minute-demo-1' };
  root.IM_MARKET_DATA = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
