# iM파트너 데이터베이스 명세서

- 개정일: 2026-09-04 / 목표 논리 스키마
- MySQL·Django ORM 예정. 실제 DB·모델·마이그레이션은 아직 생성하지 않았습니다.
- [데이터 명세](04_data-spec.md)와 [API 명세](08_api-spec.md)를 함께 적용합니다.

## 1. 설계 원칙

- 기존 테이블명을 가능한 한 유지하고 회의 요구에 필요한 필드·관계만 추가합니다.
- 사용자 계정과 가게를 분리하고, 가게 관련 자료에 소유권을 확인합니다.
- 숫자는 표시 문자열이 아닌 숫자 자료형, 상태 미정은 null로 저장합니다.
- 자료 출처·기간·단위·검증 상태를 보존합니다. 허용된 POS 원자료와 제한된 센터 원자료를 동일한 저장 금지 대상으로 취급하지 않습니다.
- 공모전 생성 데이터는 synthetic_demo로 명시해 사용할 수 있습니다. 내부 test_fixture와 구분하고 실제 관측 자료로 섞어 표시하지 않습니다.
- 회복 플랜의 핵심 근거는 CCTV 익명 집계와 POS이며, 지도·상권 자료는 보조 근거로 분리합니다.
- CCTV 원본 영상·얼굴·개인 식별자는 일반 분석 테이블과 화면 API에 저장하지 않습니다. 실제 처리·보관 정책은 장비와 제공 계약 확인 후 확정합니다.
- 아래 추가 테이블은 필요한 데이터 계약이며 모든 기능을 즉시 구현하겠다는 일정 확정이 아닙니다.

## 2. 테이블 목록과 관계

| 테이블 | 상태 | 역할 |
|---|---|---|
| Django 인증 사용자 | 신규 설계 | 아이디·이메일·비밀번호 해시 |
| user_profiles | 신규 | 이름·전화번호·나이 |
| store_profiles | 기존 확장 | 소유자·사업장 소재지·직원 수·지도 기준 |
| data_sources | 신규 | 출처·권한·검증·자료 버전 |
| card_consumptions | 기존 확장 | 카드소비 집계 |
| foot_traffic | 기존 확장 | 상권 유동인구 집계 |
| sales_expenses | 기존 확장 | POS 거래와 지출 |
| store_items / transaction_items | 조건부 신규 | 품목과 거래 품목 상세 |
| inventory_snapshots / item_mappings | 조건부 신규 | 재고·판매/매입 품목 대응 |
| store_funnel_counts | 신규 | CCTV 익명 통행·체류·입장 집계 |
| cashflow_inputs | 기존 확장 | 현금·예상 입출금과 가정 |
| delivery_metrics | 유지·출처 보강 | 대구로 운영지표 |
| financial_benchmarks | 유지·출처 보강 | 업종 평균 비교 |
| policy_support_programs | 기존 확장 | 원문·자격·갱신 |
| event_weather_data | 기존 확장 | 행사·날씨·뉴스·일정 |
| nearby_places | 신규 | 상권 점포 좌표와 확인된 경쟁 근거 |
| analysis_runs / analysis_insights | 기존 확장 | 분석 조건·결과·근거·규칙 |
| recovery_experiments | 신규 | 실행 행동·기준기간·7일 후 비교 |
| assistant_sessions / assistant_messages | 신규 | AI 비서 대화와 분석 연결 |
| report_files | 신규 | 실제 PDF 생성·접근 관리 |

```text
인증 사용자 ─ user_profiles
    └─ store_profiles
         ├─ sales_expenses ─ transaction_items ─ store_items
         ├─ inventory_snapshots / item_mappings
         ├─ store_funnel_counts
         ├─ cashflow_inputs / delivery_metrics
         ├─ analysis_runs ─ analysis_insights ─ recovery_experiments
         └─ assistant_sessions ─ assistant_messages / report_files

data_sources ─ 각 입력자료·분석 실행의 source_ids
공통 자료: card_consumptions / foot_traffic / financial_benchmarks /
           policy_support_programs / event_weather_data / nearby_places
```

