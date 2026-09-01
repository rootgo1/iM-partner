# iM 파트너 데이터베이스 명세서

- 문서 상태: 초안
- 기준 문서: 01_prd.md, 02_function-spec.md, 03_user-flow.md, 04_data-spec.md, 05_system-architecture.md, 06_screen-spec.md
- 서비스명: iM 파트너
- 데이터베이스: MySQL
- ORM: Django ORM
- 프로토타입 데이터: AI 생성 더미 데이터
- 본선 데이터: 허용된 집계 분석 결과 및 시각화 자료

---

## 1. 데이터베이스 설계 목적

iM 파트너의 다음 기능에 필요한 데이터를 저장하고 조회합니다.

- 지역·업종 입력
- 상권 및 매출 현황
- 카드소비·유동인구 분석
- 매출·지출 및 자금 흐름
- 골목금융 체온계
- 정책·지원사업 추천
- AI 리포트·골목상권 회복 플랜 생성

---

## 2. 데이터베이스 설계 원칙

- 테이블과 컬럼명은 영문 소문자와 snake_case를 사용합니다.
- 모든 테이블에는 기본키를 둡니다.
- 더미 데이터와 허용된 실제 분석 결과를 같은 구조로 저장합니다.
- 카드소비와 유동인구 데이터에는 특정 가게의 개인정보를 저장하지 않습니다.
- 실제 원본 데이터와 반출이 제한된 데이터는 저장하지 않습니다.
- 데이터 출처 유형을 구분하여 저장합니다.
- 금액은 원 단위의 소수점 숫자로 저장합니다.
- 증감률과 비율은 소수점 숫자로 저장합니다.
- 분석 기준 기간·지역·업종을 확인할 수 있어야 합니다.
- 회원가입과 로그인 기능은 현재 데이터베이스 범위에 포함하지 않습니다.

---

## 3. 전체 데이터베이스 구조

```text
store_profiles
        │
        ├── sales_expenses
        ├── cashflow_inputs
        ├── delivery_metrics
        └── analysis_runs
                    │
                    └── analysis_insights

card_consumptions
foot_traffic
financial_benchmarks
policy_support_programs
event_weather_data
```

카드소비, 유동인구, 금융상태, 정책 데이터는 지역·업종·기간 등의 조건을 기준으로 분석에 사용합니다. 회복 플랜은 별도 원천 테이블을 만들지 않고 분석 결과와 인사이트를 이용해 생성합니다.

---

## 4. 테이블 목록

| 테이블명 | 설명 | 주요 기능 |
|---|---|---|
| `store_profiles` | 사용자 및 가게 기본정보 | 지역·업종 입력 |
| `card_consumptions` | 삼성카드 소비 데이터 | 카드소비 분석 |
| `foot_traffic` | 통신사 유동인구 데이터 | 유동인구 분석 |
| `sales_expenses` | 매출·지출 내역 | 매출·지출 분석 |
| `cashflow_inputs` | 자금 흐름 입력정보 | 예상 자금 흐름 |
| `delivery_metrics` | 대구로 배달 운영 데이터 | 배달 운영 분석 |
| `financial_benchmarks` | 업종 평균 금융지표 | 금융 체온계 |
| `policy_support_programs` | 정책 및 지원사업 | 정책 추천 |
| `event_weather_data` | 행사·날씨 데이터 | 소비 변화 비교 |
| `analysis_runs` | 분석 실행 기록 | 분석 조건 관리 |
| `analysis_insights` | 분석 결과 및 인사이트 | AI 리포트·회복 플랜 |

---

## 5. 공통 컬럼

모든 데이터 테이블은 다음 공통 컬럼을 사용할 수 있습니다.

| 컬럼명 | 자료형 | 설명 |
|---|---|---|
| `id` | BIGINT | 기본키 |
| `source_type` | VARCHAR(30) | 데이터 출처 유형 |
| `created_at` | DATETIME | 생성일시 |
| `updated_at` | DATETIME | 수정일시 |

