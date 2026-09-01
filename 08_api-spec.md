# 08. API 명세서

## 문서 정보

| 항목 | 내용 |
|---|---|
| 문서 상태 | 초안 |
| 관련 문서 | `01_prd.md`, `02_function-spec.md`, `03_user-flow.md`, `04_data-spec.md`, `05_system-architecture.md`, `06_screen-spec.md`, `07_db-schema.md` |
| API 방식 | Django REST Framework 기반 REST API |
| 기본 경로 | `/api/v1/` |
| 데이터 형식 | JSON |
| 인증 | 프로토타입에서는 미적용 |
| 데이터 기준 | AI 생성 더미 데이터 및 분석 결과 중심 |
| 원천데이터 처리 | 실제 원천데이터 파일은 저장·배포하지 않고 집계·분석 결과만 사용 |

## 1. API 설계 원칙

- 모든 API는 `/api/v1/` 하위에 둔다.
- 요청·응답 필드명은 `snake_case`로 통일한다.
- 금액, 비율, 인구 수 등 수치에는 가능한 한 `unit`을 함께 제공한다.
- 실제 원천데이터가 아닌 화면 시연에 필요한 집계 결과를 제공한다.
- `source_type`은 서버가 관리하며, 클라이언트가 임의로 변경하지 못하도록 한다.
- 프로토타입은 동기 처리로 구현하고, 향후 데이터 규모가 커지면 분석 작업을 비동기 처리로 확장한다.

## 2. 공통 응답 형식

### 2.1 성공 응답

```json
{
  "data": {},
  "meta": {
    "request_id": "req_20260901_0001"
  },
  "error": null
}
```

### 2.2 목록 응답

```json
{
  "data": [],
  "meta": {
    "request_id": "req_20260901_0002",
    "page": 1,
    "page_size": 20,
    "total_count": 45
  },
  "error": null
}
```

### 2.3 오류 응답

```json
{
  "data": null,
  "meta": {
    "request_id": "req_20260901_0003"
  },
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "period_start는 period_end보다 이전이어야 합니다.",
    "fields": {
      "period_start": ["기간을 확인해 주세요."]
    }
  }
}
```

### 2.4 공통 HTTP 상태 코드

| 상태 코드 | 사용 상황 |
|---|---|
| `200` | 조회·분석 요청 성공 |
| `201` | 데이터 생성 성공 |
| `400` | 필수값 누락, 형식 오류, 기간 오류 |
| `404` | 요청한 자원 없음 |
| `500` | 서버 내부 오류 |

## 3. API 목록

| ID | Method | Endpoint | 용도 |
|---|---|---|---|
| A-01 | POST | `/analysis-runs` | 분석 실행 생성 |
| A-02 | GET | `/analysis-runs/{analysis_run_id}` | 분석 실행 상태 조회 |
| A-03 | GET | `/analysis-runs/{analysis_run_id}/dashboard` | 메인 대시보드 요약 조회 |
| A-04 | GET | `/analysis-runs/{analysis_run_id}/insights` | 상세 인사이트 조회 |
| A-05 | GET | `/stores/{store_profile_id}/sales-expenses` | 매출·지출 조회 |
| A-06 | POST | `/stores/{store_profile_id}/sales-expenses` | 매출·지출 입력 |
| A-07 | GET | `/stores/{store_profile_id}/cashflow` | 자금 흐름 조회 |
| A-08 | POST | `/stores/{store_profile_id}/cashflow` | 자금 흐름 입력 |
| A-09 | GET | `/stores/{store_profile_id}/finance` | 금융 체온계 조회 |
| A-10 | GET | `/policies` | 정책·지원사업 목록 조회 |
| A-11 | GET | `/policies/{policy_id}` | 정책·지원사업 상세 조회 |
| A-12 | GET | `/analysis-runs/{analysis_run_id}/report` | AI 리포트 조회 |
| A-13 | POST | `/assistant/messages` | AI 비서 질문·답변 |
| A-14 | POST | `/stores/{store_profile_id}/receipts` | 영수증 업로드 |
| A-15 | GET | `/analysis-runs/{analysis_run_id}/recovery-plan` | 골목상권 회복 플랜 조회 |