회복 플랜은 `store_funnel_counts`와 POS 거래를 핵심 사실 데이터로 사용하고, `nearby_places`·상권·행사 자료는 보조 근거로 사용합니다. 추천 행동과 7일 후 비교 이력은 `recovery_experiments`에 분리합니다. iM챗봇 대화의 장기 보관은 이번 요구가 아니므로 강제하지 않습니다.

## 3. 공통 컬럼·형식

기본키 id BIGINT, created_at·updated_at DATETIME. 외래키는 연결 대상의 삭제 정책과 권한을 함께 정의합니다.

자료별 source_id → data_sources를 연결합니다. 복합 분석은 analysis_runs.source_ids JSON에 사용한 출처 ID 목록을 보존합니다.

- 금액 DECIMAL(18,2), 수량 DECIMAL(18,3), 비율 DECIMAL.
- 시각은 시간대 인식 처리 후 일관된 방식으로 저장하고 집계 기준 Asia/Seoul을 명시.
- available / partial / no_data / not_comparable / definition_pending은 자료 상태.
- null과 0, 미상과 제한 없음은 구분.
- 사용자가 요청값으로 출처의 검증완료 상태를 지정하지 못하게 함.

## 4. 계정·프로필

### 인증 사용자 / user_profiles

인증 사용자: Django 인증 기능의 username, email, password 해시. 평문 비밀번호를 별도 컬럼에 보관하지 않습니다.

| user_profiles 필드 | 타입 | 의미 |
|---|---|---|
| user_id | FK, unique | 인증 사용자 |
| name | VARCHAR(100) | 이름 |
| phone | VARCHAR(30), nullable | 전화번호 |
| age | INTEGER, nullable | 사용자가 제공한 나이 |
| age_as_of | DATE, nullable | 나이 확인 기준일 |

프로필 화면의 지역은 사업장 주소지로 확정되어 store_profiles.region과 address에서 조회합니다. user_profiles에 같은 지역 값을 중복 저장하지 않습니다. 거주지는 이번 수집 항목이 아닙니다.

나이를 받기 위해 생년월일을 추가 수집하지 않습니다. 전화·나이의 필수 여부는 기능별 필요에 따라 정합니다.

### store_profiles

| 필드 | 타입 | 변경 |
|---|---|---|
| owner_id | FK | 사용자 소유권 추가 |
| store_name | VARCHAR(150), nullable | 기존 유지 |
| region / industry | VARCHAR(100) | 사업 지역·업종 |
| industry_code / industry_code_version | VARCHAR, nullable | 점포·공고 업종 매핑 기준 |
| address | VARCHAR(255) | 가게 주소 |
| business_registration_number | VARCHAR(30), nullable | 사업자번호, 공개 노출 금지 |
| business_start_date | DATE, nullable | 창업일자 |
| employee_count | INTEGER, nullable | 사업장 규모: 직원 수, 0 이상 정수 |
| employee_count_as_of | DATE, nullable | 직원 수 확인 기준일 |
| employee_count_basis | VARCHAR(100), nullable | 사용자 입력의 산정 기준; 공고의 상시근로자 기준과 자동 동일시 금지 |
| revenue_range | VARCHAR(50), nullable | 기존 정책 매출 조건 유지 |
| latitude / longitude | DECIMAL, nullable | 확인된 좌표 |
| location_source_id | FK, nullable | 좌표 근거 |
| business_evidence | JSON, nullable | 확보된 내 메뉴·영업시간 등 값·출처·기준일 |

기존 display_name은 사용자 프로필을 통해 표시하도록 전환합니다. 기존 is_demo는 목표 서비스 데이터의 구분 수단으로 사용하지 않습니다. 기존 Mock 자료를 실제 사용자 레코드로 자동 변환하지 않습니다.

