/* Sales diagnosis adapter: deterministic existing POS fixtures, no network or storage. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
  const change = (value, before) => before > 0 ? (value - before) / before * 100 : null;
  const shift = (date, offset) => new Date(Date.parse(date + 'T00:00:00Z') + offset * DAY).toISOString().slice(0, 10);
  const weekday = date => new Date(date + 'T00:00:00Z').getUTCDay();
  const dates = (start, end) => Array.from({ length: Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1 }, (_, i) => shift(start, i));
  const ranges = [{ id: 'all', label: '모든 시간', start: 8, end: 20 }, { id: 'morning', label: '오전 · 08~11시', start: 8, end: 11 }, { id: 'lunch', label: '점심 · 11~14시', start: 11, end: 14 }, { id: 'afternoon', label: '오후 · 14~17시', start: 14, end: 17 }, { id: 'evening', label: '저녁 · 17~20시', start: 17, end: 20 }];
  function analyze(source, period, filters = {}) {
    const days = dates(period.start, period.end);
    const offset = filters.comparison === 'weekday' ? Math.ceil(days.length / 7) * 7 : days.length;
    const previousStart = shift(period.start, -offset), previousEnd = shift(period.end, -offset);
    const oldDays = dates(previousStart, previousEnd);
    const dayMatches = date => filters.dayType === 'weekday' ? ![0, 6].includes(weekday(date)) : filters.dayType === 'weekend' ? [0, 6].includes(weekday(date)) : true;
    const range = ranges.find(row => row.id === filters.hour) || ranges[0];
    const matches = row => (!filters.item || filters.item === 'all' || row.itemId === filters.item) && row.hour >= range.start && row.hour < range.end && dayMatches(row.date);
    const inPeriod = (row, start, end) => row.date >= start && row.date <= end;
    const sourceDates = new Set(source.records.map(row => row.date));
    const selectedDays = days.filter(dayMatches), selectedOldDays = oldDays.filter(dayMatches);
    const currentComplete = selectedDays.length > 0 && selectedDays.every(date => sourceDates.has(date));
    const comparisonAvailable = selectedOldDays.length > 0 && selectedOldDays.every(date => sourceDates.has(date));
    const rows = source.records.filter(row => inPeriod(row, period.start, period.end) && matches(row));
    const oldRows = source.records.filter(row => inPeriod(row, previousStart, previousEnd) && matches(row));
    const totals = records => ({ sales: sum(records, 'netAmount'), units: sum(records, 'netQuantity'), cancelled: sum(records, 'cancellations') });
    const current = totals(rows), previous = comparisonAvailable ? totals(oldRows) : null;
    current.average = selectedDays.length ? current.sales / selectedDays.length : null;
    current.unitAmount = current.units ? current.sales / current.units : null;
    if (previous) {
      previous.average = previous.sales / selectedOldDays.length;
      previous.unitAmount = previous.units ? previous.sales / previous.units : null;
    }
    const aggregate = (id, label, predicate) => {
      const now = totals(rows.filter(predicate));
      const before = previous ? totals(oldRows.filter(predicate)) : null;
      return { id, label, ...now, previous: before ? before.sales : null, previousUnits: before ? before.units : null, delta: before ? now.sales - before.sales : null, rate: before ? change(now.sales, before.sales) : null, share: current.sales ? now.sales / current.sales * 100 : null };
    };
    const products = source.menu.filter(item => !filters.item || filters.item === 'all' || item.id === filters.item).map(item => aggregate(item.id, item.name, row => row.itemId === item.id)).sort((a, b) => b.sales - a.sales);
    const slots = ranges.slice(1).map(slot => aggregate(slot.id, slot.label, row => row.hour >= slot.start && row.hour < slot.end));
    const weekdays = [1, 2, 3, 4, 5, 6, 0].map(day => {
      const row = aggregate(String(day), ['일', '월', '화', '수', '목', '금', '토'][day] + '요일', r => weekday(r.date) === day);
      const count = selectedDays.filter(date => weekday(date) === day).length;
      const oldCount = selectedOldDays.filter(date => weekday(date) === day).length;
      return { ...row, count, average: count ? row.sales / count : null, previousAverage: previous && oldCount ? row.previous / oldCount : null };
    });
    const heatmap = weekdays.map(day => ({ ...day, cells: Array.from({ length: 12 }, (_, i) => {
      const hour = i + 8;
      const available = day.count > 0 && hour >= range.start && hour < range.end;
      return { hour, day: Number(day.id), average: available ? sum(rows.filter(row => weekday(row.date) === Number(day.id) && row.hour === hour), 'netAmount') / day.count : null };
    }) }));
    const daily = days.map((date, index) => ({ date, previousDate: oldDays[index], sales: dayMatches(date) && sourceDates.has(date) ? sum(rows.filter(row => row.date === date), 'netAmount') : null, previous: previous && dayMatches(oldDays[index]) ? sum(oldRows.filter(row => row.date === oldDays[index]), 'netAmount') : null }));
    // Exact sequential decomposition: change in quantity at prior mix, then change in average amount.
    const effects = previous && previous.units > 0 ? {
      quantity: (current.units - previous.units) * previous.unitAmount,
      amount: current.sales - current.units * previous.unitAmount,
      total: current.sales - previous.sales
    } : null;
    const finance = source.analyze({ ...period, previousStart, previousEnd });
    const actions = [];
    if (previous && rows.length && currentComplete) {
      const declining = products.filter(row => row.delta < 0).sort((a, b) => a.delta - b.delta)[0];
      const weak = slots.filter(row => row.delta < 0).sort((a, b) => a.delta - b.delta)[0];
      if (declining) actions.push({ id: 'product-' + declining.id, title: declining.label + ' 판매 조건 점검', evidence: declining.label + ' 매출이 비교 기간보다 ' + Math.round(Math.abs(declining.delta)).toLocaleString('ko-KR') + '원 감소했습니다.', task: '품절 기록·메뉴 노출·가격 변경 여부를 확인하세요.', measure: '같은 품목의 판매 수량과 순매출', kind: 'item', value: declining.id });
      if (weak) actions.push({ id: 'slot-' + weak.id, title: weak.label + ' 운영 점검', evidence: '해당 시간대 매출 증감액이 ' + Math.round(weak.delta).toLocaleString('ko-KR') + '원입니다.', task: '영업시간 변경과 주문 응대 지연 여부를 확인하세요.', measure: '같은 요일·시간대의 일평균 매출', kind: 'slot', value: weak.id });
      if (!declining && !weak) actions.push({ id: 'maintain', title: '유지된 판매 흐름 확인', evidence: '현재 조건에서 감소한 품목·시간대가 없습니다.', task: '잘 팔린 메뉴의 재고와 준비 수량을 점검하세요.', measure: '판매 수량과 취소 수량', kind: 'all', value: '' });
    }
    return { period, filters, previousStart, previousEnd, rows, oldRows: previous ? oldRows : [], current, previous, currentComplete, comparisonAvailable, dayCount: selectedDays.length, previousDayCount: selectedOldDays.length, products, slots, weekdays, heatmap, daily, effects, finance, actions, range, sourceType: 'synthetic_demo' };
  }
  const api = { analyze, change, ranges, weekday };
  root.IM_SALES_DATA = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
