# 08. API 명세서

- 개정일: 2026-09-03 / 승인된 목표 계약
- 방식: Django REST Framework, 기본 경로 /api/v1/, JSON
- 현재 구현: API 서버 없음. 아래 경로는 실제 호출 가능한 주소가 아닙니다.
- 기준: [데이터](04_data-spec.md), [DB](07_db-schema.md), [화면](06_screen-spec.md)

## 1. 공통 원칙

- 기존 A-01~A-15와 경로를 가능한 한 유지합니다.
- 요청·응답은 snake_case, 수치는 숫자+단위로 반환합니다.
- 가게·분석·대화·보고서에는 인증·소유권을 검증합니다.
- source_type·검증 상태·계산 결과는 서버가 결정합니다.
- 공모전 생성 자료는 dataset_mode:demo와 source_type:synthetic_demo로 명시합니다. real 모드 실패를 생성값으로 대체하지 않습니다. 내부 test_fixture는 공개 시연과 분리합니다.
- HTTP 처리 성공과 데이터 충분성은 다릅니다.
- 위젯 이동·상담 연계·금융 점수·정책 %의 미정 부분은 가짜 성공 응답으로 만들지 않습니다.

## 2. 공통 응답

일반 API는 data, meta, error 구조를 유지합니다. 아래는 숫자 대신 빈 상태를 나타내는 계약 예시이며 실제 분석 결과가 아닙니다.

```json
{
  "data": {
    "data_status": "no_data",
    "items": []
  },
  "meta": {
    "request_id": "request_identifier",
    "source_ids": [],
    "data_version": null,
    "rule_version": null
  },
  "error": null
}
```

각 분석 지표: value, unit, period_start/end, comparison_start/end, source_ids, data_status, reason. 자료가 없으면 value:null입니다.

data_status: available / partial / no_data / not_comparable / definition_pending.

처리 상태: pending / running / completed / failed. 처리 완료라도 일부 자료가 누락될 수 있습니다.

| HTTP | 의미 |
|---|---|
| 200 | 조회·처리 성공 |
| 201 | 자원 생성 |
| 202 | 분석·파일 생성 접수, 아직 완료 아님 |
| 400 | 형식·필수값·기간 검증 실패 |
| 401 / 403 | 인증 없음 / 접근 권한 없음 |
| 404 | 자원 또는 파일 없음 |
| 409 | 분석·파일이 아직 준비되지 않음 등 상태 충돌 |
| 500 / 503 | 내부 오류 / 외부 제공처 사용 불가 |

오류는 error.code, message, fields(입력 오류 시)를 사용하며 개인정보나 내부 비밀을 노출하지 않습니다.

## 3. API 목록

아래 Endpoint 앞에는 /api/v1을 붙입니다.

| ID | Method | Endpoint | 역할 |
|---|---|---|---|
| A-01 | POST | /analysis-runs | 분석 실행 |
| A-02 | GET | /analysis-runs/{analysis_run_id} | 실행 상태·조건 |
| A-03 | GET | /analysis-runs/{analysis_run_id}/dashboard | KPI·체온계·요약 |
| A-04 | GET | /analysis-runs/{analysis_run_id}/insights | 상권·요일·시간·요인 |
| A-05 | GET | /stores/{store_profile_id}/sales-expenses | DB POS·지출·품목 분석 |
| A-06 | POST | /stores/{store_profile_id}/sales-expenses | 기존 수기 보완 입력 |
| A-07 | GET | /stores/{store_profile_id}/cashflow | 자금 흐름 |
| A-08 | POST | /stores/{store_profile_id}/cashflow | 현금·예상 입출금 근거 입력 |
| A-09 | GET | /stores/{store_profile_id}/finance | 대시보드 체온계 비교 자료 |
| A-10 | GET | /policies | 추천/전체 목록·검색 |
| A-11 | GET | /policies/{policy_id} | 원문·자격 상세 |
| A-12 | GET | /analysis-runs/{analysis_run_id}/report | AI 비서에서 사용하는 분석 요약 조회 |
| A-13 | POST | /assistant/messages | 챗봇 질의응답, 기존 경로 보존 |
| A-14 | POST | /stores/{store_profile_id}/receipts | 영수증 확장, 현재 미구현·후순위 |
| A-15 | GET | /analysis-runs/{analysis_run_id}/recovery-plan | 회복 근거·행동·금융 참고 |
| A-16 | GET, PATCH | /me/profile | 사용자 프로필 |
| A-17 | GET, PATCH | /stores/{store_profile_id} | 사업장 프로필 |
| A-18 | POST | /secretary-sessions | AI 비서 대화 시작 |
| A-19 | POST | /secretary-sessions/{session_id}/messages | 질문별 분석 |
| A-20 | GET | /secretary-sessions/{session_id}/messages | AI 비서 대화·근거 조회 |
| A-21 | POST | /secretary-sessions/{session_id}/reports | 실제 PDF 생성 요청 |
| A-22 | GET | /reports/{report_id} | PDF 생성 상태 |
| A-23 | GET | /reports/{report_id}/download | 권한 확인 후 PDF 파일 |
| A-24 | GET | /stores/{store_profile_id}/nearby-places | 지도 반경 내 동종업종 |
| A-25 | GET | /stores/{store_profile_id}/updates | 뉴스·날씨·행사·캘린더 안내 |
| A-26 | GET | /stores/{store_profile_id}/time-guidance | 지난 일주일 기반 현재 시간 안내 |

