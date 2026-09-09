(function (root) {
  'use strict';

  const EVENT_NAME = 'im-profile-finance:open';
  const VALID_STATUSES = new Set(['partial', 'complete', 'unavailable']);
  const CONTROLLERS = new WeakMap();

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function finiteNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || !value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function clampInteger(value, minimum, maximum) {
    const number = finiteNumber(value);
    if (number === null) return minimum;
    return Math.max(minimum, Math.min(maximum, Math.round(number)));
  }

  function cleanList(value) {
    if (!Array.isArray(value)) return [];
    return value.map(item => String(item || '').trim()).filter(Boolean);
  }

  function formatMetric(value, unit) {
    const number = finiteNumber(value);
    if (number === null) return '자료 없음';
    const digits = Number.isInteger(number) ? 0 : 1;
    return number.toLocaleString('ko-KR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: 1
    }) + (unit || '');
  }

  function normalize(input) {
    const source = input && typeof input === 'object' ? input : {};
    let status = VALID_STATUSES.has(source.status) ? source.status : 'unavailable';
    const totalCount = Math.max(1, clampInteger(source.totalCount, 1, 12));
    const measuredCount = clampInteger(source.measuredCount, 0, totalCount);
    if (status === 'complete' && measuredCount < totalCount) status = 'partial';
    const measured = cleanList(source.measured);
    const missing = cleanList(source.missing);
    const metric = source.metric && typeof source.metric === 'object' ? source.metric : {};
    const metricValue = finiteNumber(metric.value);
    const delta = finiteNumber(metric.delta);
    const direction = ['better', 'worse', 'neutral', 'unknown'].includes(metric.direction)
      ? metric.direction
      : 'unknown';
    const temperatureSource = source.temperature && typeof source.temperature === 'object'
      ? source.temperature
      : null;
    const temperatureValue = temperatureSource ? finiteNumber(temperatureSource.value) : null;
    const temperatureDelta = temperatureSource ? finiteNumber(temperatureSource.delta) : null;
    const temperatureVerified = Boolean(
      status === 'complete' &&
      measuredCount === totalCount &&
      temperatureSource &&
      temperatureValue !== null &&
      temperatureSource.dataStatus === 'available' &&
      String(temperatureSource.ruleVersion || '').trim() &&
      String(temperatureSource.statusLabel || '').trim() &&
      String(temperatureSource.scoringDefinition || '').trim()
    );
    const referenceTemperatureSource = source.referenceTemperature && typeof source.referenceTemperature === 'object'
      ? source.referenceTemperature
      : null;
    const referenceTemperatureRawValue = referenceTemperatureSource
      ? finiteNumber(referenceTemperatureSource.value)
      : null;
    const referenceTemperatureValue = referenceTemperatureRawValue === null
      ? null
      : Math.max(0, Math.min(100, referenceTemperatureRawValue));
    const referenceTemperatureDelta = referenceTemperatureSource
      ? finiteNumber(referenceTemperatureSource.delta)
      : null;
    const referenceTemperatureVerified = Boolean(
      status !== 'unavailable' &&
      measuredCount >= 2 &&
      referenceTemperatureSource &&
      referenceTemperatureValue !== null &&
      referenceTemperatureSource.dataStatus === 'reference' &&
      String(referenceTemperatureSource.ruleVersion || '').trim() &&
      String(referenceTemperatureSource.scoringDefinition || '').trim() &&
      String(referenceTemperatureSource.basisLabel || '').trim()
    );

    return {
      status,
      measuredCount,
      totalCount,
      measured,
      missing,
      period: String(source.period || '기준 기간 미확인'),
      sourceLabel: String(source.sourceLabel || '자료 출처 미확인'),
      destination: String(source.destination || 'finance-thermometer'),
      storeProfileId: source.storeProfileId == null ? null : String(source.storeProfileId),
      analysisRunId: source.analysisRunId == null ? null : String(source.analysisRunId),
      metric: {
        label: String(metric.label || '금융상태'),
        value: metricValue,
        unit: String(metric.unit || ''),
        delta,
        deltaUnit: String(metric.deltaUnit || ''),
        deltaLabel: String(metric.deltaLabel || '이전 기간보다'),
        direction
      },
      temperature: temperatureVerified ? {
        value: temperatureValue,
        unit: String(temperatureSource.unit || '°'),
        delta: temperatureDelta,
        deltaUnit: String(temperatureSource.deltaUnit || '°'),
        deltaLabel: String(temperatureSource.deltaLabel || '이전 기간보다'),
        direction: temperatureDelta === null
          ? 'unknown'
          : temperatureDelta > 0 ? 'better' : temperatureDelta < 0 ? 'worse' : 'neutral',
        statusLabel: String(temperatureSource.statusLabel || '상태 확인'),
        ruleVersion: String(temperatureSource.ruleVersion),
        scoringDefinition: String(temperatureSource.scoringDefinition),
        dataStatus: 'available'
      } : null,
      referenceTemperature: referenceTemperatureVerified ? {
        value: referenceTemperatureValue,
        unit: String(referenceTemperatureSource.unit || '°'),
        delta: referenceTemperatureDelta,
        deltaUnit: String(referenceTemperatureSource.deltaUnit || '°'),
        deltaLabel: String(referenceTemperatureSource.deltaLabel || '이전 기간보다'),
        direction: referenceTemperatureDelta === null
          ? 'unknown'
          : referenceTemperatureDelta > 0 ? 'better' : referenceTemperatureDelta < 0 ? 'worse' : 'neutral',
        basisLabel: String(referenceTemperatureSource.basisLabel),
        ruleVersion: String(referenceTemperatureSource.ruleVersion),
        scoringDefinition: String(referenceTemperatureSource.scoringDefinition),
        dataStatus: 'reference'
      } : null
    };
  }

  function displayedTemperature(summary) {
    return summary.temperature || summary.referenceTemperature;
  }

  function statusText(summary) {
    return '연결 데이터 ' + summary.measuredCount + '/' + summary.totalCount;
  }

  function deltaText(summary) {
    const temperature = displayedTemperature(summary);
    const delta = temperature ? temperature.delta : null;
    if (delta === null) return '비교 자료 없음';
    if (delta === 0) return temperature.deltaLabel + ' 동일';
    const movement = delta > 0 ? ' 높음' : ' 낮음';
    return temperature.deltaLabel + ' ' + formatMetric(Math.abs(delta), temperature.deltaUnit) + movement;
  }

  function primaryText(summary) {
    const temperature = displayedTemperature(summary);
    if (temperature) {
      return {
        label: '나의 금융 온도',
        value: formatMetric(temperature.value, temperature.unit)
      };
    }
    return {
      label: '나의 금융 온도',
      value: '측정 전'
    };
  }

  function accessibleValue(value, unit) {
    const formatted = formatMetric(value, '');
    if (formatted === '자료 없음') return formatted;
    const spokenUnit = unit === '%p'
      ? '퍼센트포인트'
      : unit === '%'
        ? '퍼센트'
        : unit === '°' || unit === '℃'
          ? '도'
          : unit;
    return formatted + (spokenUnit || '');
  }

  function accessibleDeltaText(summary) {
    const temperature = displayedTemperature(summary);
    const delta = temperature ? temperature.delta : null;
    if (delta === null) return '비교 자료 없음';
    if (delta === 0) return temperature.deltaLabel + ' 동일';
    const movement = delta > 0 ? ' 높음' : ' 낮음';
    return temperature.deltaLabel + ' ' + accessibleValue(Math.abs(delta), temperature.deltaUnit) + movement;
  }

  function accessibleLabel(summary) {
    const primary = primaryText(summary);
    const temperature = displayedTemperature(summary);
    const coverage = '연결 데이터, ' + summary.totalCount + '개 중 ' + summary.measuredCount + '개 연결';
    const parts = [
      '금융 체온계',
      coverage,
      primary.label + ' ' + (temperature
        ? accessibleValue(temperature.value, temperature.unit)
        : '측정 전'),
      accessibleDeltaText(summary),
      '금융 체온계로 이동',
      '경영 참고용 지표입니다. 종합 온도가 아니며, 신용평가와 대출심사 결과와도 무관합니다'
    ];
    return parts.join(', ');
  }

  function render(container, rawSummary, options) {
    const summary = normalize(rawSummary);
    const wrapper = element('div', 'ipf-profile-finance');
    wrapper.dataset.status = summary.status;

    const button = element('button', 'ipf-profile-finance__button');
    button.type = 'button';
    if (options && options.buttonRole === 'menuitem') button.setAttribute('role', 'menuitem');
    button.setAttribute('aria-label', accessibleLabel(summary));
    const activeTemperature = displayedTemperature(summary);
    button.dataset.direction = activeTemperature ? activeTemperature.direction : 'unknown';

    const heading = element('span', 'ipf-profile-finance__heading');
    const chevron = element('span', 'ipf-profile-finance__chevron');
    chevron.setAttribute('aria-hidden', 'true');
    heading.append(element('strong', '', '금융 체온계'), chevron);

    const basisText = summary.referenceTemperature
      ? summary.referenceTemperature.basisLabel
      : activeTemperature ? '연결 데이터 기반 금융 온도' : '데이터 연결 후 온도 표시';
    const basis = element('span', 'ipf-profile-finance__basis', basisText);
    const details = element('span', 'ipf-profile-finance__details');
    const status = element('span', 'ipf-profile-finance__status', statusText(summary));
    const trend = element('span', 'ipf-profile-finance__trend', deltaText(summary));
    trend.dataset.direction = activeTemperature ? activeTemperature.direction : 'unknown';
    details.append(status, trend);

    button.append(heading, basis, details);
    wrapper.append(button);
    container.replaceChildren(wrapper);

    button.addEventListener('click', function () {
      button.dispatchEvent(new CustomEvent(EVENT_NAME, {
        bubbles: true,
        composed: true,
        detail: {
          target: summary.destination,
          source: 'profile-menu',
          storeProfileId: summary.storeProfileId,
          analysisRunId: summary.analysisRunId
        }
      }));
    });

    return summary;
  }

  function mount(target, initialSummary, options) {
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!(container instanceof Element)) {
      throw new TypeError('프로필 금융상태를 표시할 요소가 필요합니다.');
    }
    const existing = CONTROLLERS.get(container);
    if (existing) {
      existing.update(initialSummary);
      return existing;
    }
    const settings = options && typeof options === 'object' ? options : {};
    const host = element('div', 'ipf-profile-finance-host');
    host.dataset.ipfOwned = 'true';
    if (settings.buttonRole === 'menuitem') host.setAttribute('role', 'none');
    if (settings.after instanceof Element && settings.after.parentElement === container) {
      settings.after.insertAdjacentElement('afterend', host);
    } else {
      container.append(host);
    }
    let current = render(host, initialSummary, settings);
    let destroyed = false;
    const controller = {
      update(nextSummary) {
        if (destroyed) throw new Error('삭제된 프로필 금융상태 컴포넌트는 갱신할 수 없습니다.');
        current = render(host, nextSummary, settings);
        return current;
      },
      getSummary() {
        return current;
      },
      getElement() {
        return host.firstElementChild;
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        host.remove();
        CONTROLLERS.delete(container);
      }
    };
    CONTROLLERS.set(container, controller);
    return controller;
  }

  root.IMProfileFinance = Object.freeze({
    EVENT_NAME,
    mount,
    normalize
  });
})(window);