### `source_type` 값

| 값 | 설명 |
|---|---|
| `dummy` | AI 생성 더미 데이터 |
| `approved_result` | 사용이 허용된 집계 분석 결과 |

`raw_actual` 등 실제 원본 데이터를 의미하는 값은 사용하지 않습니다.

---

## 6. 테이블 상세 명세

## 6-1. `store_profiles`

사용자와 가게의 기본정보를 저장합니다.

현재 프로토타입에서는 사용자명 `이소현`과 분석 대상 가게 정보를 표시하는 데 사용합니다.

| 컬럼명 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| `id` | BIGINT | O | 기본키 |
| `display_name` | VARCHAR(100) | O | 화면에 표시할 사용자명 |
| `store_name` | VARCHAR(150) | X | 가게명 |
| `region` | VARCHAR(100) | O | 사업 지역 |
| `industry` | VARCHAR(100) | O | 업종 |
| `revenue_range` | VARCHAR(50) | X | 매출 범위 |
| `is_demo` | BOOLEAN | O | 시연용 여부 |
| `created_at` | DATETIME | O | 생성일시 |
| `updated_at` | DATETIME | O | 수정일시 |

### 예시 데이터

| display_name | region | industry | revenue_range | is_demo |
|---|---|---|---|---|
| 이소현 | 대구 서문시장 | 음식점 | 월 2,000만~3,000만 원 | TRUE |

---

## 6-2. `card_consumptions`

삼성카드 소비 데이터를 저장합니다.

카드소비 데이터는 지역·업종·기간·요일·시간대·고객층 단위로 저장합니다.

| 컬럼명 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| `id` | BIGINT | O | 기본키 |
| `region` | VARCHAR(100) | O | 소비 지역 |
| `industry` | VARCHAR(100) | O | 소비 업종 |
| `analysis_month` | DATE | O | 분석 월. 해당 월의 1일을 저장 |
| `weekday` | TINYINT | X | 요일 숫자 |
| `time_slot` | VARCHAR(20) | X | 시간대 |
| `consumption_value` | DECIMAL(18,2) | O | 카드소비 금액 또는 지수 |
| `metric_type` | VARCHAR(20) | O | `amount` 또는 `index` |
| `age_group` | VARCHAR(30) | X | 연령 구분 |
| `gender` | VARCHAR(20) | X | 성별 구분 |
| `is_game_day` | BOOLEAN | X | 경기일 여부 |
| `source_type` | VARCHAR(30) | O | 데이터 출처 유형 |
| `created_at` | DATETIME | O | 생성일시 |
| `updated_at` | DATETIME | O | 수정일시 |

### 활용 지표

- 최근 2년 카드소비 증감률
- 카드소비가 많은 요일·시간대
- 실제 소비 고객층
- 경기일·비경기일 소비 차이
- 유동인구와 카드소비 비교

---

## 6-3. `foot_traffic`

통신사 유동인구 데이터를 저장합니다.

유동인구 데이터는 지역·기간·요일·시간대·고객층 단위로 저장합니다.

| 컬럼명 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| `id` | BIGINT | O | 기본키 |
| `region` | VARCHAR(100) | O | 유동인구 지역 |
| `analysis_month` | DATE | O | 분석 월. 해당 월의 1일을 저장 |
| `weekday` | TINYINT | X | 요일 숫자 |
| `time_slot` | VARCHAR(20) | X | 시간대 |
| `traffic_value` | DECIMAL(18,2) | O | 유동인구 수 또는 지수 |
| `metric_type` | VARCHAR(20) | O | `count` 또는 `index` |
| `age_group` | VARCHAR(30) | X | 연령 구분 |
| `gender` | VARCHAR(20) | X | 성별 구분 |
| `source_type` | VARCHAR(30) | O | 데이터 출처 유형 |
| `created_at` | DATETIME | O | 생성일시 |
| `updated_at` | DATETIME | O | 수정일시 |