## 5. data_sources

| 필드 | 타입 | 의미 |
|---|---|---|
| source_name / provider | VARCHAR | 자료명·제공자 |
| source_type | VARCHAR(30) | approved_result / authorized_store_data / public_data / synthetic_demo / test_fixture |
| source_url / source_reference | TEXT, nullable | 원문·허용된 내부 관리 참조 |
| permission_status / permitted_usage | VARCHAR / TEXT | 권한 확인 상태·허용 범위 |
| verification_status | VARCHAR | 미검증/검증완료/반려 |
| period_start / period_end | DATE, nullable | 관측 범위 |
| collected_at | DATETIME, nullable | 수집 시각 |
| data_version | VARCHAR | 자료 버전 |
| coverage | JSON, nullable | 지역·업종·표본·누락 범위 |

기존 dummy 출처 레코드는 목적·구조 확인 후 synthetic_demo 또는 test_fixture로 분류합니다. synthetic_demo는 표시가 있는 공모전 시연에 사용하며 실제 관측으로 분류하지 않습니다. approved_result를 붙이는 것만으로 권한·검증이 생기는 것은 아닙니다.

## 6. 카드소비·유동인구

기존 필드 유지:

- card_consumptions: region, industry, analysis_month, weekday, time_slot, consumption_value, metric_type(amount/index), age_group, gender, is_game_day.
- foot_traffic: region, analysis_month, weekday, time_slot, traffic_value, metric_type(count/index), age_group, gender.

공통 추가: source_id, period_start/end, granularity, observed_date(실제 일별 자료일 때), slot_start/end(제공된 경우), sample_count, coverage.

월간 자료만 있으면 일별 observed_date는 null입니다. 월·일·시간 데이터가 같은 집계에서 중복 합산되지 않도록 granularity와 모집단을 구분합니다. CCTV로 측정한 매장 앞 통행·입장 수는 이 테이블에 저장하지 않습니다.

## 7. POS·지출·품목

### sales_expenses

기존 store_profile_id, transaction_date, transaction_type(sales/expense), expense_category, amount, input_source, description을 유지합니다.

| 추가·정비 필드 | 의미 |
|---|---|
| occurred_at | 실제 거래 시각; 시각 없으면 null, 00시 거래로 위장하지 않음 |
| external_transaction_id / source_id | 공급원·원거래 식별자 |
| entry_kind | sale / expense / refund / reversal 등 공급 계약에 맞춘 유형 |
| transaction_status | 완료·취소 등 원자료 처리 상태 |
| original_transaction_id | 환불·취소가 참조하는 원거래 |
| sales_channel | in_store / takeout / delivery / online / unknown 등 공급원 기준 판매 채널 |
| payment_at / payment_status | 현금흐름에 필요한 실제 지급·수금 시점/상태, 확보 시 |
| original_category | 기존·공급원 원분류 |
| expense_category | rent / maintenance / purchase / labor / other |

표시명은 월세·관리비·매입비·인건비·기타 지출입니다. amount의 부호와 환불 반영은 공급원별 변환 규칙을 거쳐 일관되게 정의합니다. 차감 처리와 음수 저장을 동시에 적용하지 않습니다.

input_source는 기존 manual/transaction/pos/receipt를 유지합니다. 기본은 POS 조회이며 수기 보완은 구분합니다. 영수증 OCR은 향후입니다.

### store_items / transaction_items — 품목 자료 확보 시

- store_items: store_profile_id, external_item_id, item_name, item_type(판매/매입/겸용), base_unit, source_id.
- transaction_items: sales_expense_id, store_item_id, external_line_id, quantity, unit, unit_price, line_amount.
- TOP 3는 매입 성격 거래의 품목별 금액 합계. 총거래 금액과 품목 합계의 할인·세금·조정 차이를 검증합니다.
- 영수증 총액을 각 품목에 반복 복사하여 합산하지 않습니다.