## 4. 분석 실행 API

### A-01. 분석 실행 생성

`POST /api/v1/analysis-runs`

#### 요청

```json
{
  "store_profile_id": 1,
  "region": "대구 서문시장",
  "industry": "음식점",
  "revenue_range": "월 2,000만~3,000만 원",
  "period_start": "2024-01-01",
  "period_end": "2025-12-31"
}
```

#### 처리

1. 요청 조건을 검증한다.
2. 가게 정보와 분석 대상 기간을 저장한다.
3. 카드소비·유동인구·매출·지출 더미 데이터를 조회한다.
4. 매출 변화, 소비 변화, 유동인구 변화, 시간대별 격차를 계산한다.
5. 소비 전환 공백을 기반으로 회복 플랜을 생성한다.
6. `analysis_run`과 인사이트를 저장한다.

프로토타입에서는 요청 후 즉시 `completed` 상태를 반환한다. 실제 데이터 연계 시 `pending` → `running` → `completed` 또는 `failed` 상태로 확장한다.

#### 응답 예시

```json
{
  "data": {
    "analysis_run_id": 101,
    "status": "completed",
    "period_start": "2024-01-01",
    "period_end": "2025-12-31",
    "source_type": "dummy"
  },
  "meta": {"request_id": "req_20260901_0101"},
  "error": null
}
```

### A-02. 분석 실행 상태 조회

`GET /api/v1/analysis-runs/{analysis_run_id}`

```json
{
  "data": {
    "analysis_run_id": 101,
    "store_profile_id": 1,
    "status": "completed",
    "created_at": "2026-09-01T10:00:00+09:00",
    "completed_at": "2026-09-01T10:00:01+09:00",
    "source_type": "dummy"
  },
  "meta": {"request_id": "req_20260901_0102"},
  "error": null
}
```

## 5. 대시보드·인사이트 API

### A-03. 메인 대시보드 요약

`GET /api/v1/analysis-runs/{analysis_run_id}/dashboard`

```json
{
  "data": {
    "store_name": "이소현의 가게",
    "region": "대구 서문시장",
    "industry": "음식점",
    "metrics": {
      "sales_change_rate": {"value": -12.4, "unit": "%", "comparison_label": "최근 2년"},
      "card_consumption_change_rate": {"value": -8.1, "unit": "%", "comparison_label": "동일 업종"},
      "foot_traffic_change_rate": {"value": 3.2, "unit": "%", "comparison_label": "동일 상권"},
      "financial_temperature": {"value": 62, "unit": "점", "comparison_label": "동일 업종 평균 68점"}
    },
    "peak_times": [
      {"value": "12:00-14:00", "unit": "시간대"},
      {"value": "17:00-19:00", "unit": "시간대"}
    ],
    "hero_insight": "유동인구는 유지되고 있지만 점심 시간대 카드소비 전환이 낮은 요인 후보가 확인되었습니다.",
    "recovery_plan_available": true,
    "source_type": "dummy",
    "data_status": "분석 완료"
  },
  "meta": {"request_id": "req_20260901_0201"},
  "error": null
}
```

### A-04. 상세 인사이트

`GET /api/v1/analysis-runs/{analysis_run_id}/insights`

#### 응답 예시

