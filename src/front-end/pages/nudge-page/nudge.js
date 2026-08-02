/**
 * Nudge Mode logic.
 *
 * Per the product design: a bystander who isn't sure what they're seeing
 * answers a couple of short questions. Any unclear or concerning answer
 * escalates automatically to Alert Mode (help.html, which calls 911 and
 * notifies nearby responders) — no single bystander has to feel "certain
 * enough" to act, and uncertainty itself is treated as a reason to escalate,
 * not a reason to wait.
 *
 * Flow:
 *   Step 1: "Are they unresponsive?"
 *     Yes      -> escalate immediately (unresponsiveness alone is enough)
 *     Unsure   -> escalate immediately (unclear answers always escalate)
 *     No       -> continue to Step 2
 *
 *   Step 2: "Is their breathing slow, irregular, or has it stopped?"
 *     Yes      -> escalate immediately
 *     Unsure   -> escalate immediately
 *     No       -> show a reassurance screen (Step 3) — do NOT force an
 *                 alert, but keep a manual "Get help now" escalation
 *                 option visible, since the person is not required to be
 *                 certain to still call for help.
 *
 *   Cancel is always available and returns to the Emergency page.
 */

const NUDGE_STEPS = {
  UNRESPONSIVE: 'unresponsive',
  BREATHING: 'breathing',
  REASSURANCE: 'reassurance',
};

function initNudgePage(rootDocument = document, rootWindow = window) {
  const questionText = rootDocument.getElementById('nudgeQuestionText');
  const checkInstructions = rootDocument.getElementById('nudgeCheckInstructions');
  const yesButton = rootDocument.getElementById('yesButton');
  const noButton = rootDocument.getElementById('noButton');
  const unsureButton = rootDocument.getElementById('unsureButton');
  const cancelButton = rootDocument.getElementById('cancelButton');
  const answerRow = rootDocument.getElementById('nudgeAnswerRow');
  const footerRow = rootDocument.getElementById('nudgeFooterRow');
  const reassuranceBlock = rootDocument.getElementById('nudgeReassuranceBlock');
  const getHelpNowButton = rootDocument.getElementById('getHelpNowButton');
  const questionBlock = rootDocument.getElementById('nudgeQuestionBlock');

  if (!questionText || !yesButton || !noButton || !unsureButton) {
    return; // markup not present — nothing to wire up
  }

  const STEP_CONTENT = {
    [NUDGE_STEPS.UNRESPONSIVE]: {
      question: 'Are they unresponsive?',
      instructions: 'Safely approach the person, firmly tap their shoulder, and loudly ask, "Are you okay?"',
    },
    [NUDGE_STEPS.BREATHING]: {
      question: 'Is their breathing slow, irregular, or has it stopped?',
      instructions: 'Watch their chest for 10 seconds. Normal breathing is steady, roughly one breath every 3–5 seconds.',
    },
  };

  function escalate() {
    rootWindow.location.href = '../help-page/help.html';
  }

  function goToCancel() {
    rootWindow.location.href = '../emergency-page/emergency.html';
  }

  function renderStep(step) {
    const content = STEP_CONTENT[step];
    questionText.textContent = content.question;
    if (checkInstructions) {
      checkInstructions.textContent = content.instructions;
    }
  }

  function showQuestionStep(step) {
    if (questionBlock) questionBlock.hidden = false;
    if (answerRow) answerRow.hidden = false;
    if (footerRow) footerRow.hidden = false;
    if (reassuranceBlock) reassuranceBlock.hidden = true;
    renderStep(step);
    currentStep = step;
  }

  function showReassuranceStep() {
    if (questionBlock) questionBlock.hidden = true;
    if (answerRow) answerRow.hidden = true;
    if (footerRow) footerRow.hidden = true;
    if (reassuranceBlock) reassuranceBlock.hidden = false;
    currentStep = NUDGE_STEPS.REASSURANCE;
  }

  let currentStep = NUDGE_STEPS.UNRESPONSIVE;

  yesButton.addEventListener('click', () => {
    // "Yes" always means the concerning answer, regardless of which
    // question is currently showing (unresponsive, or abnormal breathing).
    escalate();
  });

  noButton.addEventListener('click', () => {
    if (currentStep === NUDGE_STEPS.UNRESPONSIVE) {
      showQuestionStep(NUDGE_STEPS.BREATHING);
      return;
    }

    if (currentStep === NUDGE_STEPS.BREATHING) {
      showReassuranceStep();
    }
  });

  unsureButton.addEventListener('click', () => {
    // Any unclear answer escalates — certainty is never required.
    escalate();
  });

  if (cancelButton) {
    cancelButton.addEventListener('click', (event) => {
      event.preventDefault();
      goToCancel();
    });
  }

  if (getHelpNowButton) {
    getHelpNowButton.addEventListener('click', () => {
      escalate();
    });
  }

  showQuestionStep(NUDGE_STEPS.UNRESPONSIVE);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => initNudgePage());
}

if (typeof module !== 'undefined') {
  module.exports = { initNudgePage, NUDGE_STEPS };
}
