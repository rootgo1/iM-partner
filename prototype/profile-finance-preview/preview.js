(function () {
  'use strict';

  const referenceTemperature = {
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
  };

  const summaries = {
    partial: {
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
      referenceTemperature,
      temperature: null
    },
    complete: {
      status: 'complete',
      measuredCount: 4,
      totalCount: 4,
      measured: ['매출', '지출', '현금잔액', '예정 입출금'],
      missing: [],
      period: '연동 완료 예시',
      sourceLabel: '화면 상태 검토용',
      destination: 'finance-thermometer',
      metric: {
        label: '지출 부담',
        value: 48.1,
        unit: '%',
        delta: 8.8,
        deltaUnit: '%p',
        deltaLabel: '이전 기간보다',
        direction: 'worse'
      },
      referenceTemperature,
      temperature: null
    },
    unavailable: {
      status: 'unavailable',
      measuredCount: 0,
      totalCount: 4,
      measured: [],
      missing: ['매출', '지출', '현금잔액', '예정 입출금'],
      period: '기준 기간 미확인',
      sourceLabel: '자료 연결 필요',
      destination: 'finance-thermometer',
      metric: {
        label: '지출 부담',
        value: null,
        unit: '%',
        delta: null,
        deltaUnit: '%p',
        deltaLabel: '이전 기간보다',
        direction: 'unknown'
      },
      referenceTemperature: null,
      temperature: null
    }
  };

  const popover = document.querySelector('#previewProfilePopover');
  const trigger = document.querySelector('#previewProfileTrigger');
  const notice = document.querySelector('#previewEventNotice');
  const temperatureBadge = document.querySelector('#previewTemperatureBadge');
  const component = window.IMProfileFinance.mount('#profileFinanceMount', summaries.partial);

  function updateTemperatureBadge(summary) {
    const temperature = summary.temperature || summary.referenceTemperature;
    const text = temperature ? temperature.value.toFixed(1) + '°' : '측정 전';
    temperatureBadge.textContent = text;
    temperatureBadge.dataset.status = summary.status;
    temperatureBadge.setAttribute('aria-label', '나의 금융 온도 ' + (temperature ? temperature.value.toFixed(1) + '도' : '측정 전'));
  }

  updateTemperatureBadge(summaries.partial);

  function setPopover(open) {
    popover.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  }

  trigger.addEventListener('click', function () {
    const open = popover.hidden;
    setPopover(open);
    if (open) {
      requestAnimationFrame(function () {
        popover.querySelector('.ipf-profile-finance__button')?.focus();
      });
    }
  });

  document.querySelectorAll('[data-preview-state]').forEach(function (button) {
    button.addEventListener('click', function () {
      const state = button.dataset.previewState;
      component.update(summaries[state]);
      updateTemperatureBadge(summaries[state]);
      document.querySelectorAll('[data-preview-state]').forEach(function (peer) {
        peer.setAttribute('aria-pressed', String(peer === button));
      });
      setPopover(true);
      notice.classList.remove('is-received');
      notice.textContent = state === 'partial'
        ? '현재 구현 상태: 매출·지출을 기준으로 참고 온도 51.9°를 표시합니다.'
        : state === 'complete'
          ? '연결 데이터가 늘어나도 이 값은 매출·지출 기반 참고 온도입니다.'
          : '자료가 없을 때 임의의 0점이나 온도를 만들지 않습니다.';
    });
  });

  document.addEventListener(window.IMProfileFinance.EVENT_NAME, function (event) {
    window.__lastProfileFinanceEvent = event.detail;
    window.__profileFinanceEventCount = (window.__profileFinanceEventCount || 0) + 1;
    notice.classList.add('is-received');
    notice.textContent = '금융 체온계 이동 요청이 전달되었습니다. 홈 통합 시 최신 대시보드 위치로 연결합니다.';
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !popover.hidden) {
      setPopover(false);
      trigger.focus();
    }
  });
})();