### inventory_snapshots / item_mappings — 근거 확보 시

- inventory_snapshots: store_profile_id, store_item_id, snapshot_at, quantity, unit, adjustments(폐기·기타 조정의 근거), source_id.
- item_mappings: store_profile_id, sales_item_id, purchase_item_id, quantity_per_sale, unit, valid_from/to, source_id.
- 메뉴와 원재료가 다르면 레시피·단위 대응 자료가 필요합니다. 매핑이 없으면 발주 수량을 계산하지 않습니다.

### store_funnel_counts — CCTV 익명 집계

| 필드 | 의미 |
|---|---|
| store_profile_id / source_id | 대상 매장·CCTV 집계 출처 |
| period_start_at / period_end_at | 집계 시작·종료 시각 |
| passerby_count | 매장 앞 통행자 수 |
| dwell_count | 정의된 구역·시간 기준 체류자 수 |
| entrant_count | 정의된 출입선 기준 입장객 수 |
| measurement_method / model_version | 측정 방식·분석 모델 버전 |
| deduplication_basis | 같은 사람의 중복 집계를 줄이는 기준 |
| coverage / quality_status | 촬영 범위·가림·누락·품질 상태 |
| anonymization_method | 익명 집계 방식 |
| raw_video_policy | 원본 영상 처리·보관 정책 참조 |

이 테이블은 시간대별 **집계값만** 저장합니다. 얼굴 이미지, 특징 벡터, 개인 식별자, 원본 프레임은 일반 서비스 DB에 넣지 않습니다. `entrant_count ≤ passerby_count`, `dwell_count ≤ passerby_count` 같은 검증 실패는 값을 임의 보정하지 않고 품질 오류로 표시합니다.

POS의 결제 건수는 완료 거래를 기준으로 취소·환불 처리 규칙을 일관되게 적용해 계산합니다. CCTV 입장객과 비교할 때는 판매 채널을 확인하고, 배달·비대면 결제를 분리할 수 없으면 비교 상태와 한계를 저장합니다. 주문 건수나 상권 유동인구를 통행자·입장객 수로 복사하지 않습니다.

## 8. 현금흐름·배달·금융 비교

### cashflow_inputs

기존 store_profile_id, snapshot_date, current_cash, expected_sales, expected_expenses, rent_expense, material_expense, labor_expense, other_expense를 이어받습니다.

- maintenance_expense, purchase_expense를 추가해 표준 비용 분류와 맞춥니다.
- material_expense의 이관은 원분류를 확인한 뒤 수행하고 중복 합산하지 않습니다.
- expected_inflows, expected_outflows, assumptions(JSON), forecast_method, source_id를 추가합니다.
- expected_sales와 expected_inflows는 동일하다고 가정하지 않습니다.
- 산출 자료·가정이 없으면 예상 잔액은 null입니다.

### delivery_metrics

기존 store_profile_id, metric_date, cancellation_rate, average_cooking_time, discount_rate 유지. source_id·집계 기간·단위·표본을 추가합니다.

### financial_benchmarks

기존 industry, analysis_year, 매출·영업이익률·부채비율·비용비율·현금흐름 평균 유지. source_id, period_start/end, 모집단·단위·sample_count를 보강합니다.

체온계의 고정 점수 테이블을 만들지 않습니다. 실제 계산법이 정의되면 분석 결과에 rule_version과 함께 저장합니다.

## 9. 정책·지원사업

policy_support_programs 기존 외부 ID·제목·기관·유형·지원 대상/내용·지역·업종·매출 범위·신청 조건·요약·접수기간·공고일·URL·상태를 유지합니다.