```json
{
  "data": {
    "time_series": [
      {
        "analysis_month": "2025-12-01",
        "weekday": 6,
        "weekday_label": "토요일",
        "time_slot": "12:00-14:00",
        "value": 820,
        "unit": "명",
        "metric_type": "foot_traffic"
      }
    ],
    "conversion_gap": {
      "high_traffic_low_spend_time": "12:00-14:00",
      "traffic_value": 820,
      "traffic_unit": "명",
      "card_spend_value": 540000,
      "card_spend_unit": "원",
      "message": "유동인구 대비 카드소비가 낮은 시간대입니다."
    },
    "customer_segments": [
      {"segment": "20-30대", "share": 34.2, "unit": "%"},
      {"segment": "40-50대", "share": 41.5, "unit": "%"}
    ],
    "game_day_comparison": {
      "game_day_sales": 1320000,
      "non_game_day_sales": 980000,
      "unit": "원",
      "change_rate": 34.7,
      "change_rate_unit": "%"
    },
    "insights": [
      {
        "category": "매출 원인 후보",
        "title": "유동인구 대비 소비 전환 부족",
        "description": "유동인구는 전년 대비 증가했으나 카드소비는 감소한 요인 후보가 확인되었습니다.",
        "metric_value": -8.1,
        "metric_unit": "%",
        "priority": "high"
      }
    ],
    "recovery_plan_available": true,
    "source_type": "dummy"
  },
  "meta": {"request_id": "req_20260901_0202"},
  "error": null
}
```

## 6. 매출·지출 API

### A-05. 매출·지출 조회

`GET /api/v1/stores/{store_profile_id}/sales-expenses?period_start=2025-12-01&period_end=2025-12-31`

```json
{
  "data": {
    "period_start": "2025-12-01",
    "period_end": "2025-12-31",
    "summary": {
      "sales": {"value": 24500000, "unit": "원"},
      "expenses": {"value": 18300000, "unit": "원"},
      "operating_profit": {"value": 6200000, "unit": "원"},
      "operating_margin": {"value": 25.3, "unit": "%"}
    },
    "expense_categories": [
      {"expense_category": "재료비", "value": 7200000, "unit": "원"},
      {"expense_category": "인건비", "value": 5800000, "unit": "원"},
      {"expense_category": "임대료", "value": 3500000, "unit": "원"}
    ],
    "transactions": [],
    "source_type": "dummy"
  },
  "meta": {"request_id": "req_20260901_0301"},
  "error": null
}
```

### A-06. 매출·지출 입력

`POST /api/v1/stores/{store_profile_id}/sales-expenses`

```json
{
  "transaction_date": "2025-12-15",
  "transaction_type": "expense",
  "expense_category": "재료비",
  "description": "식재료 구매",
  "amount": 180000,
  "input_source": "manual"
}
```

응답은 생성된 거래 ID와 저장 시각을 반환한다. `amount`는 0보다 큰 숫자(원 단위)만 허용한다. 요청 필드명은 DB의 `expense_category`, `input_source`와 동일하게 사용한다.

## 7. 자금 흐름 API

### A-07. 자금 흐름 조회

`GET /api/v1/stores/{store_profile_id}/cashflow?month=2025-12`

조회 조건 `month`는 DB의 `snapshot_date`에서 해당 월을 조회하기 위한 화면용 조건입니다. DB에는 해당 월의 1일을 저장합니다.

```json
{
  "data": {
    "month": "2025-12",
    "current_cash": {"value": 8500000, "unit": "원"},
    "expected_sales": {"value": 24500000, "unit": "원"},
    "fixed_expenses": {"value": 9300000, "unit": "원"},
    "variable_expenses": {"value": 9000000, "unit": "원"},
    "expected_cashflow": {"value": 6200000, "unit": "원"},
    "risk_level": "주의",
    "source_type": "dummy"
  },
  "meta": {"request_id": "req_20260901_0401"},
  "error": null
}
```

예상 자금 흐름은 다음 기준으로 계산한다.

`현재 보유 현금 + 예상 매출 - 고정비 - 변동비`

### A-08. 자금 흐름 입력

`POST /api/v1/stores/{store_profile_id}/cashflow`

```json
{
  "snapshot_date": "2025-12-01",
  "current_cash": 8500000,
  "expected_sales": 24500000,
  "expected_expenses": 18300000,
  "rent_expense": 3500000,
  "material_expense": 7200000,
  "labor_expense": 5800000,
  "other_expense": 800000
}
```

