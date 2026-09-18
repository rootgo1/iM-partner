(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  if (root) root.IM_POLICY_DATA = data;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  // Official notice snapshot. Dates and eligibility are not a live application check.
  const checkedAt = '2026-09-18';
  const sourceBase = 'https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=';
  const smallBusinessRule = '소상공인 확인서 발급 가능 여부와 상시근로자 산정 기준을 확인해 주세요.';
  const raw = [
    {
      id: 'PBLN_000000000125880', title: '2026년 2차 스마트상점 기술보급사업 참여 소상공인 모집 공고(구입형ㆍ렌탈형ㆍS/W형)',
      category: '디지털 전환', agency: '소상공인시장진흥공단', region: '전국', publishedAt: '2026-08-27', startsAt: '2026-08-26', deadline: '2026-09-30', status: 'period', priority: 100,
      summary: '매장 운영에 필요한 스마트기술의 구입·대여와 소프트웨어 이용을 지원합니다.', benefit: '스마트기술 구입·렌탈·소프트웨어 구독 지원',
      target: '현재 영업 중이며 소상공인 확인서를 발급받을 수 있는 점포',
      eligibility: ['정상 영업 중인 소상공인 점포', '소상공인 확인서 발급 가능'], checks: ['기술별 지원 한도와 자부담', '기존 수혜 이력 및 지원 제외 업종'], tags: ['스마트상점', '운영 효율', '디지털'], smallBusiness: true
    },
    {
      id: 'EVEN_000000000069458', title: '[대구] 2026년 지역산업 온라인 마케팅 지원사업 AI커머스 실무교육 모집',
      category: '교육·컨설팅', agency: '대구테크노파크', region: '대구', publishedAt: '2026-09-17', startsAt: null, deadline: '2026-11-10', status: 'period', priority: 98,
      periodLabel: '2026.11.10까지 · 회차별 일정 확인', sourceUrl: 'https://www.bizinfo.go.kr/sie/siea/selectSIEA430Detail.do?eventInfoId=EVEN_000000000069458',
      summary: '지역 사업자의 온라인 판매와 홍보에 필요한 AI 활용 실무를 교육합니다.', benefit: 'AI 활용 상품등록·콘텐츠·고객응대·마케팅 교육',
      target: '대구 소재 중소기업·소상공인', eligibility: ['대구 소재 중소기업 또는 소상공인'], checks: ['10.15~11.10 교육 중 희망 회차와 장소', '회차별 잔여 인원 및 접수 종료 여부'], tags: ['온라인 홍보', 'AI', '교육']
    },
    {
      id: 'PBLN_000000000126265', title: '대한상공회의소 무료 경영상담 지원사업 공고',
      category: '교육·컨설팅', agency: '서울상공회의소·코참경영상담센터', region: '전국', publishedAt: '2026-09-08', startsAt: '2026-09-01', deadline: '2026-12-31', status: 'period', priority: 96,
      summary: '매장 운영 중 생긴 세무·노무·법률 등 경영 문제를 전문가와 상담할 수 있습니다.', benefit: '분야별 전문가 무료 상담',
      target: '경영 상담이 필요한 기업·소상공인', eligibility: ['기업 또는 소상공인의 경영 관련 상담'], checks: ['희망 상담 분야와 상담 방식', '방문 상담은 사전 예약'], tags: ['세무', '노무', '법률', '경영']
    },
    {
      id: 'PBLN_000000000123701', title: '[대구] 2026년 대구노동권익센터 인사노무관리 컨설팅 지원 공고',
      category: '고용·노무', agency: '대구노동권익센터', region: '대구', publishedAt: '2026-06-29', status: 'budget', priority: 94, conditions: { maxEmployees: 49 },
      summary: '노무사가 매장을 방문해 근로계약·급여명세 등 인사관리 서류와 운영을 점검합니다.', benefit: '노무사 방문 점검과 맞춤 서식 정비',
      target: '대구 소재 근로자 50명 미만 사업장', eligibility: ['사업장 소재지가 대구', '근로자 50명 미만'], checks: ['현재 모집·예산 잔여 여부', '신청 서류와 방문 일정'], employeeRule: '근로자 50명 미만 사업장', tags: ['노무', '직원 관리', '근로계약']
    },
    {
      id: 'PBLN_000000000123695', title: '[대구] 2026년 취업규칙 제정ㆍ개정 지원사업 공고',
      category: '고용·노무', agency: '대구노동권익센터', region: '대구', publishedAt: '2026-06-29', status: 'budget', priority: 90, conditions: { maxEmployees: 49 },
      summary: '사업장 규모와 운영 방식에 맞춰 취업규칙을 만들거나 기존 규정을 정비합니다.', benefit: '노무사 방문과 취업규칙 작성·수정 상담',
      target: '대구 소재 근로자 50명 미만 사업장', eligibility: ['사업장 소재지가 대구', '근로자 50명 미만'], checks: ['현재 모집·예산 잔여 여부', '기존 취업규칙 유무와 개정 필요 사항'], employeeRule: '근로자 50명 미만 사업장', tags: ['노무', '취업규칙', '운영 관리']
    },
    {
      id: 'PBLN_000000000125166', title: '2026년 디지털커머스 전문기관(소담스퀘어 in 경북) 모집 공고',
      category: '교육·컨설팅', agency: '한국중소벤처기업유통원·소담스퀘어 경북', region: '전국', publishedAt: '2026-08-06', startsAt: '2026-08-05', deadline: '2026-10-30', status: 'period', priority: 89,
      summary: 'AI로 홍보 콘텐츠를 만들고 온라인 판매 역량을 높이는 교육과 상담을 제공합니다.', benefit: 'AI 콘텐츠 실습·디지털 판매 교육·컨설팅',
      target: '디지털 판매 역량을 높이려는 소상공인', eligibility: ['소상공인 요건 충족', '디지털커머스 교육·컨설팅 필요'], checks: ['참여 일정·장소와 모집 잔여 여부', '플랫폼 입점은 별도 사업의 조건 확인'], tags: ['온라인 홍보', '콘텐츠', '교육'], smallBusiness: true
    },
    {
      id: 'PBLN_000000000117022', title: '2026년 소상공인 고용보험료 지원사업 공고',
      category: '고용·노무', agency: '소상공인시장진흥공단', region: '전국', publishedAt: '2025-12-30', status: 'budget', priority: 88,
      summary: '사업주 본인이 가입한 자영업자 고용보험의 납부 비용 일부를 환급합니다.', benefit: '보험료 50~80% · 최대 60개월 지원',
      target: '자영업자 고용보험에 가입한 소상공인 사업주', eligibility: ['자영업자 고용보험 가입', '소상공인 요건 충족'], checks: ['가입 등급·납부 내역', '기존 지원기간 및 잔여 예산'], tags: ['보험료', '사업주', '고정비'], smallBusiness: true
    },
    {
      id: 'PBLN_000000000124909', title: '2026년 중소벤처기업부 소상공인 정책자금 융자사업 4차 변경 공고',
      category: '금융', agency: '소상공인시장진흥공단', region: '전국', publishedAt: '2026-07-30', status: 'budget', priority: 86,
      summary: '일반·특별 경영안정과 성장기반 자금 등 세부 대출사업을 안내하는 변경 공고입니다.', benefit: '세부 자금별 정책 융자 · 한도·금리 별도 확인',
      target: '세부 자금별 요건을 충족하는 소상공인', eligibility: ['소상공인 요건 충족', '신청할 세부 자금의 개별 요건 충족'], checks: ['세부 자금의 실제 접수 일정과 예산', '융자 제외 업종·신용·보증 심사', '보조금이 아닌 상환 의무가 있는 대출'], tags: ['운전자금', '경영안정', '정책자금'], smallBusiness: true
    },
    {
      id: 'PBLN_000000000121182', title: '2026년 희망리턴패키지 재기사업화(경영개선) 위기 소상공인 진단ㆍ멘토링 지원 모집 공고',
      category: '교육·컨설팅', agency: '소상공인시장진흥공단', region: '전국', publishedAt: '2026-04-23', status: 'budget', priority: 84,
      summary: '위기 징후가 확인된 사업장에 전문가 진단과 경영개선 이행 상담을 제공합니다.', benefit: '방문 경영진단·개선지도·밀착 멘토링',
      target: '위기 알림톡을 받고 정상 영업 중인 소상공인', eligibility: ['공단·지역신보·참여 은행의 위기 선별 대상', '위기 알림톡 수신', '휴·폐업하지 않은 소상공인'], checks: ['위기 알림톡 수신 여부', '지역 주관기관의 모집·예산 상황'], tags: ['경영개선', '진단', '멘토링'], smallBusiness: true
    },
    {
      id: 'PBLN_000000000126576', title: '[대구] 2026년 소상공인 IP창출지원 후속지원 사업(레시피특허) 모집공고',
      category: '브랜드·판로', agency: '대구지식재산센터', region: '대구', publishedAt: '2026-09-17', status: 'budget', priority: 82,
      summary: '기존 지원을 받은 사업자의 독창적인 조리법을 특허로 보호할 수 있도록 돕습니다.', benefit: '레시피의 특허 출원 후속지원',
      target: '올해 대구센터의 상표출원 또는 IP종합패키지 지원을 받은 소상공인', eligibility: ['당해 대구지식재산센터 지원 이력', '사업자등록을 유지 중인 소상공인', '권리화할 독창적인 레시피 보유'], checks: ['기존 지원 이력과 중복지원 제한', '레시피의 출원 가능성·자부담·잔여 예산'], tags: ['레시피', '음식점', '특허'], smallBusiness: true
    },
    {
      id: 'PBLN_000000000126578', title: '[대구] 2026년 소상공인 IP창출지원 후속지원 사업(디자인출원) 모집공고',
      category: '브랜드·판로', agency: '대구지식재산센터', region: '대구', publishedAt: '2026-09-17', status: 'budget', priority: 78,
      summary: '기존 지원 사업자의 제품·포장·화상 디자인 중 출원 가능한 결과물을 권리화합니다.', benefit: '구현된 디자인의 출원 지원',
      target: '올해 대구센터의 상표출원 또는 IP종합패키지 지원을 받은 소상공인', eligibility: ['당해 대구지식재산센터 지원 이력', '사업자등록을 유지 중인 소상공인', '최소한의 보완으로 출원할 수 있는 디자인 보유'], checks: ['기존 지원 이력·디자인 구현 상태', '지원 범위·자부담·잔여 예산'], tags: ['디자인', '포장', '브랜드'], smallBusiness: true
    },
    {
      id: 'PBLN_000000000123696', title: '[대구] 2026년 노동존중 기업 모집 공고',
      category: '고용·노무', agency: '대구노동권익센터', region: '대구', publishedAt: '2026-06-29', status: 'budget', priority: 75, conditions: { maxEmployees: 49 },
      summary: '기초 노동질서를 지키는 소규모 사업장의 노사협력 활동을 지원합니다.', benefit: '인증현판·운영 안내자료·노사 화합 격려품',
      target: '4대 기초 노동질서를 준수하는 대구의 50명 미만 사업장', eligibility: ['대구 소재, 근로자 50명 미만', '4대 기초 노동질서 준수'], checks: ['기초 노동질서 준수 증빙', '현재 모집·예산 잔여 여부'], employeeRule: '근로자 50명 미만 사업장', tags: ['노무', '노사협력', '인증']
    },
    {
      id: 'PBLN_000000000126568', title: '2026년 5차 소상공인 상품개선 지원사업 참여기업 모집 공고',
      category: '브랜드·판로', agency: '한국중소벤처기업유통원', region: '전국', publishedAt: '2026-09-17', startsAt: '2026-09-16', deadline: '2026-09-30', status: 'period', priority: 74,
      summary: '온라인에서 판매할 소비자 상품의 포장과 브랜드 디자인을 개선합니다.', benefit: '상품 진단·컨설팅·패키지 또는 브랜드 디자인',
      target: '온라인 판매 가능한 소비자용 상품을 보유한 소상공인', eligibility: ['소상공인 요건 충족', '온라인 판매 가능한 일반 소비자용 상품 보유'], checks: ['판매 상품의 지원 적합성', '중복지원·제외 상품·선정 기준'], tags: ['상품', '포장', '온라인 판매'], smallBusiness: true
    },
    {
      id: 'PBLN_000000000126604', title: '[대구] 2026년 다채몰–네이버 스토어 기획전(나란히 가게) 참가기업 모집 공고(지역산업 온라인 마케팅 지원사업)',
      category: '브랜드·판로', agency: '대구테크노파크', region: '대구', publishedAt: '2026-09-17', startsAt: '2026-09-17', deadline: '2026-10-08', status: 'period', priority: 72,
      summary: '다채몰 입점기업의 네이버 기획전 판매에 구매 할인쿠폰을 지원합니다.', benefit: '구매 할인쿠폰 20% · 최대 2만원',
      target: '다채몰 입점 또는 입점 신청 기업', eligibility: ['다채몰 입점 또는 입점 신청'], checks: ['기획전에 판매할 상품·스토어 조건', '쿠폰 발행·정산 및 참가 절차'], tags: ['온라인 판매', '기획전', '다채몰']
    },
    {
      id: 'PBLN_000000000117908', title: '소상공인 경영안정 바우처 지원사업 시행 공고',
      category: '경영·비용', agency: '소상공인시장진흥공단', region: '전국', publishedAt: '2026-01-28', startsAt: '2026-02-09', status: 'budget', priority: 70,
      summary: '작년 매출 요건에 해당하는 영업 중 사업자의 공과금 등 고정비 부담을 덜어줍니다.', benefit: '사업체당 바우처 최대 25만원',
      target: '2025년 매출이 0원 초과·1억 400만원 미만인 영업 중 소상공인', eligibility: ['2025년 연 매출 0원 초과, 1억 400만원 미만', '현재 영업 중인 소상공인'], checks: ['2025년 매출 증빙·중복 신청 제한', '지원 항목과 잔여 예산'], tags: ['고정비', '공과금', '바우처'], smallBusiness: true
    },
    {
      id: 'PBLN_000000000126580', title: '[대구] 2026년 소상공인 IP창출지원 후속지원 사업(해외상표) 모집공고',
      category: '브랜드·판로', agency: '대구지식재산센터', region: '대구', publishedAt: '2026-09-17', status: 'budget', priority: 55,
      summary: '기존 지원 사업자 중 수출 실적이나 계획이 있는 곳의 해외 상표출원을 돕습니다.', benefit: '해외 상표출원 비용 일부',
      target: '당해 대구센터 지원 이력과 수출 실적 또는 계획이 있는 소상공인', eligibility: ['당해 상표출원 또는 IP종합패키지 지원 이력', '수출 실적 또는 수출 예정', '휴·폐업하지 않은 소상공인'], checks: ['IP종합패키지 수혜자의 당해 상표출원 중복 제한', '수출 증빙·자부담·잔여 예산'], tags: ['수출', '해외 상표', '브랜드'], smallBusiness: true
    },
    {
      id: 'PBLN_000000000126184', title: '[대구] 동구 2026년 하반기 소상공인 경영안정자금 지원사업 공고',
      category: '금융', agency: '대구신용보증재단', region: '대구', district: '동구', publishedAt: '2026-09-04', status: 'budget', priority: 60,
      summary: '동구에서 일정 기간 운영한 소상공인의 경영자금 대출과 이자 부담을 지원합니다.', benefit: '대출 최대 3천만원 · 2년간 이자 2% 지원',
      target: '대구 동구에서 3개월 이상 영업 중인 소상공인', eligibility: ['사업장 소재지 대구 동구', '영업기간 3개월 이상', '소상공인 요건 충족'], checks: ['보증·대출 심사 및 제외 업종', '접수·잔여 예산 확인'], tags: ['운전자금', '이자', '동구'], smallBusiness: true
    },
    {
      id: 'PBLN_000000000126186', title: '[대구] 수성구 2026년 소상공인시장진흥공단 정책자금 이차보전 지원 사업 공고',
      category: '금융', agency: '소상공인시장진흥공단 대구남부센터', region: '대구', district: '수성구', publishedAt: '2026-09-04', status: 'budget', priority: 58,
      summary: '수성구 소상공인이 이용한 해당 정책자금 대리대출의 이자 일부를 지원합니다.', benefit: '대출한도 7천만원 이내 · 1년간 이자 2% 지원',
      target: '수성구 소재 소진공 대리대출 이용자 중 대구신보 보증서 대출 사업자', eligibility: ['사업장 소재지 대구 수성구', '소진공 대리대출 이용', '대구신용보증재단 보증서 대출'], checks: ['기존 대출의 지원 대상 여부', '잔여 예산 및 신청 서류'], tags: ['정책자금', '이자', '수성구'], smallBusiness: true
    },
    {
      id: 'PBLN_000000000120136', title: '[대구] 북구 2026년 상반기 소상공인 경영안정자금 지원사업 공고',
      category: '금융', agency: '대구 북구·대구신용보증재단 북지점', region: '대구', district: '북구', publishedAt: '2026-03-30', status: 'budget', priority: 56,
      summary: '북구에서 운영 중인 소상공인에게 경영자금 대출과 이자 일부를 지원합니다.', benefit: '대출 최대 5천만원 · 2년간 이자 2%p 지원',
      target: '대구 북구에서 3개월 이상 영업 중인 소상공인', eligibility: ['사업장 소재지 대구 북구', '영업기간 3개월 이상', '소상공인 요건 충족'], checks: ['상반기 공고의 현재 잔여 예산', '보증·대출 심사 및 제외 업종'], tags: ['운전자금', '이자', '북구'], smallBusiness: true
    },
    {
      id: 'PBLN_000000000118064', title: '[대구] 달성군 2026년 소상공인 경영안정자금 지원사업 공고',
      category: '금융', agency: '대구신용보증재단', region: '대구', district: '달성군', publishedAt: '2026-02-02', status: 'budget', priority: 54,
      summary: '달성군에 등록한 영업 중 사업자의 특례보증 대출과 이자 일부를 지원합니다.', benefit: '특례보증 최대 7천만원 · 2년간 이자 2% 지원',
      target: '달성군에 사업자등록과 사업장이 있는 영업 중 소상공인', eligibility: ['사업장 소재지 대구 달성군', '사업자등록 및 실제 영업', '소상공인 요건 충족'], checks: ['보증·대출 심사 및 제외 업종', '접수·잔여 예산 확인'], tags: ['특례보증', '이자', '달성군'], smallBusiness: true
    },
    {
      id: 'PBLN_000000000126392', title: '[대구] 2026년 크리스마스페어 참가기업 모집 공고(지역산업 온라인 마케팅 지원사업)',
      category: '브랜드·판로', agency: '대구테크노파크', region: '대구', publishedAt: '2026-09-11', startsAt: '2026-10-12', deadline: '2026-10-16', status: 'period', priority: 45,
      summary: '대구 크리스마스페어에 참가할 다채몰 기업의 전시 부스 비용을 지원합니다.', benefit: '전시 부스 사용료 지원',
      target: '대구 소재 다채몰 입점 또는 입점 신청 기업', eligibility: ['신청일 기준 대구 소재 기업', '마감일까지 다채몰 입점 또는 입점 신청'], checks: ['10.12 접수 시작 전 신청 준비', '전시 상품 적합성 및 선정 조건'], tags: ['전시', '오프라인 판매', '다채몰']
    },
    {
      id: 'PBLN_000000000122574', title: '[대구] 2026년 소상공인 IP창출 종합패키지(브랜드&디자인 융합) 사업 공고',
      category: '브랜드·판로', agency: '대구지식재산센터', region: '대구', publishedAt: '2026-05-29', startsAt: '2026-05-19', deadline: '2026-06-15', status: 'closed', priority: 10,
      summary: '상표와 포장 디자인 개발을 함께 지원한 모집 공고입니다. 해당 차수는 마감되었습니다.', benefit: '브랜드·포장 개발과 상표·디자인 출원 지원',
      target: '사업자등록을 보유한 소상공인', eligibility: ['대구 소재 사업자등록 보유 소상공인'], checks: ['이 공고의 접수는 종료됨', '향후 추가 모집은 기관 공고 확인'], tags: ['브랜드', '디자인', '마감'], smallBusiness: true
    }
  ];

  // Ranking hints identify unverified prerequisites; they never assert eligibility.
  const eligibilityFlagsById = {
    PBLN_000000000117022: ['insurance-enrolled'],
    PBLN_000000000121182: ['risk-notification'],
    PBLN_000000000126576: ['prior-support'],
    PBLN_000000000126578: ['prior-support', 'design-ready'],
    PBLN_000000000123696: ['labor-compliance'],
    PBLN_000000000126568: ['online-product'],
    PBLN_000000000126604: ['platform-member'],
    PBLN_000000000117908: ['annual-revenue'],
    PBLN_000000000126580: ['prior-support', 'export'],
    PBLN_000000000126186: ['existing-policy-loan'],
    PBLN_000000000126392: ['platform-member']
  };

  const items = raw.map(function (item) {
    const startsAt = item.startsAt || null;
    const deadline = item.deadline || null;
    let applicationStatus = '공고 확인';
    if (item.status === 'closed' || (deadline && deadline < checkedAt)) applicationStatus = '마감';
    else if (startsAt && startsAt > checkedAt) applicationStatus = '예정';
    else if (item.status === 'budget') applicationStatus = '예산 소진 시까지';
    else if (item.status === 'period') applicationStatus = '접수중';
    const conditions = Object.assign({ regions: [item.region], districts: item.district ? [item.district] : [], industries: [] }, item.conditions || {});
    return Object.assign({}, item, {
      checkedAt: checkedAt,
      sourceUrl: item.sourceUrl || sourceBase + item.id,
      sourceName: '기업마당',
      startsAt: startsAt,
      deadline: deadline,
      startDate: startsAt,
      endDate: deadline,
      applicationStatus: applicationStatus,
      periodLabel: item.periodLabel || (item.status === 'budget' ? '예산 소진 시까지' : ((startsAt || '시작일 공고 확인') + ' ~ ' + (deadline || '마감일 공고 확인'))),
      regionScope: item.region === '대구' ? 'daegu' : 'nationwide',
      district: item.district || null,
      industry: item.smallBusiness ? '소상공인 · 업종별 요건 확인' : '기업·사업장 · 세부 요건 확인',
      industryLabel: item.smallBusiness ? '소상공인' : '기업·사업장',
      employeeRule: item.employeeRule || (item.smallBusiness ? smallBusinessRule : '공고의 사업장 규모와 세부 자격을 확인해 주세요.'),
      eligibilityFlags: eligibilityFlagsById[item.id] || [],
      conditions: conditions,
      eligibilityNote: item.checks.join(' · ')
    });
  });

  return {
    checkedAt: checkedAt,
    sourceName: '기업마당 공식 공고',
    mode: 'verified-snapshot',
    notice: '2026.09.18에 확인한 공식 공고입니다. 자동 갱신되지 않으며, 접수 여부와 최종 자격은 원문에서 확인해 주세요.',
    items: items
  };
});
