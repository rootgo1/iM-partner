(function () {
  'use strict';

  const ENHANCED_SCROLL_QUERY = '(min-width: 761px) and (min-height: 720px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';
  const INPUT_QUIET_TIME = 120;
  const SECTION_COMMIT_RATIO = 0.38;

  let root = null;
  let lenis = null;
  let sections = [];
  let resizeTimer = null;
  let settleTimer = null;
  let viewportHeight = 0;
  let lastSettledIndex = 0;
  let inputSequence = 0;
  let isSettling = false;
  let settleTargetIndex = null;
  let removeVirtualScrollListener = null;
  let gestureDelta = 0;
  let gestureEventCount = 0;
  let gestureHasCoarseWheel = false;

  function supportsEnhancedScroll() {
    return typeof window.Lenis === 'function' && window.matchMedia(ENHANCED_SCROLL_QUERY).matches;
  }

  function clampIndex(index) {
    return Math.max(0, Math.min(sections.length - 1, index));
  }

  function clearSettleTimer() {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = null;
  }

  function resetGesture() {
    gestureDelta = 0;
    gestureEventCount = 0;
    gestureHasCoarseWheel = false;
  }

  function clearScrollState() {
    clearSettleTimer();
    isSettling = false;
    settleTargetIndex = null;
    resetGesture();
    if (!root) return;
    root.classList.remove('is-lenis-enhanced', 'is-section-settling');
    root.removeAttribute('data-scroll-mode');
    root.querySelectorAll('[data-lenis-prevent-vertical]').forEach(element => element.removeAttribute('data-lenis-prevent-vertical'));
    root.querySelectorAll('[data-lenis-prevent-horizontal]').forEach(element => element.removeAttribute('data-lenis-prevent-horizontal'));
  }

  function destroy() {
    inputSequence += 1;
    clearSettleTimer();
    if (removeVirtualScrollListener) removeVirtualScrollListener();
    removeVirtualScrollListener = null;
    if (lenis) lenis.destroy();
    lenis = null;
    clearScrollState();
  }

  function markNestedScrollAreas() {
    if (!root) return;
    root.querySelectorAll('[data-lenis-prevent-vertical]').forEach(element => element.removeAttribute('data-lenis-prevent-vertical'));
    root.querySelectorAll('.v-table-wrap').forEach(element => element.setAttribute('data-lenis-prevent-horizontal', ''));
  }

  function isNestedScrollInput(event, deltaY) {
    if (!event || typeof event.composedPath !== 'function') return false;
    const path = event.composedPath();
    return path.slice(0, path.indexOf(root)).some(node => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.hasAttribute('data-lenis-prevent') || node.matches('select, option, dialog, [role="slider"]')) return true;
      if (!/^(auto|scroll|overlay)$/.test(getComputedStyle(node).overflowY)) return false;
      const limit = node.scrollHeight - node.clientHeight;
      return limit > 2 && (deltaY > 0 ? node.scrollTop < limit - 1 : node.scrollTop > 1);
    });
  }

  function chooseSectionIndex(targetScroll) {
    const page = Math.max(0, Math.min(sections.length - 1, targetScroll / Math.max(1, viewportHeight)));
    const origin = clampIndex(lastSettledIndex);
    const displacement = page - origin;
    const direction = Math.sign(gestureDelta);
    const directionalWheelGesture = direction !== 0 && Math.abs(gestureDelta) >= 36 && (
      gestureHasCoarseWheel || gestureEventCount <= 3
    );

    if (directionalWheelGesture) return clampIndex(origin + direction);
    if (Math.abs(displacement) < SECTION_COMMIT_RATIO) return origin;
    if (displacement > 0) return clampIndex(Math.max(origin + 1, Math.round(page)));
    return clampIndex(Math.min(origin - 1, Math.round(page)));
  }

  function completeSettle(sequence, index) {
    if (sequence !== inputSequence || !root) return;
    lastSettledIndex = clampIndex(index);
    isSettling = false;
    settleTargetIndex = null;
    root.classList.remove('is-section-settling');
    resetGesture();
  }

  function settleAtSection(sequence) {
    settleTimer = null;
    if (!lenis || !root || sequence !== inputSequence) return;

    const targetIndex = chooseSectionIndex(lenis.targetScroll);
    const target = targetIndex * viewportHeight;
    const distance = Math.abs(target - lenis.scroll);

    if (distance <= 1.5) {
      lenis.scrollTo(target, { immediate: true });
      completeSettle(sequence, targetIndex);
      return;
    }

    const distanceRatio = Math.min(1, distance / Math.max(1, viewportHeight));
    const duration = 0.24 + distanceRatio * 0.16;
    isSettling = true;
    settleTargetIndex = targetIndex;
    root.classList.add('is-section-settling');
    lenis.scrollTo(target, {
      duration,
      easing: progress => 1 - Math.pow(1 - progress, 4),
      force: true,
      userData: { initiator: 'section-settle' },
      onComplete: () => completeSettle(sequence, targetIndex)
    });
  }

  function handleVirtualScroll({ deltaY, event }) {
    if (!lenis || !root || !deltaY) return;

    if (isSettling) {
      const incomingDirection = Math.sign(deltaY);
      const settleDirection = Math.sign(settleTargetIndex - lastSettledIndex);
      if (settleDirection !== 0 && incomingDirection === settleDirection) {
        if (event.cancelable) event.preventDefault();
        event.lenisStopPropagation = true;
        return;
      }
    }

    const continuingGesture = settleTimer !== null;
    inputSequence += 1;
    const sequence = inputSequence;
    clearSettleTimer();

    if (isSettling) {
      lenis.reset();
      isSettling = false;
      settleTargetIndex = null;
      root.classList.remove('is-section-settling');
      resetGesture();
    } else if (!continuingGesture) {
      resetGesture();
    }

    gestureDelta += deltaY;
    gestureEventCount += 1;
    gestureHasCoarseWheel = gestureHasCoarseWheel || event.deltaMode !== 0 || Math.abs(deltaY) >= 72;

    settleTimer = setTimeout(() => settleAtSection(sequence), INPUT_QUIET_TIME);
  }

  function mount(nextRoot) {
    destroy();
    root = nextRoot;
    sections = root ? Array.from(root.querySelectorAll('.v-screen-section')) : [];
    if (!root || !sections.length || !supportsEnhancedScroll()) return;

    viewportHeight = Math.max(1, root.clientHeight);
    lastSettledIndex = clampIndex(Math.round(root.scrollTop / viewportHeight));
    root.classList.add('is-lenis-enhanced');
    root.dataset.scrollMode = 'lenis-single-settle';
    markNestedScrollAreas();

    lenis = new window.Lenis({
      wrapper: root,
      content: root,
      eventsTarget: root,
      autoRaf: true,
      autoResize: true,
      smoothWheel: true,
      syncTouch: false,
      lerp: 0.18,
      wheelMultiplier: 1,
      overscroll: false,
      respectReducedMotion: true,
      virtualScroll: ({ event, deltaY }) => !event.ctrlKey && !event.type.includes('touch') && !isNestedScrollInput(event, deltaY)
    });
    removeVirtualScrollListener = lenis.on('virtual-scroll', handleVirtualScroll);

    requestAnimationFrame(() => {
      if (!lenis || root !== nextRoot) return;
      lenis.resize();
      viewportHeight = Math.max(1, root.clientHeight);
      lastSettledIndex = clampIndex(Math.round(lenis.scroll / viewportHeight));
      markNestedScrollAreas();
    });
  }

  function refreshAfterResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!root) return;
      if (!supportsEnhancedScroll() || !lenis) {
        mount(root);
        return;
      }

      const currentIndex = clampIndex(Math.round(lenis.scroll / Math.max(1, viewportHeight)));
      inputSequence += 1;
      clearSettleTimer();
      isSettling = false;
      settleTargetIndex = null;
      root.classList.remove('is-section-settling');
      resetGesture();
      viewportHeight = Math.max(1, root.clientHeight);
      lenis.resize();
      lenis.scrollTo(currentIndex * viewportHeight, { immediate: true });
      lastSettledIndex = currentIndex;
      markNestedScrollAreas();
    }, 140);
  }

  window.addEventListener('resize', refreshAfterResize);
  window.IM_SMOOTH_SCROLL = { mount, destroy };
})();