계정 로그인·로그아웃·비밀번호 변경은 Django 인증 계층에서 처리합니다. 세부 인증 URL·가입 방식은 구현 전 별도 정의하며, 위 계약에 평문 비밀번호 조회를 추가하지 않습니다.

## 4. A-01~A-04 분석·대시보드

### A-01 분석 실행

입력: store_profile_id, period_start, period_end, analysis_scope. dataset_mode(demo/real/mixed)는 사용할 데이터셋 선택이며 서버가 각 자료의 실제 출처를 검증합니다. comparison_start/end는 비교 분석에 필요하며 명시하거나 서버가 채택한 기준을 응답에 반환합니다.

기존 region, industry, revenue_range 입력은 보존 가능하되 가게 소유권 확인 후 분석 조건으로 기록합니다. 지역을 가게 주소와 혼동하지 않습니다.

처리: 명시된 생성 시연 자료 또는 권한 있는 실자료 조회 → 생성 여부·기간·단위·표본 확인 → 정의된 집계·규칙 → analysis_runs와 analysis_insights 저장.

응답: analysis_run_id, status, data_status, 조건·dataset_mode·source_ids·규칙 버전. 즉시 성공·고정 값 반환을 전제로 하지 않습니다.

### A-02 실행 조회

처리 상태, 분석 조건, 비교 기간, timezone, source_ids, missing_fields, completed_at 반환. 기간이 바뀐 다른 실행의 결과를 섞지 않습니다.

### A-03 대시보드

store_context, metrics, main_insight, finance, cashflow_summary, recovery_summary, policy_summary.

금융 체온계는 화면상 대시보드에 포함하되 A-09와 동일 서비스·분석 기준을 사용합니다. 계산이 없는 점수는 null입니다. 뉴스·날씨·캘린더는 A-25로 분리해 외부 실패가 KPI를 막지 않게 합니다.

### A-04 인사이트

series(시간·값·단위), customer_segments, factor_candidates, comparison_method, sample_count, evidence, limitations 반환.

요일·시간·주문·방문 지표는 각각 구분합니다. 데이터가 없는 특정 시간대·고객층·그래프를 생성하지 않습니다.

## 5. A-05~A-09 POS·지출·금융

### A-05 매출·지출

조건: period_start/end, 필요 시 group_by(day/weekday/hour), analysis_run_id.

응답: 거래 목록·요약, sales_total, expense_total, categories, purchase_top_items, inventory_checks, order_suggestions, data_status, missing_fields.

품목 금액·판매/매입·재고가 없으면 해당 배열은 빈 배열과 사유를 반환합니다. 실제 매장 방문 수를 제공할 수 없으면 영수증 건수를 방문 수로 바꾸지 않습니다.

분석 실행 ID와 함께 요청하면 가게·기간이 일치해야 합니다. 금액 합계와 취소·환불 처리는 공통 분석 서비스에서 수행합니다.

### A-06 수기 보완

