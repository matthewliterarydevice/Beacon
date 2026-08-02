/**
 * Hold-to-confirm interaction for the "Hold for help" circle button.
 *
 * A single tap should never trigger an emergency alert by accident — this
 * requires the user to press and hold for a set duration before it fires,
 * with a visible fill animation as feedback, and cancels cleanly if the
 * user lets go early.
 *
 * Usage:
 *   initHoldToConfirm({
 *     button: document.getElementById('holdForHelpButton'),
 *     progressLayer: document.getElementById('holdForHelpProgress'),
 *     labelElement: document.querySelector('.nudge-thq-text-elm11'),
 *     durationMs: 800,
 *     onConfirm: () => { window.location.href = '../help-page/help.html'; },
 *     holdingLabel: 'Keep holding…',
 *     idleLabel: 'Hold for help',
 *   });
 */
function initHoldToConfirm({
  button,
  progressLayer,
  labelElement,
  durationMs = 800,
  onConfirm,
  holdingLabel,
  idleLabel,
}) {
  if (!button || typeof onConfirm !== 'function') {
    return;
  }

  let startTime = null;
  let rafId = null;
  let confirmed = false;

  function setProgress(fraction) {
    if (progressLayer) {
      progressLayer.style.setProperty('--hold-progress', `${Math.min(1, Math.max(0, fraction)) * 100}%`);
    }
  }

  function tick(now) {
    if (startTime === null) return;
    const elapsed = now - startTime;
    const fraction = elapsed / durationMs;
    setProgress(fraction);

    if (fraction >= 1) {
      confirmed = true;
      stopHold();
      onConfirm();
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  function startHold() {
    if (startTime !== null) return; // already holding
    confirmed = false;
    startTime = performance.now();
    button.classList.add('is-holding');
    if (labelElement && holdingLabel) {
      labelElement.textContent = holdingLabel;
    }
    rafId = requestAnimationFrame(tick);
  }

  function stopHold() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    startTime = null;
    button.classList.remove('is-holding');
    if (!confirmed) {
      setProgress(0);
      if (labelElement && idleLabel) {
        labelElement.textContent = idleLabel;
      }
    }
  }

  // Pointer events cover mouse, touch, and pen with one set of handlers.
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    startHold();
  });
  button.addEventListener('pointerup', stopHold);
  button.addEventListener('pointerleave', stopHold);
  button.addEventListener('pointercancel', stopHold);

  // Keyboard access: holding Enter/Space triggers the same timed confirm
  // so keyboard and assistive-tech users aren't blocked by a gesture that
  // assumes a pointer. Repeat keydown events while held are ignored so we
  // don't restart the timer on every OS key-repeat tick.
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (event.repeat) return;
    startHold();
  });
  button.addEventListener('keyup', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    stopHold();
  });

  // Prevent the default click-through navigation if this element happens
  // to be (or contain) an anchor — hold-to-confirm fully replaces tap.
  button.addEventListener('click', (event) => {
    event.preventDefault();
  });
}

if (typeof module !== 'undefined') {
  module.exports = { initHoldToConfirm };
}