### 활용 지표

- 유동인구가 많은 요일·시간대
- 유동인구 증감률
- 상권 방문 고객층
- 카드소비 고객층과 비교
- 소비 전환 공백 시간대

---

## 6-4. `sales_expenses`

사용자의 매출·지출 내역을 저장합니다.

| 컬럼명 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| `id` | BIGINT | O | 기본키 |
| `store_profile_id` | BIGINT | O | 가게 기본정보 외래키 |
| `transaction_date` | DATE | O | 거래일자 |
| `transaction_type` | VARCHAR(20) | O | `sales` 또는 `expense` |
| `expense_category` | VARCHAR(30) | X | 임대료·재료비·인건비·기타 |
| `amount` | DECIMAL(18,2) | O | 거래 금액 |
| `input_source` | VARCHAR(20) | O | 직접 입력·거래내역·POS·영수증 |
| `description` | VARCHAR(255) | X | 거래 설명 |
| `created_at` | DATETIME | O | 생성일시 |
| `updated_at` | DATETIME | O | 수정일시 |

### `transaction_type` 값

| 값 | 설명 |
|---|---|
| `sales` | 매출 |
| `expense` | 지출 |

### `input_source` 값

| 값 | 설명 |
|---|---|
| `manual` | 직접 입력 |
| `transaction` | 거래내역 입력 |
| `pos` | POS기 데이터 |
| `receipt` | 영수증 이미지 인식 결과 |

---

## 6-5. `cashflow_inputs`

현재 보유 현금과 예상 매출·지출을 저장합니다.

| 컬럼명 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| `id` | BIGINT | O | 기본키 |
| `store_profile_id` | BIGINT | O | 가게 기본정보 외래키 |
| `snapshot_date` | DATE | O | 자금 상태 기준일 |
| `current_cash` | DECIMAL(18,2) | O | 현재 보유 현금 |
| `expected_sales` | DECIMAL(18,2) | O | 예상 매출 |
| `expected_expenses` | DECIMAL(18,2) | O | 예상 지출 |
| `rent_expense` | DECIMAL(18,2) | X | 임대료 |
| `material_expense` | DECIMAL(18,2) | X | 재료비 |
| `labor_expense` | DECIMAL(18,2) | X | 인건비 |
| `other_expense` | DECIMAL(18,2) | X | 기타 지출 |
| `created_at` | DATETIME | O | 생성일시 |
| `updated_at` | DATETIME | O | 수정일시 |

### 예상 자금 흐름

```text
예상 자금 흐름
= 현재 보유 현금
  + 예상 매출
  - 예상 지출
```

---

## 6-6. `delivery_metrics`

대구로 배달 운영 데이터를 저장합니다.

| 컬럼명 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| `id` | BIGINT | O | 기본키 |
| `store_profile_id` | BIGINT | O | 가게 기본정보 외래키 |
| `metric_date` | DATE | O | 지표 기준일 |
| `cancellation_rate` | DECIMAL(5,2) | X | 주문 취소율 |
| `average_cooking_time` | DECIMAL(8,2) | X | 평균 조리시간 |
| `discount_rate` | DECIMAL(5,2) | X | 할인율 |
| `created_at` | DATETIME | O | 생성일시 |
| `updated_at` | DATETIME | O | 수정일시 |

---

## 6-7. `financial_benchmarks`

사용자 금융상태와 업종 평균을 비교하기 위한 데이터를 저장합니다.

