# 지원사업 공고 데이터

`policy-data.js`는 **2026-09-18에 공식 기업마당 원문을 확인한 22건**을 담습니다. 대구 지역 또는 전국 대상 중 소상공인·소규모 사업장에 관련된 공고를 선정한 자료입니다. 기업마당의 모든 공고를 전수 수집한 목록이나 실시간 API 응답은 아닙니다.

브라우저에서는 `window.IM_POLICY_DATA`, Node에서는 `require('./policy-data.js')`로 읽습니다. 목록의 전체 건수는 `items.length`를 사용하고, 추천 후보 수만 최대 10건으로 제한합니다. 신규 공고 추가 시 전체 목록 크기는 자동으로 늘어납니다.

지원사업 화면은 브라우저 높이에 맞춰 고정합니다. 맞춤 추천은 PC 3장·모바일 1장 단위로 넘기고, 전체 공고는 목록 영역 안에서만 스크롤합니다. 추천 기준은 별도 상세 창으로 열며, 낮은 화면에서 생략한 기관·지원대상 등은 공고 상세에서 확인할 수 있습니다.

## 표시와 자격 판정

- 확인일: `checkedAt`. 상태는 확인일 기준이며 자동 갱신되지 않습니다. UI에 확인일과 원문 링크를 유지합니다.
- `startsAt`·`deadline`: 원문에서 확인한 날짜만 기록합니다. 날짜가 없는 예산 소진형은 `null`입니다. 홈페이지의 보조 날짜와 상세 본문의 신청기간이 다르면 상세 본문을 우선했습니다. 특히 IP 후속지원 3건의 마감일을 임의로 12월 31일로 지정하지 않았습니다.
- `status`: `period`(기간 지정), `budget`(예산 소진), `closed`(마감). `applicationStatus`는 예정·접수중·예산 소진 시까지·마감 등으로 변환합니다. 예산 잔액을 조회하지 않으므로 예산형을 접수중으로 단정하지 않습니다.
- `conditions`: 확인된 지역·구군·업종·직원 수 제한만 구조화합니다. `maxEmployees: 49`는 50명 미만을 뜻합니다. 배열이 비었다고 모든 자격이 충족되는 것은 아닙니다.
- 소상공인 법정 요건만 언급한 공고에 직원 수 한도를 임의 입력하지 않았습니다. 화면의 직원 수와 법정 상시근로자 수가 동일한지, 소상공인 확인서 발급이 가능한지 별도로 확인해야 합니다.
- `target`·`eligibility`: 주요 대상과 선행 요건. `checks`·`eligibilityNote`: 신청 전 추가 확인 사항. 추천은 검토할 후보이며 신청 자격 확정을 의미하지 않습니다.
- `eligibilityFlags`: 지원 이력·수출 계획·판매 상품·플랫폼 가입·위기 알림 등 확인되지 않은 선행 요건입니다. 추천 순위를 낮추는 참고 정보이며 요건 불충족을 확정하는 값은 아닙니다.
- `priority`는 프로토타입의 표시 순서용 편집 값입니다. 공식 기관의 평가점수나 선정 확률이 아닙니다. 마감·지역 불일치 공고는 추천에서 제외합니다.
- 본문의 대출 지원 금액을 현금 보조금으로 표시하지 않습니다. 융자에는 심사와 상환 의무가 있으며, 실제 한도·금리는 세부 공고 확인이 필요합니다.

## 원문 확인 목록

아래 링크의 공고 본문에서 제목·기관·기간·대상·지원내용을 확인했습니다. 웹 읽기 도구가 일부 신규 페이지를 읽지 못하는 경우에는 같은 공식 URL을 HTTP로 직접 읽어 확인했습니다. 제3자 요약의 날짜나 금액을 최종 근거로 사용하지 않았습니다.

| 공고 | 원문 | 원문 신청기간 / 확인 메모 |
| --- | --- | --- |
| 스마트상점 기술보급 2차 | [125880](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000125880) | 08.26~09.30. 영업 중 점포와 소상공인 확인서 요건 |
| 대구 AI커머스 실무교육 | [069458](https://www.bizinfo.go.kr/sie/siea/selectSIEA430Detail.do?eventInfoId=EVEN_000000000069458) | 접수 종료 11.10, 시작일 미표기. 교육 10.15~11.10, 회차별 확인 |
| 코참 무료 경영 상담 | [126265](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000126265) | 09.01~12.31. 전국 기업·소상공인, 서울 소관 표기만으로 서울 한정하지 않음 |
| 대구 인사노무관리 상담 | [123701](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000123701) | 예산 소진까지. 대구 소재 50명 미만 |
| 대구 취업규칙 정비 | [123695](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000123695) | 예산 소진까지. 대구 소재 50명 미만 |
| 소담스퀘어 경북 | [125166](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000125166) | 08.05~10.30. 원문 대상은 전국 소상공인, 운영기관 소재와 대상지역 구분 |
| 사업주 고용보험료 | [117022](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000117022) | 예산 소진까지. 자영업자 고용보험 가입 필요 |
| 소상공인 정책자금 4차 변경 | [124909](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000124909) | 예산 소진까지. 실제 접수·금리·한도는 자금별 상이 |
| 위기 소상공인 진단·멘토링 | [121182](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000121182) | 예산 소진까지. 위기 선별과 알림톡 수신 선행 조건 |
| 대구 레시피 특허 후속지원 | [126576](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000126576) | 예산 소진까지. 당해 센터 지원 이력 필요 |
| 대구 디자인 출원 후속지원 | [126578](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000126578) | 예산 소진까지. 당해 지원 이력·출원 가능한 디자인 필요 |
| 대구 노동존중 기업 | [123696](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000123696) | 예산 소진까지. 50명 미만·4대 기초 노동질서 준수 |
| 상품개선 5차 | [126568](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000126568) | 09.16~09.30. 온라인 판매 가능 소비자 상품 필요 |
| 다채몰·네이버 기획전 | [126604](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000126604) | 09.17~10.08. 다채몰 입점·입점 신청 기업 |
| 경영안정 바우처 | [117908](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000117908) | 예산 소진까지. 02.09 신청 시작, 2025 매출 요건 확인 |
| 대구 해외상표 후속지원 | [126580](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000126580) | 예산 소진까지. 당해 지원·수출 이력 또는 계획 필요 |
| 동구 하반기 경영안정자금 | [126184](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000126184) | 예산 소진까지. 동구 소재·3개월 이상 영업 |
| 수성구 정책자금 이자지원 | [126186](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000126186) | 예산 소진까지. 수성구 소재·대상 대리대출 필요 |
| 북구 상반기 경영안정자금 | [120136](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000120136) | 예산 소진까지. 북구 소재·3개월 이상 영업, 현재 잔액 확인 |
| 달성군 경영안정자금 | [118064](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000118064) | 예산 소진까지. 달성군 소재·사업자등록·영업 필요 |
| 대구 크리스마스페어 | [126392](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000126392) | 10.12~10.16. 확인일 현재 접수 예정 |
| 대구 IP종합패키지 | [122574](https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000122574) | 05.19~06.15. 마감 자료, 추천 제외 |

기간의 연도는 모두 2026년입니다. 확인 이후 수정·조기마감·예산소진이 생길 수 있어 상세화면에서 공식 원문을 열도록 합니다.