| 추가·정비 필드 | 의미 |
|---|---|
| source_id / source_updated_at / last_collected_at | 제공처·갱신 이력 |
| raw_notice | 허용된 공고 원문 |
| category / title_filter_matched | 금융·창업 분류와 제목 1차 필터 근거 |
| age_min / age_max / age_reference_date | 연령 범위·기준일 |
| region_conditions | 복수 지역·거주지/사업장 기준 |
| industry_conditions | 허용·제외 업종·분류 |
| business_start_conditions | 창업일/업력 조건과 기준일 |
| business_size_conditions | 공고의 지표명·단위·범위·산정 기준; 프로필 직원 수와 기준이 같은지 확인 |
| revenue_conditions | 기존 매출 관련 조건 |
| eligibility_rules | AND/OR·제외·경계 포함 규칙과 원문 참조 |
| extraction_status / reviewed_at | 추출 불확실성·검토 상태 |

단일 칼럼으로 표현 불가한 조건은 JSON으로 원문과 함께 보존합니다. null은 무조건 제한 없음이 아닙니다. 각 조건에 known/unrestricted/unknown/not_applicable 상태를 둡니다.

적합도는 프로필·규칙 버전에 따라 계산하는 결과이며 공고 자체의 고정 점수로 저장하지 않습니다. 산식 미정이면 점수는 null입니다.

## 10. 위치·이슈·일정

### nearby_places

provider_place_id, source_id, name, address, region, industry_code, industry_code_version, latitude, longitude, observed_at.

competitive_evidence(JSON): 확인된 메뉴·영업시간·주변 고객 근거별 value/source_id/observed_at. 없는 값은 null이며 지도로부터 추정하지 않습니다.

내 가게와 반경 거리는 조회 조건에 따라 계산합니다. 고정 반경·할인율은 DB 기본값으로 임의 설정하지 않습니다.

### event_weather_data

기존 region, event_date, event_name, weather_description, market_name 유지.

확장: record_type(event/weather/news/calendar/seasonal), title, start_at/end_at, latitude/longitude, industry_tags, summary, source_url, published_at, source_id, status.

서로 다른 유형의 자료는 record_type별 필수 조건을 검증합니다. 과거 축제 상품 추천은 관련 판매자료·분석 근거로 연결하고 행사 이름만으로 인기 상품을 생성하지 않습니다.

## 11. 분석 실행·결과

### analysis_runs

기존 가게·지역·업종·매출범위·기간·상태·완료일 유지.

추가: user_id, comparison_start/end, timezone, source_ids, data_version, rule_version, profile_snapshot, analysis_scope, data_status, missing_fields, dataset_mode(demo/real/mixed).

mixed이면 결과 항목별 source_ids와 생성 여부를 명시합니다. real 모드에는 synthetic_demo/test_fixture를 공급하지 않습니다.

처리 상태 pending/running/completed/failed. 완료했더라도 일부 자료가 없을 수 있습니다.

### analysis_insights

기존 analysis_run_id, insight_type, title, description, metric_value, metric_unit, priority 유지.

추가: result_key, structured_result(JSON), evidence(JSON), source_ids, rule_version, data_status, limitations.

insight_type은 기존 매출·소비·유동·현금흐름·회복 유형을 유지하고 필요한 기간/품목/경쟁 분석으로 확장합니다. 근거 없는 수치를 description에 숨기지 않습니다.

회복 플랜은 funnel_metrics, opportunity_slot, factor_candidates, actions, supporting_context, source_ids, rule_version을 가진 구조화 결과로 연결합니다. 지도·상권 자료는 `supporting_context`로 구분하며 CCTV·POS 퍼널을 대신하지 않습니다. 금융 효과는 산출 근거가 있을 때만 financial_reference에 저장하고, 없으면 null입니다.

### recovery_experiments

