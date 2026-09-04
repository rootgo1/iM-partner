/* Deterministic synthetic records for the local HTML preview. No real POS/API data. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const iso = date => new Date(date).toISOString().slice(0, 10);
  const shift = (date, days) => iso(Date.parse(date + 'T00:00:00Z') + days * DAY);
  const sum = (rows, fn) => rows.reduce((n, row) => n + fn(row), 0);
  const rate = (value, previous) => previous === 0 ? null : (value - previous) / previous * 100;
  const hours = Array.from({ length: 12 }, (_, i) => i + 8);
  const menu = [
    { id: 'meal', name: '한 끼 정식', price: 9000, share: 0.52 },
    { id: 'noodle', name: '잔치국수', price: 6500, share: 0.29 },
    { id: 'dumpling', name: '만두', price: 5000, share: 0.19 }
  ];
  const materials = [
    { id: 'pork', name: '돼지고기', unit: 'kg', price: 12600, amount: 4.2 },
    { id: 'vegetable', name: '채소류', unit: 'kg', price: 4800, amount: 7 },
    { id: 'rice', name: '쌀', unit: 'kg', price: 2700, amount: 8 },
    { id: 'noodles', name: '면류', unit: 'kg', price: 3900, amount: 4.4 }
  ];
  const categories = [
    ['rent', '월세'], ['maintenance', '관리비'], ['purchase', '매입비'],
    ['labor', '인건비'], ['other', '기타 지출']
  ];
  const records = [], expenses = [], purchases = [], area = [];
  const demand = [2, 3, 5, 10, 16, 13, 4, 3, 8, 16, 20, 12];
  const flow = [20, 29, 45, 77, 120, 111, 46, 38, 67, 80, 92, 55];
  const spend = [12, 20, 38, 62, 49, 44, 22, 20, 57, 91, 110, 77];
  for (let date = '2026-07-01'; date <= '2026-09-02'; date = shift(date, 1)) {
    const d = Number(date.slice(-2)), weekday = new Date(date + 'T00:00:00Z').getUTCDay();
    const current = date >= '2026-08-01';
    const factor = (weekday === 0 || weekday === 6 ? 1.14 : 1) * (current ? 0.94 : 1.06);
    hours.forEach((hour, index) => {
      menu.forEach((item, m) => {
        const quantity = Math.max(0, Math.round(demand[index] * item.share * factor + ((d + index + m) % 3 - 1)));
        const cancellations = quantity > 3 && (d + hour + m) % 19 === 0 ? 1 : 0;
        records.push({
          id: date + '-' + hour + '-' + item.id, date, hour, itemId: item.id,
          quantity, cancellations, netQuantity: quantity - cancellations,
          unitPrice: item.price, netAmount: (quantity - cancellations) * item.price,
          sourceType: 'synthetic_demo'
        });
      });
      const modulation = 1 + ((d + index) % 5 - 2) * 0.012;
      area.push({
        date, hour,
        traffic: Math.round(flow[index] * modulation * (current ? 1.052 : 1)),
        cardAmount: Math.round(spend[index] * 1000 * modulation * (current ? 0.924 : 1)),
        sourceType: 'synthetic_demo'
      });
    });
    materials.forEach((item, i) => {
      const quantity = +(item.amount + ((d + i) % 3) * 0.3).toFixed(1);
      const amount = Math.round(quantity * item.price * (current ? 1.18 : 1));
      purchases.push({ date, itemId: item.id, quantity, unit: item.unit, amount });
      expenses.push({ date, category: 'purchase', amount });
    });
    const monthDays = date.slice(0, 7) === '2026-09' ? 30 : 31;
    [['rent', 1700000], ['maintenance', 220000], ['labor', 4900000], ['other', current ? 590000 : 510000]].forEach(([category, total]) => {
      expenses.push({ date, category, amount: Math.floor(total / monthDays) + (d <= total % monthDays ? 1 : 0) });
    });
  }
  const periods = {
    month: { start: '2026-08-01', end: '2026-08-31', previousStart: '2026-07-01', previousEnd: '2026-07-31', label: '2026년 8월', comparison: '2026년 7월 대비' },
    week: { start: '2026-08-27', end: '2026-09-02', previousStart: '2026-08-20', previousEnd: '2026-08-26', label: '최근 7일', comparison: '직전 7일 대비' }
  };
  function customPeriod(start, end) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
        start > end || start < '2026-07-01' || end > '2026-09-02') return null;
    if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || iso(start) !== start || iso(end) !== end) return null;
    const count = (Date.parse(end) - Date.parse(start)) / DAY + 1;
    return { start, end, previousStart: shift(start, -count), previousEnd: shift(start, -1), label: start + ' ~ ' + end, comparison: '직전 동일 일수 대비' };
  }
  const between = (rows, start, end) => rows.filter(row => row.date >= start && row.date <= end);
  function analyze(period) {
    const pos = between(records, period.start, period.end);
    const previous = between(records, period.previousStart, period.previousEnd);
    const costs = between(expenses, period.start, period.end);
    const oldCosts = between(expenses, period.previousStart, period.previousEnd);
    const local = between(area, period.start, period.end), oldArea = between(area, period.previousStart, period.previousEnd);
    const sales = sum(pos, row => row.netAmount), expense = sum(costs, row => row.amount);
    const previousSales = sum(previous, row => row.netAmount), previousExpense = sum(oldCosts, row => row.amount);
    const comparisonAvailable = period.previousStart >= '2026-07-01' && previous.length > 0;
    const rawSlots = [8, 10, 12, 14, 16, 18].map(hour => ({
      hour, label: hour + '~' + (hour + 2) + '시',
      traffic: sum(local.filter(r => r.hour >= hour && r.hour < hour + 2), r => r.traffic),
      card: sum(local.filter(r => r.hour >= hour && r.hour < hour + 2), r => r.cardAmount),
      sales: sum(pos.filter(r => r.hour >= hour && r.hour < hour + 2), r => r.netAmount)
    }));
    const maxTraffic = Math.max(1, ...rawSlots.map(r => r.traffic)), maxCard = Math.max(1, ...rawSlots.map(r => r.card));
    const slots = rawSlots.map(r => Object.assign({}, r, { trafficIndex: r.traffic / maxTraffic * 100, cardIndex: r.card / maxCard * 100 }));
    const focus = slots.reduce((best, row) => row.trafficIndex - row.cardIndex > best.trafficIndex - best.cardIndex ? row : best, slots[0]);
    const dailyDates = Array.from(new Set(pos.map(row => row.date)));
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
    return {
      period, pos, daily, byWeekday, sales, expense, previousSales, previousExpense, comparisonAvailable,
      delta: sales - expense, expenseRatio: sales ? expense / sales * 100 : null,
      salesRate: comparisonAvailable ? rate(sales, previousSales) : null,
      expenseRate: comparisonAvailable ? rate(expense, previousExpense) : null,
      cardRate: comparisonAvailable ? rate(sum(local, r => r.cardAmount), sum(oldArea, r => r.cardAmount)) : null,
      trafficRate: comparisonAvailable ? rate(sum(local, r => r.traffic), sum(oldArea, r => r.traffic)) : null,
      soldUnits: sum(pos, r => r.netQuantity), cancellations: sum(pos, r => r.cancellations),
      slots, focus, byCategory, topPurchases, sourceType: 'synthetic_demo',
      dataStatus: pos.length ? 'available' : 'no_data',
      action: focus.label + ' 대표 메뉴 노출과 안내 문구를 점검하고, 변경 전후 판매 기록을 비교해 보세요.'
    };
  }
  function guidance(hour) {
    const reference = between(records, periods.week.start, periods.week.end);
    const totals = hours.map(h => ({ hour: h, amount: sum(reference.filter(r => r.hour === h), r => r.netAmount) / 7 }));
    const row = totals.find(r => r.hour === hour);
    if (!row) return { title: '해당 시간의 판매 자료가 없어요', text: '생성 POS는 08~20시 구간입니다. 시간대를 선택해 안내 시안을 확인해 보세요.', average: null, count: 0 };
    const sorted = totals.map(r => r.amount).sort((a, b) => a - b);
    const quiet = row.amount <= sorted[3];
    return {
      title: quiet ? '한가한 시간, 다음 영업을 준비하세요' : '판매가 이어지는 시간, 준비 상태를 점검하세요',
      text: quiet ? '식사·청소·장보기 시간을 검토해 보세요. 시연 자료에서 일평균 매출이 낮은 4개 시간에 해당합니다.' : '대표 메뉴 재료와 주문 응대를 점검해 보세요. 실제 수요 예측이 아닌 지난 7일 생성 기록의 참고 안내입니다.',
      average: row.amount, count: 7
    };
  }
  const policyTitles = ['소상공인 운영자금', '골목상권 점포 환경개선', '전통시장 디지털 전환', '소상공인 창업 준비', '골목상권 공동 홍보', '전통시장 온라인 판매', '소상공인 경영 교육', '골목상권 청년 창업', '전통시장 협업', '소상공인 비용 관리'];
  const policies = policyTitles.map((name, i) => ({
    id: i + 1, title: name + ' · 예시', category: i % 3 === 0 ? '창업' : '금융',
    region: '대구', industry: i % 4 === 0 ? '전체 업종' : '음식점',
    maxEmployees: i % 2 === 0 ? 5 : null, ageMin: i === 7 ? 19 : null, ageMax: i === 7 ? 39 : null,
    sourceType: 'synthetic_demo', score: null
  }));
  const recoveryScenario = {
    analysisDate: '2026-09-03',
    storeStatus: 'open',
    sourceType: 'synthetic_demo',
    dataStatus: 'comparable_demo',
    conversionScope: 'in_store_only_demo',
    opportunitySlotId: '18-20',
    opportunitySelection: {
      status: 'scenario_selected',
      ruleVersion: null,
      note: '기능 검토용 생성 시나리오에서 선택한 시간대입니다. 자동 선정 산식과 임계값은 아직 확정되지 않았습니다.'
    },
    slots: [
      { id: '08-10', label: '08~10시', passersby: 126, dwellers: 34, entrants: 9, validPayments: 6, netSales: 93000 },
      { id: '10-12', label: '10~12시', passersby: 164, dwellers: 48, entrants: 13, validPayments: 9, netSales: 144000 },
      { id: '12-14', label: '12~14시', passersby: 218, dwellers: 79, entrants: 19, validPayments: 14, netSales: 222000 },
      { id: '14-16', label: '14~16시', passersby: 146, dwellers: 36, entrants: 12, validPayments: 8, netSales: 116000 },
      { id: '16-18', label: '16~18시', passersby: 207, dwellers: 58, entrants: 24, validPayments: 18, netSales: 297000 },
      { id: '18-20', label: '18~20시', passersby: 310, dwellers: 74, entrants: 21, validPayments: 14, netSales: 286000 }
    ],
    diagnosis: {
      type: 'traffic_to_entry_gap',
      status: 'factor_candidate',
      title: '통행량 대비 매장 유입이 낮습니다.',
      explanation: '사람이 적어서라기보다 매장 외부에서 메뉴와 혜택이 충분히 눈에 띄지 않았을 가능성을 먼저 점검해 보세요.',
      ruleVersion: null
    },
    actions: [
      { time: '17:30', title: '대표 메뉴 입간판 노출', detail: '대표 메뉴와 가격을 매장 앞에서 한눈에 확인할 수 있도록 표시합니다.' },
      { time: '18:00~20:00', title: '2인 세트 혜택 안내', detail: '적용 시간과 조건을 명확히 표시하고 실제 할인율은 운영자가 결정합니다.' },
      { time: '7일 후', title: '같은 조건으로 전후 비교', detail: '같은 요일·시간대의 유입률, 유효 결제 건수, 순매출을 함께 확인합니다.' }
    ],
    comparison: {
      status: 'waiting',
      baselineLabel: '실행 전',
      actionLabel: '입간판 + 2인 세트 안내',
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
  function analyzeRecovery() {
    const slots = recoveryScenario.slots.map(row => Object.assign({}, row, {
      dwellRate: ratio(row.dwellers, row.passersby),
      entryRate: ratio(row.entrants, row.passersby),
      estimatedPurchaseRate: ratio(row.validPayments, row.entrants),
      averageTicket: row.validPayments > 0 ? row.netSales / row.validPayments : null
    }));
    const opportunity = slots.find(row => row.id === recoveryScenario.opportunitySlotId) || null;
    return {
      analysisDate: recoveryScenario.analysisDate,
      storeStatus: recoveryScenario.storeStatus,
      sourceType: recoveryScenario.sourceType,
      dataStatus: recoveryScenario.dataStatus,
      conversionScope: recoveryScenario.conversionScope,
      opportunitySelection: Object.assign({}, recoveryScenario.opportunitySelection),
      opportunity,
      slots,
      diagnosis: Object.assign({}, recoveryScenario.diagnosis),
      actions: recoveryScenario.actions.map(row => Object.assign({}, row)),
      comparison: Object.assign({}, recoveryScenario.comparison),
      supportingEvidence: Object.assign({}, recoveryScenario.supportingEvidence)
    };
  }
  const api = {
    records, expenses, purchases, area, periods, categories, menu, materials, policies, recoveryScenario,
    analyze, analyzeRecovery, customPeriod, guidance, shift, rate,
    profile: { name: '이소현', storeName: '서문시장 음식점', region: '대구 중구', industry: '음식점', employees: 3, age: '', address: '', phone: '', email: '', businessNumber: '', opened: '' },
    generatedLabel: '생성 데이터 기반 시연', referenceDate: '2026-09-03',
    sources: { pos: 'POS 형식의 생성 판매 집계', expenses: '생성 지출·매입 자료', area: '생성 상권 비교 자료', cctv: 'CCTV 형식의 익명 통행·체류·입장 생성 집계', recovery: 'CCTV·POS 결합 기능 검토용 생성 시나리오', policies: '화면 구성용 가상 공고' }
  };
  root.IM_MEETING_DEMO = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