| 컬럼명 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| `id` | BIGINT | O | 기본키 |
| `industry` | VARCHAR(100) | O | 업종 |
| `analysis_year` | SMALLINT | O | 분석 연도 |
| `average_sales` | DECIMAL(18,2) | X | 업종 평균 매출액 |
| `average_operating_margin` | DECIMAL(5,2) | X | 평균 영업이익률 |
| `average_debt_ratio` | DECIMAL(5,2) | X | 평균 부채비율 |
| `average_expense_ratio` | DECIMAL(5,2) | X | 평균 비용 비중 |
| `average_cashflow` | DECIMAL(18,2) | X | 평균 예상 자금 흐름 |
| `source_type` | VARCHAR(30) | O | 데이터 출처 유형 |
| `created_at` | DATETIME | O | 생성일시 |
| `updated_at` | DATETIME | O | 수정일시 |

---

## 6-8. `policy_support_programs`

정책 및 지원사업 정보를 저장합니다.

| 컬럼명 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| `id` | BIGINT | O | 기본키 |
| `external_id` | VARCHAR(100) | X | 외부 정책 데이터의 고유 ID |
| `program_name` | VARCHAR(200) | O | 지원사업명 |
| `organization` | VARCHAR(150) | X | 지원 기관 |
| `support_type` | VARCHAR(50) | X | 지원 유형 |
| `target_description` | TEXT | X | 지원 대상 |
| `support_description` | TEXT | X | 지원 내용 |
| `region` | VARCHAR(100) | X | 적용 지역 |
| `industry` | VARCHAR(100) | X | 관련 업종 |
| `revenue_range` | VARCHAR(50) | X | 매출 조건 |
| `application_condition` | TEXT | X | 신청 조건 |
| `summary` | TEXT | X | 정책 또는 기사 요약 |
| `application_start` | DATE | X | 신청 시작일 |
| `application_end` | DATE | X | 신청 종료일 |
| `published_at` | DATE | X | 공고 게시일 |
| `source_url` | VARCHAR(500) | X | 정책 원문 링크 |
| `status` | VARCHAR(30) | X | 모집 상태 |
| `source_type` | VARCHAR(30) | O | 데이터 출처 유형 |
| `created_at` | DATETIME | O | 생성일시 |
| `updated_at` | DATETIME | O | 수정일시 |

---

## 6-9. `event_weather_data`

행사·날씨 및 전통시장 관련 보조 데이터를 저장합니다.

| 컬럼명 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| `id` | BIGINT | O | 기본키 |
| `region` | VARCHAR(100) | O | 지역 |
| `event_date` | DATE | O | 행사·날씨 기준일 |
| `event_name` | VARCHAR(200) | X | 행사명 |
| `weather_description` | VARCHAR(100) | X | 날씨 설명 |
| `market_name` | VARCHAR(150) | X | 전통시장명 |
| `source_type` | VARCHAR(30) | O | 데이터 출처 유형 |
| `created_at` | DATETIME | O | 생성일시 |
| `updated_at` | DATETIME | O | 수정일시 |

---

## 6-10. `analysis_runs`

사용자가 실행한 분석 조건과 실행 기록을 저장합니다.

| 컬럼명 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| `id` | BIGINT | O | 기본키 |
| `store_profile_id` | BIGINT | X | 가게 기본정보 외래키 |
| `region` | VARCHAR(100) | O | 분석 지역 |
| `industry` | VARCHAR(100) | O | 분석 업종 |
| `revenue_range` | VARCHAR(50) | X | 정책 추천용 매출 범위 |
| `period_start` | DATE | O | 분석 시작일 |
| `period_end` | DATE | O | 분석 종료일 |
| `status` | VARCHAR(20) | O | 분석 상태 |
| `source_type` | VARCHAR(30) | O | 데이터 출처 유형 |
| `completed_at` | DATETIME | X | 분석 완료일시 |
| `created_at` | DATETIME | O | 분석 실행일시 |
| `updated_at` | DATETIME | O | 수정일시 |

### `status` 값

| 값 | 설명 |
|---|---|
| `pending` | 분석 대기 |
| `running` | 분석 중 |
| `completed` | 분석 완료 |
| `failed` | 분석 실패 |

---

## 6-11. `analysis_insights`

분석 결과와 인사이트 문장을 저장합니다.

