/* Sales calculations over shared fictional receipts. No network or storage. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] || 0), 0);
  const change = (value, before) => before > 0 && value != null ? (value - before) / before * 100 : null;
  const shift = (date, offset) => new Date(Date.parse(date + 'T00:00:00Z') + offset * DAY).toISOString().slice(0, 10);
  const weekday = date => new Date(date + 'T00:00:00Z').getUTCDay();
  const dates = (start, end) => Array.from({ length: Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1) }, (_, index) => shift(start, index));
  const ranges = [{ id: 'all', label: '전체', start: 12, end: 24 },
    ...Array.from({ length: 12 }, (_, index) => {
      const hour = index + 12;
      return { id: String(hour), label: hour + '시~' + (hour + 1) + '시', start: hour, end: hour + 1 };
    })];
  function currentRange(date = new Date()) {
    // Select the viewing hour in Korea, independent of the device time zone.
    const hour = new Date(date.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
    return ranges.find(row => row.id !== 'all' && hour >= row.start && hour < row.end)?.id || 'all';
  }
  function analyze(source, period, filters = {}) {
    const days = dates(period.start, period.end);
    const offset = filters.comparison === 'previous' ? days.length : Math.ceil(days.length / 7) * 7;
    const previousStart = shift(period.start, -offset), previousEnd = shift(period.end, -offset);
    const oldDays = dates(previousStart, previousEnd);
    const selectedWeekdays = Array.isArray(filters.days) ? new Set(filters.days.map(Number).filter(day => day >= 0 && day <= 6)) : null;
    const dayMatches = date => selectedWeekdays && selectedWeekdays.size ? selectedWeekdays.has(weekday(date))
      : filters.dayType === 'weekday' ? ![0, 6].includes(weekday(date)) : filters.dayType === 'weekend' ? [0, 6].includes(weekday(date)) : true;
    const range = ranges.find(row => row.id === String(filters.hour)) || ranges[0];
    const menuMatches = item => (!filters.item || filters.item === 'all' || item.id === filters.item)
      && (!filters.category || filters.category === 'all' || item.category === filters.category)
      && (!filters.subcategory || filters.subcategory === 'all' || item.subcategory === filters.subcategory);
    const selectedMenu = source.menu.filter(menuMatches), itemIds = new Set(selectedMenu.map(item => item.id));
    const matches = row => itemIds.has(row.itemId) && row.hour >= range.start && row.hour < range.end && dayMatches(row.date);
    const counts = new Map();
    source.records.forEach(row => counts.set(row.date, (counts.get(row.date) || 0) + 1));
    const transactionCounts = new Map();
    (source.transactions || []).forEach(row => transactionCounts.set(row.date, (transactionCounts.get(row.date) || 0) + 1));
    const coverage = new Map((source.coverage || []).map(row => [row.date, row]));
    const collected = date => {
      const row = coverage.get(date);
      if (!row) return !source.coverage && counts.has(date);
      return row.open === true && row.status === 'valid' && row.analyzedMinutes === row.plannedMinutes
        && (row.expectedRecords == null || row.expectedRecords === (counts.get(date) || 0))
        && (!source.transactions || row.expectedTransactions == null || row.expectedTransactions === (transactionCounts.get(date) || 0));
    };
    const selectedDays = days.filter(dayMatches), selectedOldDays = oldDays.filter(dayMatches);
    const completeDays = selectedDays.filter(collected), completeOldDays = selectedOldDays.filter(collected);
    const currentDates = new Set(completeDays), oldDates = new Set(completeOldDays);
    const currentComplete = selectedDays.length > 0 && completeDays.length === selectedDays.length;
    const previousComplete = selectedOldDays.length > 0 && completeOldDays.length === selectedOldDays.length;
    const comparisonAvailable = currentComplete && previousComplete;
    // Incomplete collection is excluded, never counted as a day with zero sales.
    const rows = source.records.filter(row => currentDates.has(row.date) && matches(row));
    const oldRows = source.records.filter(row => oldDates.has(row.date) && matches(row));
    const validIds = source.transactions ? new Set(source.transactions.filter(row => row.status === 'paid' && row.channel === 'in_store').map(row => row.id || row.transactionId)) : null;
    const totals = records => {
      const sales = sum(records, 'netAmount'), units = sum(records, 'netQuantity');
      const receipts = new Set(records.filter(row => row.netQuantity > 0 && row.netAmount > 0 && row.transactionId && (!validIds || validIds.has(row.transactionId))).map(row => row.transactionId));
      return { sales, units, cancelled: sum(records, 'cancellations'), transactions: receipts.size,
        customerAverage: receipts.size ? sales / receipts.size : null, unitAmount: units ? sales / units : null };
    };
    const current = totals(rows), previous = comparisonAvailable ? totals(oldRows) : null;
    current.average = completeDays.length ? current.sales / completeDays.length : null;
    current.dayCount = completeDays.length;
    if (previous) { previous.average = previous.sales / completeOldDays.length; previous.dayCount = completeOldDays.length; }
    const aggregate = (id, label, predicate) => {
      const now = totals(rows.filter(predicate)), before = previous ? totals(oldRows.filter(predicate)) : null;
      return { id, label, ...now, previous: before ? before.sales : null, previousUnits: before ? before.units : null,
        previousTransactions: before ? before.transactions : null, previousCustomerAverage: before ? before.customerAverage : null,
        delta: before ? now.sales - before.sales : null, rate: before ? change(now.sales, before.sales) : null,
        share: current.sales ? now.sales / current.sales * 100 : null };
    };
    const products = selectedMenu.map(item => ({ ...aggregate(item.id, item.name, row => row.itemId === item.id), category: item.category, subcategory: item.subcategory })).sort((a, b) => b.sales - a.sales);
    const slots = ranges.slice(1).map(slot => aggregate(slot.id, slot.label, row => row.hour >= slot.start && row.hour < slot.end));
    const weekdays = [1, 2, 3, 4, 5, 6, 0].map(day => {
      const row = aggregate(String(day), ['일', '월', '화', '수', '목', '금', '토'][day] + '요일', record => weekday(record.date) === day);
      const count = completeDays.filter(date => weekday(date) === day).length, oldCount = completeOldDays.filter(date => weekday(date) === day).length;
      return { ...row, count, average: count ? row.sales / count : null, previousAverage: previous && oldCount ? row.previous / oldCount : null };
    });
    const heatmap = weekdays.map(day => ({ ...day, cells: ranges.slice(1).map(slot => {
      const available = day.count > 0 && slot.start >= range.start && slot.end <= range.end;
      const now = sum(rows.filter(row => weekday(row.date) === Number(day.id) && row.hour >= slot.start && row.hour < slot.end), 'netAmount');
      const oldCount = completeOldDays.filter(date => weekday(date) === Number(day.id)).length;
      const before = sum(oldRows.filter(row => weekday(row.date) === Number(day.id) && row.hour >= slot.start && row.hour < slot.end), 'netAmount');
      return { hour: slot.start, endHour: slot.end, label: slot.label, day: Number(day.id), average: available ? now / day.count : null,
        previousAverage: available && previous && oldCount ? before / oldCount : null };
    }) }));
    const daily = days.map((date, index) => ({ date, previousDate: oldDays[index],
      sales: dayMatches(date) && currentDates.has(date) ? sum(rows.filter(row => row.date === date), 'netAmount') : null,
      previous: previous && dayMatches(oldDays[index]) && oldDates.has(oldDays[index]) ? sum(oldRows.filter(row => row.date === oldDays[index]), 'netAmount') : null }));
    const effects = previous && previous.units > 0 ? {
      quantity: (current.units - previous.units) * previous.unitAmount,
      amount: current.sales - current.units * previous.unitAmount, total: current.sales - previous.sales
    } : null;
    const finance = source.analyze({ ...period, previousStart, previousEnd });
    // Expenses belong to the whole store; POS product/day/time filters never allocate costs.
    const inPeriod = (row, start, end) => row.date >= start && row.date <= end;
    const costs = (source.expenses || []).filter(row => inPeriod(row, period.start, period.end));
    const oldCosts = (source.expenses || []).filter(row => inPeriod(row, previousStart, previousEnd));
    const purchases = (source.purchases || []).filter(row => inPeriod(row, period.start, period.end));
    const oldPurchases = (source.purchases || []).filter(row => inPeriod(row, previousStart, previousEnd));
    const expenseTotal = sum(costs, 'amount');
    const expenseBreakdown = {
      total: expenseTotal, previous: finance.comparisonAvailable ? sum(oldCosts, 'amount') : null,
      ratio: finance.sales > 0 ? expenseTotal / finance.sales * 100 : null,
      categories: (source.categories || []).map(([id, name]) => {
        const amount = sum(costs.filter(row => row.category === id), 'amount');
        return { id, name, amount, share: expenseTotal > 0 ? amount / expenseTotal * 100 : null,
          previous: finance.comparisonAvailable ? sum(oldCosts.filter(row => row.category === id), 'amount') : null };
      }).sort((a, b) => b.amount - a.amount),
      purchases: (source.materials || []).map(item => ({ id: item.id, name: item.name, unit: item.unit,
        amount: sum(purchases.filter(row => row.itemId === item.id), 'amount'),
        quantity: sum(purchases.filter(row => row.itemId === item.id), 'quantity'),
        previous: finance.comparisonAvailable ? sum(oldPurchases.filter(row => row.itemId === item.id), 'amount') : null
      })).sort((a, b) => b.amount - a.amount)
    };
    const actions = [];
    if (previous && rows.length) {
      const declining = products.filter(row => row.delta < 0).sort((a, b) => a.delta - b.delta)[0];
      const weak = slots.filter(row => row.delta < 0).sort((a, b) => a.delta - b.delta)[0];
      if (declining) actions.push({ id: 'product-' + declining.id, title: declining.label + ' 판매 조건 점검', evidence: declining.label + ' 매출이 비교 기간보다 ' + Math.round(Math.abs(declining.delta)).toLocaleString('ko-KR') + '원 적습니다.', task: '품절 기록·메뉴 노출·가격 변경 여부를 확인하세요.', measure: '같은 품목의 판매 수량과 순매출', kind: 'item', value: declining.id });
      if (weak) actions.push({ id: 'slot-' + weak.id, title: weak.label + ' 운영 점검', evidence: '해당 시간대 매출 증감액은 ' + Math.round(weak.delta).toLocaleString('ko-KR') + '원입니다.', task: '주문 대기와 운영 기록을 함께 확인하세요.', measure: '같은 요일·시간대의 일평균 매출', kind: 'slot', value: weak.id });
      if (!declining && !weak) {
        const leading = products.find(row => row.sales > 0);
        if (leading) actions.push({ id: 'maintain-' + leading.id, title: leading.label + ' 판매 흐름 유지 검토', evidence: '현재 선택 조건에서 감소한 품목·시간대가 없으며, ' + leading.label + '의 매출이 가장 높습니다.', task: leading.label + '의 재고와 준비 수량을 실제 판매·취소 기록에 맞춰 점검하세요.', measure: '판매 수량과 취소 수량', kind: 'item', value: leading.id });
      }
    }
    return { period, filters, previousStart, previousEnd, rows, oldRows: previous ? oldRows : [], current, previous,
      currentComplete, previousComplete, comparisonAvailable, selectedDays, completeDays,
      excludedDates: selectedDays.filter(date => !collected(date)), dayCount: completeDays.length, previousDayCount: completeOldDays.length,
      products, slots, weekdays, heatmap, daily, effects, finance, expenseBreakdown, actions, range, sourceType: 'synthetic_demo' };
  }
  const api = { analyze, change, ranges, weekday, currentRange };
  root.IM_SALES_DATA = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
