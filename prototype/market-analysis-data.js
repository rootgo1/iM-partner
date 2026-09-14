/* CCTV analysis-result fixtures. No video, camera stream, tracking service or network is connected. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const shift = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
  const weekday = date => new Date(date + 'T00:00:00Z').getUTCDay();
  const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] || 0), 0);
  const ratio = (a, b) => b > 0 && a != null ? a / b * 100 : null;
  const rate = (a, b) => b > 0 && a != null ? (a - b) / b * 100 : null;
  const dateRange = (start, end) => Array.from({ length: Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1 }, (_, i) => shift(start, i));
  const slots = Array.from({ length: 6 }, (_, i) => ({ id: String(8 + i * 2), hour: 8 + i * 2, label: String(8 + i * 2).padStart(2, '0') + '~' + (10 + i * 2) + '시' }));
  const cameras = [
    { id: 'front', name: '매장 전면', code: 'CAM-01', scope: '가게 앞 보행로와 출입구', entry: true, connected: true },
    { id: 'alley', name: '인접 골목', code: 'CAM-02', scope: '골목 보행로 · 매장 입구는 관측 범위 밖', entry: false, connected: true },
    { id: 'gate', name: '시장 입구 · 연결 전', code: 'CAM-03', scope: '관측 자료 없음', entry: false, connected: false }
  ];
  const rows = [];
  for (let date = '2026-07-01'; date <= '2026-09-02'; date = shift(date, 1)) {
    cameras.filter(camera => camera.connected).forEach(camera => slots.forEach((slot, i) => {
      const d = Number(date.slice(-2)), current = date >= '2026-08-01', weekend = [0, 6].includes(weekday(date));
      const passers = Math.round([126, 164, 218, 146, 207, 310][i] * (camera.id === 'alley' ? 1.42 : 1) * (weekend ? 1.22 : 1) * (1 + ((d + i) % 5 - 2) * .025) * (current ? 1.08 : 1));
      const dwellers = Math.round(passers * [.21, .26, .33, .23, .25, current ? .19 : .27][i]);
      const entrants = camera.entry ? Math.round(passers * [.075, .09, .105, .083, .116, current ? .058 : .088][i]) : null;
      const short = Math.round(dwellers * .53), medium = Math.round(dwellers * .31), long = dwellers - short - medium;
      const directionA = Math.round(passers * ((i >= 4 ? .63 : .46) + (camera.id === 'alley' ? .04 : 0)));
      const status = camera.id === 'alley' && date === '2026-08-26' && i === 5 ? 'missing' : camera.id === 'alley' && date === '2026-08-31' && i === 4 ? 'occluded' : 'valid';
      rows.push({ id: camera.id + ':' + date + ':' + slot.id, cameraId: camera.id, date, slotId: slot.id, status, plannedMinutes: 120, analyzedMinutes: status === 'valid' ? 120 : 0,
        passers: status === 'valid' ? passers : null, dwellers: status === 'valid' ? dwellers : null, entrants: status === 'valid' ? entrants : null,
        directionA: status === 'valid' ? directionA : null, directionB: status === 'valid' ? passers - directionA : null,
        dwellShort: status === 'valid' ? short : null, dwellMedium: status === 'valid' ? medium : null, dwellLong: status === 'valid' ? long : null,
        dwellSeconds: status === 'valid' ? short * 18 + medium * 42 + long * 88 : null, sourceType: 'synthetic_demo' });
    }));
  }
  function summarize(records, entry) {
    const valid = records.filter(row => row.status === 'valid');
    const passers = sum(valid, 'passers'), dwellers = sum(valid, 'dwellers');
    const entrants = entry && valid.length ? sum(valid, 'entrants') : null;
    return { records: valid, passers: valid.length ? passers : null, dwellers: valid.length ? dwellers : null, entrants,
      dwellRate: ratio(dwellers, passers), entryRate: ratio(entrants, passers),
      dwellAverage: dwellers ? sum(valid, 'dwellSeconds') / dwellers : null,
      directionA: valid.length ? sum(valid, 'directionA') : null, directionB: valid.length ? sum(valid, 'directionB') : null,
      dwellBins: [sum(valid, 'dwellShort'), sum(valid, 'dwellMedium'), sum(valid, 'dwellLong')],
      count: valid.length, excluded: records.length - valid.length,
      averagePassers: valid.length ? passers / valid.length : null };
  }
  function analyze(period, filters = {}, source = rows) {
    const camera = cameras.find(row => row.id === filters.camera) || cameras[0];
    const allDates = dateRange(period.start, period.end);
    const offset = filters.comparison === 'weekday' ? Math.ceil(allDates.length / 7) * 7 : allDates.length;
    const previousStart = shift(period.start, -offset), previousEnd = shift(period.end, -offset);
    const matchesDay = date => filters.dayType === 'weekday' ? ![0, 6].includes(weekday(date)) : filters.dayType === 'weekend' ? [0, 6].includes(weekday(date)) : true;
    const dates = allDates.filter(matchesDay), oldDates = dateRange(previousStart, previousEnd).filter(matchesDay);
    const selected = source.filter(row => row.cameraId === camera.id && dates.includes(row.date));
    const oldRows = source.filter(row => row.cameraId === camera.id && oldDates.includes(row.date));
    const current = summarize(selected, camera.entry), old = summarize(oldRows, camera.entry);
    const complete = dates.length > 0 && dates.every(date => slots.every(slot => selected.some(row => row.date === date && row.slotId === slot.id && row.status === 'valid')));
    const oldComplete = oldDates.length > 0 && oldDates.every(date => slots.every(slot => oldRows.some(row => row.date === date && row.slotId === slot.id && row.status === 'valid')));
    const comparable = complete && oldComplete;
    const comparison = comparable ? old : null;
    const bucket = (id, label, predicate) => {
      const a = summarize(selected.filter(predicate), camera.entry), b = summarize(oldRows.filter(predicate), camera.entry);
      return { id, label, ...a, previous: comparable && b.count ? b : null };
    };
    const bySlot = slots.map(slot => bucket(slot.id, slot.label, row => row.slotId === slot.id));
    const byWeekday = [1, 2, 3, 4, 5, 6, 0].map(day => {
      // Exclude incomplete days from weekday daily averages, not as zero-observation days.
      const completeDates = dates.filter(date => weekday(date) === day && slots.every(slot => selected.some(row => row.date === date && row.slotId === slot.id && row.status === 'valid')));
      const beforeDates = oldDates.filter(date => weekday(date) === day);
      const a = summarize(selected.filter(row => completeDates.includes(row.date)), camera.entry);
      const b = summarize(oldRows.filter(row => beforeDates.includes(row.date)), camera.entry);
      return { id: String(day), label: ['일', '월', '화', '수', '목', '금', '토'][day] + '요일', ...a,
        averagePassers: completeDates.length ? a.passers / completeDates.length : null, days: completeDates.length,
        previous: comparable && beforeDates.length ? { ...b, averagePassers: b.passers / beforeDates.length } : null };
    });
    const ranked = bySlot.filter(row => row.averagePassers > 0).slice().sort((a, b) => b.averagePassers - a.averagePassers);
    const peak = ranked[0] || null;
    const entryChange = bySlot.filter(row => row.previous && row.entryRate != null && row.previous.entryRate != null).slice().sort((a, b) => (a.entryRate - a.previous.entryRate) - (b.entryRate - b.previous.entryRate));
    const insights = [];
    if (peak) insights.push({ id: 'peak', kind: 'observation', label: '관측 사실', title: peak.label + '에 통행 관측이 가장 많습니다', text: '같은 시간대 1일 평균 ' + Math.round(peak.averagePassers).toLocaleString('ko-KR') + '건이 관측됐습니다. 선택 조건에서 통행이 가장 집중된 구간입니다.', slotId: peak.id, caveat: '통행이 많다는 사실만으로 매출 기회나 구매 의사를 확정할 수 없습니다.' });
    const weaker = entryChange.find(row => row.entryRate - row.previous.entryRate < -.1);
    if (weaker) insights.push({ id: 'entry-change', kind: 'comparison', label: '기간 비교', title: weaker.label + ' 입장률이 낮아졌습니다', text: '이전 ' + weaker.previous.entryRate.toFixed(1) + '% → 현재 ' + weaker.entryRate.toFixed(1) + '%로 ' + Math.abs(weaker.entryRate - weaker.previous.entryRate).toFixed(1) + '%p 하락했습니다.', slotId: weaker.id, caveat: '메뉴 노출·품절·영업시간 등 원인을 판단할 운영 자료는 아직 없습니다.' });
    const linger = bySlot.filter(row => row.dwellers > 0).slice().sort((a, b) => b.dwellRate - a.dwellRate)[0];
    if (linger) insights.push({ id: 'dwell', kind: 'observation', label: '관측 사실', title: linger.label + '에 머무는 비율이 가장 높습니다', text: '통행 대비 10초 이상 체류 비율은 ' + linger.dwellRate.toFixed(1) + '%입니다. 공간에 머무는 행동이 상대적으로 많이 관측됩니다.', slotId: linger.id, caveat: '대기·대화·상품 관심은 영상 집계만으로 구분하지 않습니다.' });
    const unavailable = dates.flatMap(date => slots.map(slot => ({ date, slotId: slot.id, row: selected.find(row => row.date === date && row.slotId === slot.id) }))).filter(item => !item.row || item.row.status !== 'valid');
    return { period, camera, filters, previousStart, previousEnd, dates, selected, current, comparison, comparable, complete, oldComplete, bySlot, byWeekday, peak, insights,
      expected: dates.length * slots.length, unavailable, observedHours: current.count * 2, sourceType: 'synthetic_demo' };
  }
  const api = { rows, cameras, slots, analyze, summarize, ratio, rate, weekday, shift, start: '2026-07-01', end: '2026-09-02', ruleVersion: 'cctv-demo-1' };
  root.IM_MARKET_DATA = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