기존 입력: transaction_date, transaction_type, expense_category, amount, description. 시각과 근거가 있으면 occurred_at, input_source 등을 추가합니다.

서버가 store_profile_id와 소유권을 확인합니다. 이 API는 POS 기기 실시간 동기화 기능이 아닙니다. 원자료 가져오기 경로는 공급 데이터 확인 후 구현합니다.

### A-07 / A-08 자금 흐름

기존 month 조건 유지, 필요 시 analysis_run_id로 기준을 맞춥니다.

현재 현금·기준일, 예상 매출과 예상 입금의 구분, 예상 지출/출금, 비용 분류, 가정·방법·출처를 반환·입력합니다. 근거가 없으면 예상 잔액은 null과 사유입니다.

### A-09 금융 체온계

조건: analysis_run_id 또는 명시한 비교 기간. 반환: 비교 가능한 지표·업종 평균·출처·기간, temperature, status_label, scoring_definition, data_status.

산식 미정 시 temperature와 status_label은 null, data_status는 definition_pending. 62°를 기본값으로 반환하지 않습니다.

## 6. A-10~A-11 정책

A-10 조건:

- view: recommended / all
- store_profile_id: 맞춤 추천 시 필요
- keyword, category, region, industry, revenue_range, status
- page, page_size: 전체 리스트 페이지 처리

추천 응답: items(최대 10개), total_count, match_status, match_score, matching_reasons, unknown_conditions, rule_version.

- 3개 표시·1개씩 이동은 화면 동작이며 API 페이지 크기를 3으로 강제하지 않습니다.
- 후보가 적으면 실제 후보만 반환합니다.
- match_score 산식이 없으면 null. 조건별 판정은 가능하나 ‘높은 적합도 순’의 점수 순위가 완성되었다고 주장하지 않습니다.
- 결정적 제외 조건을 점수 합산으로 덮지 않습니다.
- 불확실한 조건은 미확인으로 남깁니다. 매출 정보가 모든 공고에서 필수는 아닙니다.

A-11은 지원 내용·원문·접수기간·조건 구조·추출 상태·원문 참조를 반환합니다.

수집의 금융·창업 및 제목 3키워드 OR 조건은 서버 수집 계층의 규칙입니다. 화면 검색과 구분합니다. 외부 공고 분류·권한 확인 전 호출하지 않습니다.

## 7. A-12~A-13 요약·챗봇 구분

### A-12 분석 요약

실제 분석 결과의 sections, evidence, limitations, analysis_run_id, report_file(생성된 경우)을 반환합니다. 조회 요청만으로 가짜 PDF를 생성했다고 응답하지 않습니다.

### A-13 챗봇

목표 화면 이름은 ‘챗봇’이지만 기존 /assistant/messages 경로를 유지합니다. AI 비서의 다단계 분석 경로와 구분합니다.

입력: store_profile_id, analysis_run_id(분석 관련 질문 시), message, current_screen(문맥 보조).

current_screen은 접근할 수 있는 유일한 데이터 범위가 아닙니다. 각 카테고리의 권한 있는 자료를 조회할 수 있습니다.

응답: answer, evidence, suggested_actions, answer_status, missing_fields, consultation.

answer_status: answered / insufficient_data / out_of_scope. consultation은 실제 채널 설정이 없으면 available:false입니다.

- 공통 결과의 수치를 사용하며 키워드마다 별도 하드코딩 숫자를 넣지 않습니다.
- 답변 불가 시 이유를 설명하고 상담 안내를 제공합니다.
- 실제 AI 연결 여부를 나타내는 생성 방식 정보를 유지합니다.
- 외부 AI 제공자·비용은 미정이며 이번 계약으로 결제하지 않습니다.

## 8. A-15 / A-24 회복 플랜·지도

A-15 응답: factor_candidates, focus_time, target_customers, actions, competitive_evidence, event_guidance, financial_reference, related_policies, source_ids, limitations.

financial_reference는 산출 근거가 없으면 value:null, data_status:definition_pending. +650,000원을 기본 시나리오로 넣지 않습니다.

A-24 조건: radius_m, 같은 업종의 기준. 위치는 해당 가게의 확인된 주소·좌표를 기준으로 합니다.

반환: center, radius_m, places(점포 식별자·이름·주소·업종·위도·경도·거리·출처), data_status.

