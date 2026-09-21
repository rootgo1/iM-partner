/* Deterministic synthetic records for the local HTML preview. No real POS/API data. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const iso = date => new Date(date).toISOString().slice(0, 10);
  const shift = (date, days) => iso(Date.parse(date + 'T00:00:00Z') + days * DAY);
  const sum = (rows, fn) => rows.reduce((n, row) => n + fn(row), 0);
  const rate = (value, previous) => previous > 0 && value != null ? (value - previous) / previous * 100 : null;
  const dataStart = '2026-06-01', dataEnd = '2026-09-30';
  const hours = [17, 18, 19, 20, 21, 22], twoHourStarts = [17, 19, 21];
  const pad = value => String(value).padStart(2, '0');
  const timeSlots = Array.from({ length: 36 }, (_, index) => {
    const start = 17 * 60 + index * 10, end = start + 10;
    const hour = Math.floor(start / 60), minute = start % 60, endHour = Math.floor(end / 60), endMinute = end % 60;
    const id = pad(hour) + ':' + pad(minute);
    return { id, hour, minute, endHour, endMinute, label: id + '~' + pad(endHour) + ':' + pad(endMinute), minutes: 10 };
  });
  const menu = [
    { id: 'pork-belly', name: '삼겹살', price: 16000, unit: '180g', category: 'food', categoryLabel: '음식', subcategory: 'grill', subcategoryLabel: '구이류' },
    { id: 'pork-neck', name: '목살', price: 16000, unit: '180g', category: 'food', categoryLabel: '음식', subcategory: 'grill', subcategoryLabel: '구이류' },
    { id: 'ribs', name: '양념갈비', price: 18000, unit: '200g', category: 'food', categoryLabel: '음식', subcategory: 'grill', subcategoryLabel: '구이류' },
    { id: 'stew', name: '된장찌개', price: 7000, unit: '그릇', category: 'food', categoryLabel: '음식', subcategory: 'meal', subcategoryLabel: '식사류' },
    { id: 'rice', name: '공깃밥', price: 1000, unit: '공기', category: 'food', categoryLabel: '음식', subcategory: 'meal', subcategoryLabel: '식사류' },
    { id: 'soft-drink', name: '음료', price: 2000, unit: '병', category: 'drink', categoryLabel: '음료', subcategory: 'soft', subcategoryLabel: '음료' }
  ];
  const materials = [
    { id: 'pork', name: '돼지고기', unit: 'kg', price: 20000, amount: 20 },
    { id: 'vegetable', name: '채소류', unit: 'kg', price: 4800, amount: 9 },
    { id: 'rice', name: '쌀', unit: 'kg', price: 2700, amount: 5 },
    { id: 'seasoning', name: '양념류', unit: 'kg', price: 6000, amount: 3 }
  ];
  const categories = [
    ['rent', '월세'], ['maintenance', '관리비'], ['purchase', '매입비'],
    ['labor', '인건비'], ['other', '기타 지출']
  ];
  const records = [], transactions = [], cctvRows = [], coverage = [], expenses = [], purchases = [], area = [], merchantSales = [], storefront = [];
  // Fictional payment events and entry cohorts share one source. One receipt can cover several diners.
  let dayIndex = 0;
  for (let date = dataStart; date <= dataEnd; date = shift(date, 1), dayIndex++) {
    const d = Number(date.slice(-2)), weekday = new Date(date + 'T00:00:00Z').getUTCDay(), weekend = [0, 6].includes(weekday);
    const dayRecords = [], dayPayments = [], arrivals = Array(36).fill(0);
    timeSlots.forEach((slot, index) => {
      const count = index < 4 ? 0 : [0, 1, 1, 1, 1, 0][slot.hour - 17] + ((dayIndex * 3 + index * 7) % 11 === 0 ? 1 : 0) + (weekend && [12, 17, 22, 27].includes(index) ? 1 : 0);
      for (let order = 0; order < count; order++) {
        const seed = dayIndex * 101 + index * 13 + order * 7, transactionId = 'demo-' + date + '-' + slot.id.replace(':', '') + '-' + order;
        const partySize = 2 + (seed % 4 === 0 ? 1 : 0), entryIndex = Math.max(0, index - 4 - seed % 3), entry = timeSlots[entryIndex];
        const cancelled = seed % 113 === 0, meatIndex = (seed + (date >= '2026-08-01' ? 1 : 0)) % 7;
        const meat = menu[meatIndex < 3 ? 0 : meatIndex < 5 ? 1 : 2];
        const basket = [[meat, partySize + (seed % 5 === 0 ? 1 : 0)], [menu[4], 1 + seed % 2], [menu[5], 1 + seed % 2]];
        if (seed % 3 !== 0) basket.push([menu[3], 1]);
        const lines = basket.map(([item, quantity], line) => {
          const cancellations = cancelled ? quantity : item.id === 'soft-drink' && seed % 47 === 0 ? 1 : 0;
          return { id: transactionId + '-' + line, transactionId, date, hour: slot.hour, minute: slot.minute, slotId: slot.id, itemId: item.id,
            category: item.category, subcategory: item.subcategory, quantity, cancellations, netQuantity: quantity - cancellations,
            unitPrice: item.price, netAmount: (quantity - cancellations) * item.price, sourceType: 'synthetic_demo' };
        });
        dayRecords.push(...lines);
        dayPayments.push({ id: transactionId, transactionId, date, hour: slot.hour, minute: slot.minute, slotId: slot.id, entrySlotId: entry.id,
          enteredAt: date + 'T' + entry.id + ':00+09:00', paidAt: date + 'T' + slot.id + ':00+09:00', partySize,
          status: cancelled ? 'cancelled' : 'paid', channel: 'in_store', netAmount: sum(lines, row => row.netAmount), sourceType: 'synthetic_demo' });
        arrivals[entryIndex] += partySize;
      }
    });
    records.push(...dayRecords); transactions.push(...dayPayments);
    coverage.push({ date, open: true, status: 'valid', plannedMinutes: 360, analyzedMinutes: 360, expectedRecords: dayRecords.length, expectedTransactions: dayPayments.length, sourceType: 'synthetic_demo' });
    timeSlots.forEach((slot, index) => {
      const payments = dayPayments.filter(row => row.slotId === slot.id && row.status === 'paid');
      const validPayments = payments.length, netSales = sum(payments, row => row.netAmount), entrants = arrivals[index] + ((dayIndex + index * 3) % 13 === 0 ? 1 : 0);
      const passers = Math.max(entrants + 8, [14, 22, 28, 25, 20, 12][slot.hour - 17] + (dayIndex + index * 5) % 9 + (weekend ? 6 : 0));
      const dwellers = Math.min(passers, Math.max(entrants, Math.round(passers * (.22 + (dayIndex + index) % 4 * .02))));
      const short = Math.round(dwellers * .5), medium = Math.round(dwellers * .32), long = dwellers - short - medium, directionA = Math.round(passers * (index < 18 ? .48 : .61));
      cctvRows.push({ id: 'front:' + date + ':' + slot.id, cameraId: 'front', date, slotId: slot.id, hour: slot.hour, minute: slot.minute,
        status: 'valid', plannedMinutes: 10, analyzedMinutes: 10, passers, passersby: passers, dwellers, entrants, validPayments, payments: validPayments, netSales,
        directionA, directionB: passers - directionA, dwellShort: short, dwellMedium: medium, dwellLong: long,
        dwellSeconds: short * 18 + medium * 42 + long * 88, sourceType: 'synthetic_demo' });
      storefront.push({ date, hour: slot.hour, minute: slot.minute, slotId: slot.id, passersby: passers, entrants, dwellers, validPayments, netSales, sourceType: 'synthetic_demo' });
      area.push({ date, hour: slot.hour, minute: slot.minute, slotId: slot.id, traffic: passers * 4 + (dayIndex + index) % 11, cardAmount: netSales + passers * 1400, sourceType: 'synthetic_demo' });
      ['store-01', 'store-02', 'store-03', 'store-04'].forEach((storeId, storeIndex) => merchantSales.push({ date, hour: slot.hour, minute: slot.minute, slotId: slot.id, storeId,
        district: '대구 중구 시연 상권', serviceConnected: true, amount: storeIndex === 0 ? netSales : Math.round(netSales * (.65 + storeIndex * .08) + passers * (120 + storeIndex * 30)), sourceType: 'synthetic_demo' }));
    });
    materials.forEach((item, i) => {
      const quantity = +(item.amount + (weekend ? item.amount * .12 : 0) + (d + i) % 3 * .3).toFixed(1), amount = Math.round(quantity * item.price * (date >= '2026-08-01' ? 1.025 : 1));
      purchases.push({ date, itemId: item.id, quantity, unit: item.unit, amount, sourceType: 'synthetic_demo' });
      expenses.push({ date, category: 'purchase', amount, sourceType: 'synthetic_demo' });
    });
    const monthDays = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).getUTCDate();
    // Explicit fictional operating costs, not market averages or inferred costs from filtered sales.
    [['rent', 2300000], ['maintenance', 1100000], ['labor', 12000000], ['other', 2400000]].forEach(([category, total]) => {
      expenses.push({ date, category, amount: Math.floor(total / monthDays) + (d <= total % monthDays ? 1 : 0), sourceType: 'synthetic_demo', allocation: '월 시연지출의 날짜별 배치; 품목·시간별 원가가 아님' });
    });
  }
  const periods = {
    month: { start: '2026-08-01', end: '2026-08-31', previousStart: '2026-06-27', previousEnd: '2026-07-27', label: '2026년 8월', comparison: '이전 같은 요일 구성 대비' },
    week: { start: '2026-08-28', end: '2026-09-03', previousStart: '2026-08-21', previousEnd: '2026-08-27', label: '최근 7일', comparison: '이전 같은 요일 구성 대비' }
  };
  function customPeriod(start, end) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
        start > end || start < dataStart || end > dataEnd) return null;
    if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || iso(start) !== start || iso(end) !== end) return null;
    const count = (Date.parse(end) - Date.parse(start)) / DAY + 1;
    const offset = Math.ceil(count / 7) * 7;
    return { start, end, previousStart: shift(start, -offset), previousEnd: shift(end, -offset), label: start + ' ~ ' + end, comparison: '이전 같은 요일 구성 대비' };
  }
  const between = (rows, start, end) => rows.filter(row => row.date >= start && row.date <= end);
  const completeDates = (start, end) => coverage.filter(row => row.date >= start && row.date <= end && row.open && row.status === 'valid' && row.plannedMinutes === row.analyzedMinutes).map(row => row.date);
  function seoulClock(now = new Date()) {
    const local = new Date(now.getTime() + 9 * 3600000);
    return { date: iso(local), hour: local.getUTCHours(), minute: local.getUTCMinutes() };
  }
  function financialIndex(now = new Date()) {
    const today = seoulClock(now).date;
    const latest = records.filter(row => row.date <= today).reduce((date, row) => row.date > date ? row.date : date, '');
    if (!latest) return { today, asOf: null, value: null, previousValue: null, stale: true };
    const start = shift(latest, -29), previousEnd = shift(start, -1), previousStart = shift(start, -30);
    const average = (from, to) => {
      const rows = analyze({ start: from, end: to, previousStart: shift(from, -30), previousEnd: shift(from, -1) }).daily;
      if (rows.length !== 30 || rows.some(row => row.sales <= 0)) return null;
      return sum(rows, row => Math.max(0, Math.min(100, 100 - row.expense / row.sales * 100))) / 30;
    };
    return { today, asOf: latest, start, previousStart, previousEnd,
      value: average(start, latest), previousValue: average(previousStart, previousEnd), stale: latest < today };
  }
  function analyze(period) {
    const pos = between(records, period.start, period.end);
    const previous = between(records, period.previousStart, period.previousEnd);
    const costs = between(expenses, period.start, period.end);
    const oldCosts = between(expenses, period.previousStart, period.previousEnd);
    const local = between(area, period.start, period.end), oldArea = between(area, period.previousStart, period.previousEnd);
    const connected = merchantSales.filter(row => row.serviceConnected && row.district === '대구 중구 시연 상권');
    const localMerchants = between(connected, period.start, period.end), oldMerchants = between(connected, period.previousStart, period.previousEnd);
    const front = between(storefront, period.start, period.end);
    const oldFront = between(storefront, period.previousStart, period.previousEnd);
    const paid = between(transactions, period.start, period.end).filter(row => row.status === 'paid');
    const sales = sum(pos, row => row.netAmount), expense = sum(costs, row => row.amount);
    const previousSales = sum(previous, row => row.netAmount), previousExpense = sum(oldCosts, row => row.amount);
    const expectedPreviousDays = (Date.parse(period.previousEnd) - Date.parse(period.previousStart)) / DAY + 1;
    const comparisonAvailable = expectedPreviousDays > 0 && completeDates(period.previousStart, period.previousEnd).length === expectedPreviousDays;
    const rawSlots = twoHourStarts.map(hour => ({
      hour, label: hour + '~' + (hour + 2) + '시',
      traffic: sum(local.filter(r => r.hour >= hour && r.hour < hour + 2), r => r.traffic),
      card: sum(local.filter(r => r.hour >= hour && r.hour < hour + 2), r => r.cardAmount),
      sales: sum(pos.filter(r => r.hour >= hour && r.hour < hour + 2), r => r.netAmount),
      storefront: sum(front.filter(r => r.hour >= hour && r.hour < hour + 2), r => r.passersby)
    }));
    const maxTraffic = Math.max(1, ...rawSlots.map(r => r.traffic)), maxCard = Math.max(1, ...rawSlots.map(r => r.card));
    const slots = rawSlots.map(r => Object.assign({}, r, { trafficIndex: r.traffic / maxTraffic * 100, cardIndex: r.card / maxCard * 100 }));
    const focus = slots.reduce((best, row) => row.sales > best.sales ? row : best, slots[0]);
    const dailyDates = completeDates(period.start, period.end);
    const daily = dailyDates.map(date => ({ date, sales: sum(pos.filter(r => r.date === date), r => r.netAmount), expense: sum(costs.filter(r => r.date === date), r => r.amount) }));
    const byCategory = categories.map(([id, name]) => ({ id, name, amount: sum(costs.filter(r => r.category === id), r => r.amount), previous: sum(oldCosts.filter(r => r.category === id), r => r.amount) }));
    const topPurchases = materials.map(item => Object.assign({}, item, {
      amount: sum(between(purchases, period.start, period.end).filter(r => r.itemId === item.id), r => r.amount),
      quantity: sum(between(purchases, period.start, period.end).filter(r => r.itemId === item.id), r => r.quantity)
    })).sort((a, b) => b.amount - a.amount);
    const byWeekday = [1, 2, 3, 4, 5, 6, 0].map(day => {
      const days = daily.filter(r => new Date(r.date + 'T00:00:00Z').getUTCDay() === day);
      return { day, label: ['일', '월', '화', '수', '목', '금', '토'][day], count: days.length, sales: days.length ? sum(days, r => r.sales) / days.length : null };
    });
    const weekdaySlots = byWeekday.map(row => {
      const matches = r => new Date(r.date + 'T00:00:00Z').getUTCDay() === row.day;
      return { label: row.label + '요일', sales: row.sales, traffic: row.count ? sum(local.filter(matches), r => r.traffic) / row.count : null,
        card: row.count ? sum(local.filter(matches), r => r.cardAmount) / row.count : null,
        storefront: row.count ? sum(front.filter(matches), r => r.passersby) / row.count : null };
    });
    const passersby = sum(front, row => row.passersby), entrants = sum(front, row => row.entrants);
    const entryRate = ratio(entrants, passersby), purchaseRate = ratio(paid.length, entrants);
    const previousEntryRate = comparisonAvailable ? ratio(sum(oldFront, row => row.entrants), sum(oldFront, row => row.passersby)) : null;
    const previousPurchaseRate = comparisonAvailable ? ratio(sum(oldFront, row => row.validPayments), sum(oldFront, row => row.entrants)) : null;
    return {
      period, pos, daily, byWeekday, sales, expense, previousSales, previousExpense, comparisonAvailable,
      average: daily.length ? sales / daily.length : null, transactions: paid.length, customerAverage: paid.length ? sales / paid.length : null,
      passersby, entrants, entryRate, purchaseRate, estimatedPurchaseRate: purchaseRate, previousEntryRate, previousPurchaseRate,
      entryRateDelta: entryRate != null && previousEntryRate != null ? entryRate - previousEntryRate : null,
      purchaseRateDelta: purchaseRate != null && previousPurchaseRate != null ? purchaseRate - previousPurchaseRate : null,
      delta: sales - expense, expenseRatio: sales ? expense / sales * 100 : null,
      salesRate: comparisonAvailable ? rate(sales, previousSales) : null,
      expenseRate: comparisonAvailable ? rate(expense, previousExpense) : null,
      cardRate: comparisonAvailable ? rate(sum(local, r => r.cardAmount), sum(oldArea, r => r.cardAmount)) : null,
      merchantRate: comparisonAvailable ? rate(sum(localMerchants, r => r.amount), sum(oldMerchants, r => r.amount)) : null,
      merchantConsumption: sum(localMerchants, r => r.amount), merchantCount: new Set(localMerchants.map(r => r.storeId)).size,
      trafficRate: comparisonAvailable ? rate(sum(local, r => r.traffic), sum(oldArea, r => r.traffic)) : null,
      soldUnits: sum(pos, r => r.netQuantity), cancellations: sum(pos, r => r.cancellations),
      slots, weekdaySlots, focus, byCategory, topPurchases, sourceType: 'synthetic_demo',
      dataStatus: pos.length ? 'available' : 'no_data',
      action: focus.label + ' 판매가 집중됩니다. 재료 준비와 주문 대기 기록을 함께 확인해 보세요.'
    };
  }
  function operatingPeriod(now = new Date()) {
    const today = seoulClock(now).date;
    const end = records.filter(row => row.date <= today).reduce((date, row) => row.date > date ? row.date : date, '');
    return end ? { start: shift(end, -29), end, today } : null;
  }
  function guidance(hour, now = new Date()) {
    const period = operatingPeriod(now);
    const reference = period ? between(records, period.start, period.end) : [];
    const count = period ? completeDates(period.start, period.end).length : 0;
    if (count < 30) return { title: '운영 안내 자료를 기다리고 있어요', text: '최근 30일의 판매 기록이 준비되면 시간대별 안내를 제공합니다.', average: null, share: null, count, period };
    const totals = hours.map(h => ({ hour: h, amount: sum(reference.filter(r => r.hour === h), r => r.netAmount) / count }));
    const row = totals.find(r => r.hour === hour);
    if (!row) return { title: '영업 준비와 마감을 확인하세요', text: '가상 고깃집은 매일 17~23시에 영업합니다.', average: null, share: null, count, period };
    const dailyAverage = sum(totals, r => r.amount);
    if (dailyAverage <= 0) return { title: '판매 기록을 확인해 주세요', text: '비교할 매출이 없어 시간대별 행동을 제안하지 않습니다.', average: null, share: null, count, period };
    const sorted = totals.map(r => r.amount).sort((a, b) => a - b);
    const quiet = row.amount <= sorted[1];
    const remaining = totals.filter(r => r.hour > hour);
    const nextPeak = (remaining.length ? remaining : totals).reduce((best, r) => r.amount > best.amount ? r : best);
    const nextLabel = (remaining.length ? '' : '다음 영업일 ') + nextPeak.hour + '~' + (nextPeak.hour + 1) + '시';
    const opening = hour === 17;
    return {
      title: opening ? '첫 손님 맞이와 주문 응대를 준비하세요.' : quiet ? '결제 기록과 현재 영업 상황을 함께 확인하세요.' : '판매에 맞춰 재료와 응대를 점검하세요.',
      text: opening ? '17~18시는 개점 직후입니다. 시연 자료는 입장 후 40~60분 뒤 결제하므로 낮은 결제 매출이 한산함을 뜻하지 않습니다. 입장 손님과 주문 준비를 먼저 확인하세요.'
        : quiet ? '최근 30일에서 결제 매출이 상대적으로 적은 시간입니다. 식사 후 결제하는 시차가 있으므로 손님이 적다고 단정하지 말고 입장과 주문 대기를 함께 확인하세요.'
          : '최근 30일 기록에서 결제가 이어지는 시간대입니다. 현재 입장 손님, 재료와 주문 대기를 함께 확인하세요.',
      average: row.amount, share: row.amount / dailyAverage * 100, count, period, quiet, opening, nextPeak,
      checks: [opening
        ? { title: '지금 · 첫 손님과 주문을 맞이하세요.', detail: '테이블, 구이류 준비 상태와 첫 주문의 응대 순서를 확인하세요.' }
        : quiet ? { title: '지금 · 입장과 주문 대기를 확인하세요.', detail: '결제 금액만으로 한가함을 판단하지 말고 실제 매장 상황에 맞춰 역할을 나누세요.' }
          : { title: '지금 · 주력 메뉴와 응대를 점검하세요.', detail: '준비 수량과 주문 대기 상황을 확인하고 역할을 나누세요.' },
        { title: '다음 · ' + nextLabel + ' 판매에 대비하세요.', detail: (remaining.length ? '남은 시간 중' : '하루 중') + ' 과거 결제 매출이 가장 높았던 구간입니다. 현재 혼잡도나 미래 수요를 확정하는 값은 아닙니다.' }]
    };
  }
  function neighborhoodInsights(now = new Date()) {
    const period = operatingPeriod(now), today = seoulClock(now).date;
    const weekday = new Date(today + 'T00:00:00Z').getUTCDay();
    const weekdayLabel = ['일', '월', '화', '수', '목', '금', '토'][weekday] + '요일';
    const local = period ? between(area, period.start, period.end) : [];
    const merchants = period ? between(merchantSales, period.start, period.end).filter(row => row.serviceConnected && row.district === '대구 중구 시연 상권') : [];
    // Compare the same observed days for both sources; absent days are not zero-sales days.
    const merchantDates = new Set(merchants.map(row => row.date));
    const dates = new Set(local.filter(row => merchantDates.has(row.date)).map(row => row.date));
    const sameDates = new Set([...dates].filter(date => new Date(date + 'T00:00:00Z').getUTCDay() === weekday));
    if (dates.size < 30 || !sameDates.size) return { today, weekdayLabel, period, count: 0, slots: [] };
    const sameLocal = local.filter(row => sameDates.has(row.date)), sameMerchants = merchants.filter(row => sameDates.has(row.date));
    const slots = twoHourStarts.map(hour => ({ hour, label: hour + '~' + (hour + 2) + '시',
      traffic: sum(sameLocal.filter(r => r.hour >= hour && r.hour < hour + 2), r => r.traffic) / sameDates.size,
      consumption: sum(sameMerchants.filter(r => r.hour >= hour && r.hour < hour + 2), r => r.amount) / sameDates.size }));
    const traffic = sum(slots, r => r.traffic), consumption = sum(slots, r => r.consumption);
    return { today, weekdayLabel, period, count: sameDates.size, slots, traffic, consumption,
      merchantCount: new Set(sameMerchants.map(r => r.storeId)).size,
      trafficRate: rate(traffic, sum(local.filter(r => dates.has(r.date)), r => r.traffic) / dates.size),
      consumptionRate: rate(consumption, sum(merchants.filter(r => dates.has(r.date)), r => r.amount) / dates.size) };
  }
  function salesInsight(period, now = new Date()) {
    const clock = seoulClock(now), analysis = analyze(period);
    const slot = analysis.slots.find(row => clock.hour >= row.hour && clock.hour < row.hour + 2);
    if (!slot) return { clock, status: 'off_hours' };
    const salesDays = analysis.daily.length;
    const frontDays = new Set(between(storefront, period.start, period.end).filter(row => row.hour >= slot.hour && row.hour < slot.hour + 2).map(row => row.date)).size;
    if (!salesDays || analysis.sales <= 0) return { clock, slot, status: 'no_data' };
    const share = slot.sales / analysis.sales * 100;
    const quiet = slot.sales <= analysis.slots.map(row => row.sales).sort((a, b) => a - b)[1];
    return { clock, slot, status: 'available', salesDays, frontDays,
      salesAverage: slot.sales / salesDays, storefrontAverage: frontDays ? slot.storefront / frontDays : null, share,
      title: quiet ? '매출 비중이 낮은 시간대입니다.' : '판매 준비와 주문 응대를 점검하세요.',
      action: quiet ? '주문 응대를 유지하며 재료 보충과 정비 시간을 나누세요.' : '주력 메뉴의 준비 수량과 주문 대기 상황을 확인하세요.' };
  }
  const policyTitles = ['소상공인 운영자금', '골목상권 점포 환경개선', '전통시장 디지털 전환', '소상공인 창업 준비', '골목상권 공동 홍보', '전통시장 온라인 판매', '소상공인 경영 교육', '골목상권 청년 창업', '전통시장 협업', '소상공인 비용 관리'];
  const policies = policyTitles.map((name, i) => ({
    id: i + 1, title: name + ' · 예시', category: i % 3 === 0 ? '창업' : '금융',
    region: '대구', industry: i % 4 === 0 ? '전체 업종' : '음식점',
    maxEmployees: i % 2 === 0 ? 5 : null, ageMin: i === 7 ? 19 : null, ageMax: i === 7 ? 39 : null,
    sourceType: 'synthetic_demo', score: null
  }));
  function recoverySlots(date) {
    return twoHourStarts.map(hour => {
      const rows = cctvRows.filter(row => row.date === date && row.hour >= hour && row.hour < hour + 2 && row.status === 'valid');
      return { id: hour + '-' + (hour + 2), label: hour + '~' + (hour + 2) + '시', passersby: sum(rows, row => row.passers),
        dwellers: sum(rows, row => row.dwellers), entrants: sum(rows, row => row.entrants), validPayments: sum(rows, row => row.validPayments), netSales: sum(rows, row => row.netSales) };
    });
  }
  const recoveryScenario = {
    analysisDate: '2026-09-03',
    storeStatus: 'open',
    sourceType: 'synthetic_demo',
    dataStatus: 'comparable_demo',
    conversionScope: 'in_store_only_demo',
    opportunitySlotId: '19-21',
    opportunitySelection: {
      status: 'scenario_selected',
      ruleVersion: null,
      note: '가상 고깃집에서 점검할 시간으로 선택했습니다. 자동 기회 점수나 효과 예측이 아닙니다.'
    },
    slots: recoverySlots('2026-09-03'),
    diagnosis: {
      type: 'operating_check',
      status: 'factor_candidate',
      title: '저녁 판매와 매장 유입을 함께 확인하세요.',
      explanation: '선택 시간의 주문 대기와 메뉴 준비 기록을 함께 확인해 운영 상태를 점검하세요.',
      ruleVersion: null
    },
    actions: [
      { time: '16:30', title: '주력 구이류 준비량 점검', detail: '최근 같은 요일의 판매량과 실제 재고를 함께 확인합니다.' },
      { time: '19:00~21:00', title: '주문 응대와 대기 기록', detail: '대기 상황과 품절 여부를 기록하고 필요한 역할을 나눕니다.' },
      { time: '7일 후', title: '같은 조건으로 전후 비교', detail: '같은 요일·시간의 매출·입장·유효 결제를 비교합니다. 변화가 실행 때문이라고 단정하지 않습니다.' }
    ],
    comparison: {
      status: 'waiting',
      baselineLabel: '실행 전',
      actionLabel: '재료 준비 + 주문 대기 점검',
      followUpDate: '2026-09-10',
      followUpMetrics: null,
      note: '7일 후 같은 요일·시간대의 집계가 준비되면 비교합니다.'
    },
    supportingEvidence: {
      mapStatus: 'not_connected',
      competitorStatus: 'not_connected',
      eventStatus: 'not_connected'
    }
  };
  const ratio = (numerator, denominator) => denominator > 0 ? numerator / denominator * 100 : null;
  // Explicit prior-month generated observations; never substitute the seven-day follow-up.
  recoveryScenario.history = ['2026-08-06', '2026-08-13', '2026-08-20', '2026-08-27'].flatMap(date =>
    recoverySlots(date).map(row => ({ ...row, date, sourceType: 'synthetic_demo' })));
  function analyzeRecovery(scenario = recoveryScenario) {
    const date = new Date(scenario.analysisDate + 'T00:00:00Z');
    const previousMonth = iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1))).slice(0, 7);
    const history = (scenario.history || []).filter(row => row.date.slice(0, 7) === previousMonth &&
      new Date(row.date + 'T00:00:00Z').getUTCDay() === date.getUTCDay());
    const slots = scenario.slots.map(row => {
      const baseline = history.filter(old => old.id === row.id);
      const previousEntryRate = ratio(sum(baseline, r => r.entrants), sum(baseline, r => r.passersby));
      const previousPurchaseRate = ratio(sum(baseline, r => r.validPayments), sum(baseline, r => r.entrants));
      const entryRate = ratio(row.entrants, row.passersby);
      const estimatedPurchaseRate = ratio(row.validPayments, row.entrants);
      return Object.assign({}, row, {
        comparisonDates: baseline.map(r => r.date), previousEntryRate, previousPurchaseRate,
        entryRateDelta: previousEntryRate === null || entryRate === null ? null : entryRate - previousEntryRate,
        purchaseRateDelta: previousPurchaseRate === null || estimatedPurchaseRate === null ? null : estimatedPurchaseRate - previousPurchaseRate,
        dwellRate: ratio(row.dwellers, row.passersby), entryRate, estimatedPurchaseRate,
        averageTicket: row.validPayments > 0 ? row.netSales / row.validPayments : null
      });
    });
    const opportunity = slots.find(row => row.id === scenario.opportunitySlotId) || null;
    return {
      analysisDate: scenario.analysisDate,
      storeStatus: scenario.storeStatus,
      sourceType: scenario.sourceType,
      dataStatus: scenario.dataStatus,
      conversionScope: scenario.conversionScope,
      opportunitySelection: Object.assign({}, scenario.opportunitySelection),
      opportunity,
      slots,
      diagnosis: Object.assign({}, scenario.diagnosis),
      actions: scenario.actions.map(row => Object.assign({}, row)),
      comparison: Object.assign({}, scenario.comparison),
      supportingEvidence: Object.assign({}, scenario.supportingEvidence)
    };
  }
  const api = {
    records, transactions, cctvRows, coverage, expenses, purchases, area, merchantSales, storefront, periods, categories, menu, materials, policies, recoveryScenario,
    analyze, analyzeRecovery, customPeriod, guidance, operatingPeriod, neighborhoodInsights, salesInsight, shift, rate, seoulClock, financialIndex,
    timeSlots, hours, twoHourStarts, dataStart, dataEnd, completeDates,
    profile: { name: '이소현', storeName: '달구벌 고기마당', region: '대구 중구', industry: '음식점', employees: 3, age: '', ageBand: '50대', address: '', phone: '', email: '', businessNumber: '', opened: '' },
    business: { fictional: true, description: '50대 이소현 사장님이 운영하는 가상의 동네 고깃집', openingHours: '매일 17:00~23:00', openingDays: [1, 2, 3, 4, 5, 6, 0], detailedAddress: null, priceNote: '메뉴와 가격은 기능 시연을 위한 가상 설정입니다.' },
    generatedLabel: '가상 고깃집 시연 자료', referenceDate: '2026-09-03',
    expenseScenario: { sourceType: 'synthetic_demo', note: '가상의 고깃집 운영비 설정이며 업종 평균이 아닙니다. 매입량·단가와 월 고정지출을 원자료에 반영합니다.', monthlyFixed: { rent: 2300000, maintenance: 1100000, labor: 12000000, other: 2400000 } },
    sources: { pos: '가상 고깃집 10분 결제·판매 자료', expenses: '가상 지출·매입 자료; 매출원가·순이익 아님', area: '가상 주변 상권 자료', cctv: '공통 시연자료의 10분 통행·체류·입장 집계', recovery: '동일 고깃집 시연자료의 CCTV·결제 합산', policies: '화면 구성용 가상 공고' }
  };
  root.IM_MEETING_DEMO = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