입력값을 저장한 후 예상 자금 흐름과 위험 수준을 계산해 반환한다.

## 8. 금융 체온계 API

### A-09. 금융 상태 비교

`GET /api/v1/stores/{store_profile_id}/finance`

```json
{
  "data": {
    "financial_temperature": {
      "value": 62,
      "unit": "점",
      "status": "주의",
      "description": "동일 업종 평균보다 낮아 비용과 부채 흐름을 확인해 보세요."
    },
    "metrics": [
      {
        "metric": "sales",
        "user_value": 24500000,
        "industry_average": 27800000,
        "unit": "원",
        "comparison": "below_average",
        "evaluation": "낮음"
      },
      {
        "metric": "operating_margin",
        "user_value": 25.3,
        "industry_average": 22.8,
        "unit": "%",
        "comparison": "above_average",
        "evaluation": "양호"
      },
      {
        "metric": "debt_ratio",
        "user_value": 48.0,
        "industry_average": 42.5,
        "unit": "%",
        "comparison": "above_average",
        "evaluation": "주의",
        "note": "부채비율은 높을수록 상환 부담이 커질 수 있습니다."
      }
    ],
    "disclaimer": "참고용 비교 지표이며 실제 금융 심사 결과를 의미하지 않습니다.",
    "source_type": "dummy"
  },
  "meta": {"request_id": "req_20260901_0501"},
  "error": null
}
```

금융 체온계는 사용자 데이터를 전체 공개하지 않고, 동일 업종 또는 동일 조건의 평균과 비교한 참고 지표로만 제공한다.

## 9. 정책·지원사업 API

### A-10. 정책·지원사업 목록

`GET /api/v1/policies?region=대구&industry=음식점&revenue_range=월%202,000만~3,000만%20원&page=1&page_size=20`

#### 필터

| 필드 | 필수 | 설명 |
|---|---|---|
| `region` | 아니오 | 사업 대상 지역 |
| `industry` | 아니오 | 대상 업종 |
| `revenue_range` | 아니오 | 매출 조건 |
| `keyword` | 아니오 | 사업명·내용 검색어 |
| `status` | 아니오 | 모집 중, 종료 등 상태 |
| `page` | 아니오 | 기본값 1 |
| `page_size` | 아니오 | 기본값 20, 최대 100 |

#### 응답 예시

```json
{
  "data": [
    {
      "policy_id": 201,
      "program_name": "대구 소상공인 경영안정 지원",
      "organization": "대구광역시",
      "region": "대구",
      "support_type": "융자",
      "application_end": "2026-12-31",
      "target_description": "대구 소재 소상공인",
      "match_score": 92,
      "status": "모집 중"
    }
  ],
  "meta": {"request_id": "req_20260901_0601", "page": 1, "page_size": 20, "total_count": 1},
  "error": null
}
```

### A-11. 정책·지원사업 상세

`GET /api/v1/policies/{policy_id}`

목록에서 선택한 정책의 지원 대상, 지원 내용, 신청 기간, 신청 방법, 원문 링크, 지원 기관 및 모집 상태를 반환한다. `match_score`는 사용자 조건과 정책 조건을 비교해 서버가 계산하는 참고 점수다.

## 10. AI 리포트·AI 비서 API

### A-12. AI 리포트 조회

`GET /api/v1/analysis-runs/{analysis_run_id}/report`