| 컬럼명 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| `id` | BIGINT | O | 기본키 |
| `analysis_run_id` | BIGINT | O | 분석 실행 외래키 |
| `insight_type` | VARCHAR(50) | O | 인사이트 유형 |
| `title` | VARCHAR(255) | O | 인사이트 제목 |
| `description` | TEXT | O | 인사이트 설명 |
| `metric_value` | DECIMAL(18,2) | X | 관련 수치 |
| `metric_unit` | VARCHAR(30) | X | 수치 단위 |
| `priority` | TINYINT | X | 표시 우선순위 |
| `created_at` | DATETIME | O | 생성일시 |
| `updated_at` | DATETIME | O | 수정일시 |

### `insight_type` 예시

| 값 | 설명 |
|---|---|
| `sales_change` | 매출 변화 |
| `card_consumption_change` | 카드소비 변화 |
| `foot_traffic_change` | 유동인구 변화 |
| `conversion_gap` | 소비 전환 공백 |
| `peak_time_mismatch` | 유동·소비 피크 시간 차이 |
| `customer_difference` | 방문·소비 고객층 차이 |
| `financial_status` | 금융상태 |
| `policy_recommendation` | 정책 추천 |
| `recovery_plan` | 골목상권 회복 플랜 |

---

## 7. 테이블 관계

### 7-1. 가게 관련 데이터

```text
store_profiles
        ├── 1:N sales_expenses
        ├── 1:N cashflow_inputs
        ├── 1:N delivery_metrics
        └── 1:N analysis_runs
```

### 7-2. 분석 결과 관련 데이터

```text
analysis_runs
        └── 1:N analysis_insights
```

### 7-3. 지역·업종 데이터

```text
card_consumptions
        ┐
        ├── 지역·업종·기간·시간대 기준으로 분석
foot_traffic
        ┘
```

카드소비와 유동인구 데이터는 특정 가게와 직접 연결하지 않고, 지역·업종·기간 조건으로 조회합니다.

---

## 8. 외래키 기준

| 외래키 | 참조 테이블 | 설명 |
|---|---|---|
| `sales_expenses.store_profile_id` | `store_profiles.id` | 매출·지출의 대상 가게 |
| `cashflow_inputs.store_profile_id` | `store_profiles.id` | 자금 흐름의 대상 가게 |
| `delivery_metrics.store_profile_id` | `store_profiles.id` | 배달 운영의 대상 가게 |
| `analysis_runs.store_profile_id` | `store_profiles.id` | 분석을 실행한 가게 |
| `analysis_insights.analysis_run_id` | `analysis_runs.id` | 분석 실행별 결과 |

---

## 9. 주요 인덱스

### `card_consumptions`

```text
(region, industry, analysis_month)
(region, industry, weekday, time_slot)
(age_group, gender)
```

### `foot_traffic`

```text
(region, analysis_month)
(region, weekday, time_slot)
(age_group, gender)
```

### `sales_expenses`

```text
(store_profile_id, transaction_date)
(store_profile_id, transaction_type)
```

### `policy_support_programs`

```text
(region, industry)
(revenue_range)
(external_id)
(status, application_end)
```

### `analysis_runs`

```text
(store_profile_id, created_at)
(region, industry, period_start, period_end)
```

---

## 10. 데이터 저장 및 조회 흐름

### 10-1. 더미 데이터 입력

```text
CSV·JSON·엑셀 더미 데이터
        ↓
데이터 형식 확인
        ↓
Django 초기 데이터 입력 스크립트
        ↓
MySQL 저장
```

### 10-2. 사용자 분석 요청

```text
지역·업종 입력
        ↓
analysis_runs 생성
        ↓
조건에 맞는 카드소비·유동인구 데이터 조회
        ↓
pandas·numpy 분석
        ↓
analysis_insights 저장
        ↓
회복 플랜과 AI 리포트에 결과 전달
```

### 10-3. 정책 추천