| 필드 | 의미 |
|---|---|
| store_profile_id / analysis_run_id | 매장·회복 플랜 분석 실행 |
| baseline_start / baseline_end | 실행 전 비교 기준 기간 |
| target_slot_start / target_slot_end | 개선 대상 시간대 |
| action_codes / action_summary | 선택한 실행 행동·설명 |
| started_at | 실행 시작 시각 |
| comparison_start / comparison_end | 같은 조건으로 비교할 후속 기간 |
| status | planned / running / waiting / comparable / not_comparable / completed |
| rule_version | 진단·비교 규칙 버전 |

7일 후 비교는 달력상 7일 경과만으로 성공 처리하지 않습니다. 같은 매장·시간대·영업일 조건의 CCTV/POS 자료가 충분한지 확인하고, 부족하면 `waiting` 또는 `not_comparable`로 남깁니다. 비교 결과는 연결된 분석 결과에 근거와 함께 저장하며 추천 효과를 미리 확정값으로 기록하지 않습니다.

## 12. AI 비서 대화와 PDF

- assistant_sessions: user_id, store_profile_id, analysis_run_id(nullable), title, status.
- assistant_messages: session_id, role, content, analysis_run_id(nullable), evidence_refs, created_at.
- report_files: session_id, analysis_run_id, owner_id, status(pending/generating/completed/failed), file_path, file_name, mime_type, generated_at, error_code.
- 생성된 PDF는 보호 저장소의 파일 경로로 관리하고 공개 URL을 DB에 무조건 저장하지 않습니다.
- 다운로드는 소유권 확인 후 제공하며 completed와 실제 파일 존재를 모두 검사합니다.
- 대화·파일 보존기간과 삭제 정책은 실제 운영 전에 결정합니다.

## 13. 인덱스·무결성

- 가게 자료: store_profile_id + occurred_at/transaction_date.
- 수집 거래: store_profile_id + source_id + external_transaction_id 기준 중복 방지. 품목은 거래 ID + external_line_id.
- 카드·유동: source_id + 지역·업종(카드) + 기간·집계 단위·시간·고객 구간. 월/일·전체/세부 집계 중복 방지.
- CCTV 집계: store_profile_id + source_id + period_start_at + period_end_at의 중복 방지. 시간대 겹침·음수·통행자보다 큰 입장객 수를 검증.
- 회복 실험: store_profile_id + target_slot + started_at 조회 및 상태 인덱스. 기준·비교 기간의 중복과 시간대 불일치를 검증.
- 정책: source_id + external_id unique, 접수기간·진행상태 인덱스.
- 위치: 제공처 + provider_place_id unique, 좌표·업종 검색 검토.
- 분석·파일: 소유자·가게·생성 시각·상태 인덱스.
- 실제 제공 스키마 확인 후 unique 조합·null 처리·삭제 정책을 확정합니다. 불확실한 자연키로 정상 레코드를 덮어쓰지 않습니다.

## 14. 전환·검증 순서

1. 자료와 프로필 의미·규칙을 확정.
2. 실제 Django 모델·권한·테이블 생성.
3. 생성 시연 자료는 CCTV·POS를 포함해 synthetic_demo로 명시·일관성 검증. 실자료는 권한·출처 검증, 내부 fixture 격리.
4. CCTV 익명 집계와 POS의 매장·시간대·영업일 정렬, 집계 품질, 취소·환불·중복·단위 검증.
5. 퍼널 지표→요인 후보→실행 행동→7일 후 비교를 같은 analysis_run·rule_version으로 연결.
6. 지도·상권·행사 자료는 보조 근거로 연결하고 핵심 퍼널을 대신하지 않는지 확인.
7. 분석 실행→화면→iM챗봇→AI 비서→PDF 연결.
8. 생성 여부 표시·실자료 혼동·기존 하드코딩 잔여 검사.
9. [테스트 계획](09_test-plan.md) 통과 후 발표 설명 변경.

실제 제한 자료·개인정보·비밀번호·API 키는 GitHub나 제출 파일에 무단 포함하지 않습니다. 스키마 승인만으로 외부 데이터 이용이 승인된 것은 아닙니다.