```json
{
  "data": {
    "analysis_run_id": 101,
    "summary": "최근 매출은 감소했지만 유동인구는 유지되고 있어 소비 전환 관련 요인 후보를 확인할 필요가 있습니다.",
    "cause_and_evidence": [
      {
        "cause": "유동인구 대비 카드소비 전환 감소 요인 후보",
        "evidence": "유동인구 +3.2%, 카드소비 -8.1%",
        "source_type": "dummy"
      }
    ],
    "key_time": "12:00-14:00",
    "key_customer": "20-30대 및 인근 직장인",
    "finance_summary": "영업이익률은 평균보다 양호하지만 부채비율은 관리가 필요합니다.",
    "recommended_actions": [
      "점심 시간대 대표 메뉴와 프로모션을 점검하세요.",
      "유동인구가 높은 시간대에 노출을 집중하세요."
    ],
    "recovery_plan": {
      "focus_time": "12:00-14:00",
      "recommended_action": "점심 시간대 대표 메뉴와 홍보 노출을 집중하세요.",
      "opportunity_index": 18.5,
      "opportunity_index_unit": "점",
      "expected_cashflow_change": {"value": 650000, "unit": "원", "type": "reference_scenario"}
    },
    "policy_summary": "현재 조건에 맞는 지원사업 1건이 있습니다.",
    "source_type": "dummy"
  },
  "meta": {"request_id": "req_20260901_0701"},
  "error": null
}
```

### A-13. AI 비서 질문·답변

`POST /api/v1/assistant/messages`

#### 프로토타입 처리 원칙

- 현재 HTML 프로토타입은 외부 AI API를 호출하지 않는다.
- 브라우저 내부 JavaScript가 미리 정의된 더미 답변을 반환한다.
- 백엔드 API는 실제 서비스 확장을 위한 계약만 정의한다.

#### 요청

```json
{
  "analysis_run_id": 101,
  "message": "왜 이번 달 매출이 줄었나요?"
}
```

#### 응답

```json
{
  "data": {
    "message_id": 301,
    "answer": "유동인구는 유지됐지만 점심 시간대 카드소비 전환이 낮아진 요인 후보가 확인됩니다.",
    "related_insight_ids": [401, 402],
    "source_type": "dummy"
  },
  "meta": {"request_id": "req_20260901_0702"},
  "error": null
}
```

### A-14. 영수증 업로드

`POST /api/v1/stores/{store_profile_id}/receipts`

- Content-Type: `multipart/form-data`
- 입력: `file`, `transaction_date`(선택)
- 허용 파일: JPG, JPEG, PNG
- 파일 크기: 프로토타입에서는 10MB 이하

프로토타입에서는 이미지 저장 또는 OCR 연동 없이 업로드 성공 여부만 확인할 수 있다. 향후 OCR이 적용되면 품목, 금액, 거래일, 지출 분류 후보를 반환한다.

현재 프로토타입의 발표 핵심 흐름에는 영수증 업로드를 포함하지 않는다.

### A-15. 골목상권 회복 플랜 조회

`GET /api/v1/analysis-runs/{analysis_run_id}/recovery-plan`

분석 실행 결과에서 소비 전환 공백, 집중 시간대, 추천 운영 행동, 참고용 소비 기회 지수 및 자금 흐름 시나리오를 반환한다.

```json
{
  "data": {
    "analysis_run_id": 101,
    "cause_candidate": "12:00-14:00 유동인구 대비 카드소비가 낮음",
    "evidence": [
      {"metric": "foot_traffic", "value": 820, "unit": "명"},
      {"metric": "card_spend", "value": 540000, "unit": "원"}
    ],
    "focus_time": "12:00-14:00",
    "target_customer": "20-30대 및 인근 직장인",
    "recommended_actions": [
      "점심 시간대 대표 메뉴와 홍보 노출을 집중하세요.",
      "해당 시간대의 배달 운영 조건을 점검하세요."
    ],
    "opportunity_index": {"value": 18.5, "unit": "점"},
    "expected_cashflow_change": {"value": 650000, "unit": "원", "type": "reference_scenario"},
    "disclaimer": "비교지표 기반 참고용 시나리오이며 실제 매출이나 금융 결과를 보장하지 않습니다.",
    "source_type": "dummy"
  },
  "meta": {"request_id": "req_20260901_0801"},
  "error": null
}
```

## 11. 화면과 API 연결

