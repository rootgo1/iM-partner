(function (root) {
  'use strict';
  const day = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? Date.parse(value + 'T00:00:00Z') : null;
  const present = value => value !== '' && value !== null && value !== undefined;
  const includes = (value, words) => words.some(word => String(value || '').includes(word));
  function availability(item, checkedAt) {
    const today = day(checkedAt), start = day(item.startsAt || item.startDate), end = day(item.deadline || item.endDate);
    if (item.status === 'closed' || (today !== null && end !== null && end < today)) return { label: '접수 마감', tone: 'closed', eligible: false, days: null };
    if (today !== null && start !== null && start > today) return { label: '접수 예정', tone: 'upcoming', eligible: true, days: null };
    if (item.status === 'budget') return { label: '잔여 예산 확인', tone: 'review', eligible: true, days: null };
    if (today !== null && end !== null) {
      const days = Math.round((end - today) / 86400000);
      return { label: days === 0 ? '오늘 마감' : 'D−' + days, tone: 'open', eligible: true, days };
    }
    return { label: '접수 일정 확인', tone: 'review', eligible: true, days: null };
  }
  function matches(item, profile) {
    const conditions = item.conditions || {}, regions = conditions.regions || [], districts = conditions.districts || [];
    const industries = conditions.industries || [];
    const nationwide = item.regionScope === 'nationwide' || regions.includes('전국');
    const regionMatch = nationwide || (includes(profile.region, regions.length ? regions : [item.region || '대구']) && (!districts.length || includes(profile.region, districts)));
    const industryKnown = !!profile.industry;
    const industryMatch = !industries.length || includes(profile.industry, industries) || (industries.some(name => /음식|외식/.test(name)) && /음식|외식/.test(profile.industry));
    const maxEmployees = conditions.maxEmployees;
    const minAge = conditions.minAge, maxAge = conditions.maxAge;
    return [
      { name: '지역', status: !profile.region ? '확인 필요' : regionMatch ? '일치' : '불일치', detail: item.region + (districts.length ? ' ' + districts.join('·') : '') },
      { name: '업종', status: !industryKnown ? '확인 필요' : !industries.length ? '세부 요건 확인' : industryMatch ? '일치' : '불일치', detail: item.industry || '공고 대상 확인' },
      { name: '직원 수', status: !present(maxEmployees) ? '별도 조건 확인' : !present(profile.employees) ? '확인 필요' : Number(profile.employees) <= Number(maxEmployees) ? '일치' : '불일치', detail: present(maxEmployees) ? maxEmployees + '명 이하' : '소상공인 규모·제외 요건 확인' },
      { name: '대표자 나이', status: !present(minAge) && !present(maxAge) ? '연령 제한 미기재' : !present(profile.age) ? '확인 필요' : (!present(minAge) || Number(profile.age) >= Number(minAge)) && (!present(maxAge) || Number(profile.age) <= Number(maxAge)) ? '일치' : '불일치', detail: [present(minAge) ? minAge + '세 이상' : '', present(maxAge) ? maxAge + '세 이하' : ''].filter(Boolean).join(' · ') || '원문 기준' }
    ];
  }
  function recommendations(items, profile, checkedAt, limit) {
    return items.filter(item => availability(item, checkedAt).eligible && !matches(item, profile).some(match => match.status === '불일치'))
      .slice().sort((a, b) => {
        const score = item => (Number(item.priority) || 0) + (item.regionScope === 'daegu' ? 15 : 0) + (availability(item, checkedAt).tone === 'open' ? 10 : 0) - (item.eligibilityFlags || []).length * 15;
        return score(b) - score(a) || String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')) || String(a.id).localeCompare(String(b.id));
      }).slice(0, limit === undefined ? 10 : limit);
  }
  function filter(items, keyword, category) {
    const query = String(keyword || '').trim().toLocaleLowerCase('ko-KR');
    return items.filter(item => (!category || category === 'all' || item.category === category) && (!query || [item.title, item.agency, item.summary, item.target].join(' ').toLocaleLowerCase('ko-KR').includes(query)));
  }
  const api = { availability, matches, recommendations, filter };
  root.IM_POLICY_MATCHING = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'object' ? window : globalThis);