반경 범위·좌표계·거리 방식·업종 매핑을 확정 후 검증합니다. 지도 핀만으로 메뉴·개점시각·직장인 비중을 만들어 반환하지 않습니다.

## 9. A-16~A-23 프로필·AI 비서·PDF

A-16 사용자 프로필: name, phone, age, age_as_of, username, email. 비밀번호·해시는 GET 응답에서 제외하고 변경은 인증 계층에서 처리합니다.

A-17 사업장: 업종·사업 지역·주소·사업자번호·창업일자·사업장 규모·매출 범위. 프로필 화면의 ‘지역’은 이 API의 사업장 소재지를 사용합니다. 거주지 자격을 대신 판정하지 않습니다. business_size 기준이 미정이면 규모 조건을 자동 판정하지 않습니다.

AI 비서:

1. A-18: store_profile_id로 세션 생성. 예시 질문은 화면에서 제공.
2. A-19: message와 필요한 기간·분석 범위 확인 후 분석 서비스 호출.
3. A-20: 대화·연결된 analysis_run_id·근거 조회.
4. A-21: 확정한 분석 실행의 최종 요약으로 PDF 생성 요청.
5. A-22: pending/generating/completed/failed, 파일명·생성 시각·오류 조회.
6. A-23: 소유권·파일 존재 확인 후 application/pdf와 다운로드 파일명 제공.

A-23 성공 응답은 JSON이 아닌 PDF 바이트이며 Content-Disposition으로 파일 다운로드를 안내합니다. 실패는 공통 오류 구조를 사용합니다. 생성 완료 전 다운로드 URL을 활성화하지 않습니다.

PDF의 숫자·기간·출처는 화면·챗봇과 동일 실행을 참조합니다. ‘위젯 이동’ API는 의미 확인 후 설계합니다.

## 10. A-25~A-26 이슈·시간 안내

A-25 조건: 가게, 필요 시 기간/유형. 반환: news, weather, calendar_events, seasonal_briefs 및 항목별 출처·기준일·갱신일·상태.

공급처 실패 시 해당 항목에 no_data와 외부 제공처 사용 불가 사유를 표시합니다. 기록 없는 지역 행사나 과거 인기 상품을 반환하지 않습니다. 대목 1주 전 안내의 규칙·채널은 자료 확인 후 정의합니다.

A-26은 서버 기준 현재 날짜 이전의 완료된 7일을 기본 참고창으로 사용합니다. guide_time, reference_period, observation_count, metrics, actions, rule_version, limitations를 반환합니다.

동일 요일 1회 관측의 한계를 표시하며 최소 관측·고저 기준이 정의되지 않았으면 단정적 행동 지침 대신 기준 확인 필요를 반환합니다. 실시간 수요 예측 API가 아닙니다.

## 11. 화면과 계약 연결

| 화면 | 주요 API |
|---|---|
| S-01 | A-01, A-02, A-17 |
| S-02 / S-05 | A-03, A-09, A-25, A-26 |
| S-03 | A-04, A-26 |
| S-04 | A-05~A-08 |
| S-06 | A-10, A-11 |
| S-07 AI 비서 | A-12, A-18~A-23 |
| S-08 회복 | A-15, A-24, A-25 |
| S-09 프로필 | A-16, A-17 |
| 공통 챗봇 | A-13 |

## 12. 검증·구현 순서

- 기간·단위·소유권·입력 형식 검증.
- 데이터 없는 정상 응답과 시스템 오류 구분.
- 정책 조건 미상·후보 부족·만료·중복, 지도 실패, PDF 실패 처리.
- 표본 부족, 거래 중복·환불, 프로필 변경 시 오래된 결과 혼합 방지.
- 모든 수치와 문장이 같은 데이터 버전을 쓰는지 검사.
- 실제 POS·외부자료 계약과 인증을 먼저 구현하고 기존 P0 연결, 나머지는 데이터 준비 순서에 따라 진행.
- 기존 F-09의 우선순위를 내리지 않으며, API 명세 승인 자체로 구현 완료·유료 서비스 이용을 주장하지 않음.

검증 사례는 [09_test-plan.md](09_test-plan.md)에 연결합니다.