| 화면·기능 | 사용하는 API |
|---|---|
| 메인 대시보드 카드 | A-02, A-03 |
| 매출·지출 분석 | A-05, A-06 |
| 자금 흐름 | A-07, A-08 |
| 금융 체온계 | A-09 |
| 정책·지원사업 | A-10, A-11 |
| 골목상권 회복 플랜 | A-15 |
| AI 리포트 | A-12 |
| 우측 AI 비서 채팅창 | A-13 또는 프로토타입 로컬 더미 로직 |
| 영수증 입력 | A-14 |

## 12. 전체 처리 흐름

```text
사용자 조건 입력
    ↓
POST /analysis-runs
    ↓
분석 실행 생성 및 더미 데이터 조회
    ↓
매출·카드소비·유동인구·금융지표 계산
        ↓
인사이트·회복 플랜·정책 매칭·리포트 생성
    ↓
GET /dashboard, /insights, /recovery-plan, /report
    ↓
화면 카드·그래프·AI 비서 답변으로 표시
```

## 13. 검증 및 예외 처리

- `store_profile_id`, `analysis_run_id`, `policy_id`는 존재 여부를 확인한다.
- 시작일은 종료일보다 늦을 수 없다.
- 분석 기간은 프로토타입에서 최대 24개월로 제한한다.
- 금액과 수량은 음수를 허용하지 않는다.
- 필수값이 없으면 `400 VALIDATION_ERROR`를 반환한다.
- 데이터가 없으면 빈 배열과 함께 `data_status: "no_data"`를 반환한다.
- 분석 실패 시 `500 ANALYSIS_ERROR`를 반환하고, 사용자에게 재시도 안내를 표시한다.
- 실제 금융 심사나 대출 승인으로 오해할 수 있는 표현은 사용하지 않는다.

## 14. 데이터 및 보안 원칙

- 실제 카드사·통신사 원천데이터 파일은 프로토타입 저장소에 포함하지 않는다.
- 시연용 데이터는 더미 데이터 또는 허용된 집계·분석 결과만 사용한다.
- 주민등록번호, 계좌 비밀번호, 카드번호 전체 등 민감정보는 수집하지 않는다.
- 개인정보가 포함된 영수증은 실제 배포 전에 비식별화·보관 기간 정책을 정해야 한다.
- API 키와 데이터베이스 비밀번호는 환경변수로 관리한다.
- 응답에 제공하는 데이터는 서비스 화면에 필요한 최소 범위로 제한한다.

## 15. 구현 우선순위

### 1순위: 프로토타입 시연 필수

- A-01 분석 실행 생성
- A-02 분석 상태 조회
- A-03 메인 대시보드
- A-04 상세 인사이트
- A-15 골목상권 회복 플랜
- A-12 AI 리포트
- A-13 AI 비서 더미 채팅

### 2순위: 기능 시연 보강

- A-05, A-06 매출·지출
- A-07, A-08 자금 흐름
- A-09 금융 체온계
- A-10, A-11 정책·지원사업

### 3순위: 확장 기능

- A-14 영수증 업로드 및 OCR 연동
- 실제 데이터 수집·갱신 배치
- 사용자 인증·권한 관리
- 외부 AI 모델 연동 및 대화 이력 저장

## 16. 완료 기준

- 분석 조건을 입력하면 분석 실행 ID가 생성된다.
- 대시보드에서 매출·카드소비·유동인구 변화율을 확인할 수 있다.
- 유동인구와 카드소비의 차이를 인사이트 문장과 그래프로 확인할 수 있다.
- 매출 감소 요인 후보와 근거가 AI 리포트에 표시된다.
- 회복 플랜에서 추천 행동과 참고용 금융 효과를 확인할 수 있다.
- 우측 AI 비서에서 정해진 질문에 더미 답변이 표시된다.
- 정책·지원사업 목록에서 지역·업종·매출 조건으로 검색할 수 있다.
- 모든 시연 데이터는 실제 원천데이터가 아닌 더미 또는 집계 결과로 구성된다.