```text
지역·업종·매출 범위 입력
        ↓
policy_support_programs 조건 검색
        ↓
조건 일치 결과 정렬
        ↓
화면에 추천 목록 표시
```

### 10-4. 골목상권 회복 플랜

```text
analysis_insights의 소비 전환 공백 조회
        ↓
집중 시간대·고객층·추천 행동 연결
        ↓
참고용 소비 기회 지수와 자금 효과 계산
        ↓
화면과 AI 리포트에 회복 플랜 표시
```

회복 플랜은 프로토타입에서 별도 테이블을 만들지 않고 `analysis_insights`와 관련 매출·지출 데이터를 이용해 계산합니다.

---

## 11. 데이터 출처 및 보안 기준

### 프로토타입

- AI 생성 더미 데이터 사용
- 프로젝트의 `data/dummy/`에 원본 더미 데이터 저장
- 초기 입력 스크립트로 MySQL에 저장
- 반복 가능한 시연 환경 구성

### 본선

- 실제 원본 데이터 저장 금지
- 허용된 집계 분석 결과만 사용
- 반출 제한 데이터는 프로젝트와 GitHub에 포함하지 않음
- 실제 결과 사용 전 공개·저장 가능 여부 확인
- 실제 데이터 반영 시 `source_type`을 `approved_result`로 표시

### GitHub 업로드 금지 대상

- 실제 원본 데이터
- 개인 식별정보
- 금융기관 인증정보
- API 키와 비밀번호
- 반출이 제한된 분석 파일

---

## 12. 현재 데이터베이스 범위에 포함하지 않는 내용

- 회원가입 및 로그인
- 금융기관 계좌 연동
- 실제 신용평가
- 대출 심사 및 실행
- 금융상품 가입
- 실제 원본 데이터 저장
- 별도 학습모델 데이터베이스
- 실시간 데이터 수집 시스템

---

## 13. Django 모델 구현 기준

- 각 테이블은 Django Model로 정의합니다.
- 기본키는 Django의 기본 `BigAutoField`를 사용할 수 있습니다.
- 외래키 삭제 정책은 데이터 보존을 고려하여 설정합니다.
- 금액 필드는 `DecimalField`를 사용합니다.
- 비율 필드는 소수점 둘째 자리까지 저장할 수 있도록 설정합니다.
- 생성일시와 수정일시는 자동으로 관리합니다.
- 데이터 출처 유형은 선택값으로 관리합니다.
- 분석 상태는 선택값으로 관리합니다.

---

## 14. 데이터베이스 구현 순서

1. Django 프로젝트 및 앱 생성
2. `store_profiles` 모델 생성
3. 카드소비·유동인구 모델 생성
4. 매출·지출·자금 흐름 모델 생성
5. 금융상태·정책·행사 데이터 모델 생성
6. 분석 실행·인사이트 모델 생성
7. Django migration 실행
8. 더미 데이터 입력 스크립트 작성
9. MySQL 저장 및 조회 테스트
10. 분석 모듈과 데이터베이스 연결

---

## 15. 데이터베이스 명세 완료 기준

- 필요한 테이블 목록이 정의되어야 함
- 각 테이블의 컬럼과 자료형이 정의되어야 함
- 테이블 간 관계가 정의되어야 함
- 카드소비·유동인구 데이터의 지역·업종·기간 기준이 정의되어야 함
- 매출·지출 및 자금 흐름 데이터가 정의되어야 함
- 금융상태와 업종 평균 데이터가 정의되어야 함
- 정책·지원사업 검색 조건이 정의되어야 함
- 분석 실행과 인사이트 결과 저장 방식이 정의되어야 함
- 회복 플랜을 분석 결과에서 생성하는 방식이 정의되어야 함
- 더미 데이터 입력 방식이 정의되어야 함
- 실제 원본 데이터 저장 금지 기준이 포함되어야 함
- Django 모델로 구현할 수 있어야 함
