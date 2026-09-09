# 프로필 금융 체온계 독립 컴포넌트

별도 폴더에서 만든 프로필 금융 체온계 UI이며, 현재 메인 프로토타입의 프로필 메뉴에 연결되어 있습니다. 독립 미리보기도 그대로 유지해 컴포넌트를 따로 확인할 수 있습니다.

## 현재 표시 원칙

- 프로필 메뉴와 하단 프로필 버튼의 이름 옆에 금융 온도 배지를 표시합니다.
- 개인의 평판이 아니라 선택한 사업장의 경영상태를 설명합니다.
- 현재 생성 자료의 매출 대비 지출률을 `100 - 지출률`로 변환한 `나의 금융 온도 51.9°`를 표시합니다.
- 이름 옆에는 클릭·호버가 없는 `51.9°` 배지만 표시합니다.
- 배지 아래의 짧은 요약에는 `금융 체온계`, `매출·지출 기반 참고 온도`, `연결 데이터 2/4`, `전월보다 8.8° 낮음`만 표시합니다.
- 누락 항목·기간·주의 문구를 비롯한 상세 내용은 홈의 금융 체온계에서 확인합니다.
- 이 값은 종합 온도가 아니라 매출·지출만 반영한 경영 참고용 지표입니다.
- 자료가 없으면 0°로 처리하지 않고 `측정 전`으로 표시합니다.
- 연결 상태와 신용평가·대출심사 관련 안내는 금융 체온계 요약의 접근성 설명에도 유지합니다.

## 파일 구성

- `profile-finance.js`: 데이터 정규화, 안전한 DOM 렌더링, 이동 이벤트를 제공하는 재사용 컴포넌트
- `profile-finance.css`: `ipf-` 접두어를 사용한 컴포넌트 전용 스타일
- `index.html`, `preview.css`, `preview.js`: 홈 화면과 분리된 작동 미리보기
- `profile-finance.test.cjs`: 데스크톱·모바일·상태·키보드·이벤트 계약 검사

## 데이터 계약

```js
const profileFinance = window.IMProfileFinance.mount('#profileFinanceMount', {
  status: 'partial',
  measuredCount: 2,
  totalCount: 4,
  measured: ['매출', '지출'],
  missing: ['현금잔액', '예정 입출금'],
  period: '2026년 8월',
  sourceLabel: '생성 데이터 기반 시연',
  destination: 'finance-thermometer',
  metric: {
    label: '지출 부담',
    value: 48.1,
    unit: '%',
    delta: 8.8,
    deltaUnit: '%p',
    deltaLabel: '전월보다',
    direction: 'worse'
  },
  referenceTemperature: {
    value: 51.9,
    previousValue: 60.7,
    unit: '°',
    delta: -8.8,
    deltaUnit: '°',
    deltaLabel: '전월보다',
    direction: 'worse',
    basisLabel: '매출·지출 기반 참고 온도',
    ruleVersion: 'expense-ratio-reference-v1',
    scoringDefinition: '100 - 매출 대비 지출률',
    dataStatus: 'reference'
  },
  temperature: null
}, {
  // 현재 홈처럼 상위 팝업이 role="menu"일 때만 지정합니다.
  buttonRole: 'menuitem'
});
```

상태가 바뀌면 `profileFinance.update(nextSummary)`를 호출합니다.

현재 프로토타입의 참고 온도는 `referenceTemperature`로 분리합니다. 값뿐 아니라 산식 버전, 산식 정의, 표시 근거와 `dataStatus: 'reference'`가 모두 있어야 표시됩니다. 실제 종합 온도용 `temperature`는 전체 측정이 완료되고 검증 정보와 `dataStatus: 'available'`이 모두 있을 때만 별도로 렌더링됩니다.

## 이동 이벤트 계약

금융 체온계 버튼을 누르면 다음 사용자 정의 이벤트가 상위 문서로 전달됩니다.

```js
document.addEventListener('im-profile-finance:open', event => {
  // 메인 프로토타입은 대시보드로 이동한 뒤 금융 체온계 제목에 초점을 둡니다.
  console.log(event.detail.target); // finance-thermometer
});
```

이벤트에는 이동에 필요한 `target`, `source`, `storeProfileId`, `analysisRunId`만 포함합니다. 금융 수치 전체를 이벤트에 복제하지 않습니다.

컴포넌트는 기존 홈 화면의 `navigate()` 함수, 해시 주소, DOM ID를 직접 호출하지 않습니다. 이 분리 덕분에 홈 화면 구조가 바뀌어도 이벤트 연결부만 조정하면 됩니다.

독립 미리보기처럼 상위 팝업이 `role="dialog"`이면 `buttonRole` 옵션을 생략합니다. 기존 홈의 `role="menu"` 안에 삽입할 때는 `{ buttonRole: 'menuitem' }`을 전달해야 ARIA 구조가 유지됩니다.

메인 프로토타입에서는 사용자 정보 아래의 전용 마운트 요소에 삽입합니다.

```js
window.IMProfileFinance.mount(document.querySelector('#profileMenuFinanceMount'), data, {
  buttonRole: 'menuitem'
});
```

이 경우에도 컴포넌트가 소유한 요소만 추가·갱신·삭제하며, 기존 프로필 정보와 로그아웃 항목은 보존합니다. 같은 컨테이너에 반복해서 마운트해도 컴포넌트는 하나만 유지됩니다.

## 현재 통합 위치

1. `main-screen.html`이 컴포넌트 CSS와 JS를 불러옵니다.
2. `meeting-ui.js`가 이름 옆 정적 온도 배지와 사용자 정보 아래의 짧은 금융 체온계 요약을 갱신합니다.
3. 선택 기간이 바뀌면 매출 대비 지출 비율로 계산한 참고 온도와 직전 기간 대비 온도 차이를 갱신합니다.
4. 프로필의 가게·지역·업종이 고정 생성자료와 달라지면 다른 가게의 수치처럼 보이지 않도록 `측정 전`으로 전환합니다.
5. 금융 체온계 버튼을 누르면 홈의 `나의 금융 체온계`로 이동하고 제목에 초점을 둡니다.

## 독립 테스트

독립 동작 검사는 Playwright 테스트로, 메인 화면 연결 계약은 브라우저가 필요 없는 통합 테스트로 확인합니다.

```powershell
node .\prototype\profile-finance-preview\profile-finance.test.cjs
node .\prototype\profile-finance-preview\profile-finance.integration.test.cjs
```
