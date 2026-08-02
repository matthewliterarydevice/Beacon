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
 *   Step 1: "Check the surroundings"
 *     Yes      -> escalate immediately
 *     Unsure   -> escalate immediately
 *     No       -> continue to Step 2
 *
 *   Step 2: "Look for warning signs"
 *     Yes      -> escalate immediately
 *     Unsure   -> escalate immediately
 *     No       -> continue to Step 3
 *
 *   Step 3: "Try to wake them"
 *     Yes      -> escalate immediately
 *     Unsure   -> escalate immediately
 *     No       -> continue to Step 4
 *
 *   Step 4: "Check if they are breathing normally"
 *     Yes      -> escalate immediately
 *     Unsure   -> escalate immediately
 *     No       -> show a final message encouraging the person to act at
 *                 their own discretion and get help if needed.
 *
 *   Cancel is always available and returns to the Emergency page.
 */

const NUDGE_STEPS = {
  SURROUNDINGS: 'surroundings',
  WARNING_SIGNS: 'warningSigns',
  WAKE: 'wake',
  BREATHING: 'breathing',
  MESSAGE: 'message',
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
  const questionBlock = rootDocument.getElementById('nudgeQuestionBlock');

  if (!questionText || !yesButton || !noButton || !unsureButton) {
    return; // markup not present — nothing to wire up
  }

  const STEP_CONTENT = {
    [NUDGE_STEPS.SURROUNDINGS]: {
      question: 'Check the surroundings',
      instructions: 'Look for anything nearby that might help: pills, bottles, needles, or signs of a fall.',
    },
    [NUDGE_STEPS.WARNING_SIGNS]: {
      question: 'Look for warning signs',
      instructions: 'Watch for blue lips, very pale skin, unusual sleepiness, a limp body, or no response.',
    },
    [NUDGE_STEPS.WAKE]: {
      question: 'Try to wake them',
      instructions: 'Say their name and gently tap or shake their shoulder.',
    },
    [NUDGE_STEPS.BREATHING]: {
      question: 'Check if they are breathing normally',
      instructions: 'Watch their chest for 10 seconds. Normal breathing is steady and regular.',
    },
    [NUDGE_STEPS.MESSAGE]: {
      question: 'If you are unsure, act at your own discretion',
      instructions: 'If anything feels serious or you are not sure, get help right away.',
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
    renderStep(step);
    currentStep = step;
  }

  function showMessageStep() {
    if (questionBlock) questionBlock.hidden = false;
    if (answerRow) answerRow.hidden = true;
    if (footerRow) footerRow.hidden = false;
    renderStep(NUDGE_STEPS.MESSAGE);
    currentStep = NUDGE_STEPS.MESSAGE;
  }

  let currentStep = NUDGE_STEPS.SURROUNDINGS;

  yesButton.addEventListener('click', () => {
    // "Yes" always means the concerning answer, regardless of which
    // question is currently showing (unresponsive, or abnormal breathing).
    escalate();
  });

  noButton.addEventListener('click', () => {
    if (currentStep === NUDGE_STEPS.SURROUNDINGS) {
      showQuestionStep(NUDGE_STEPS.WARNING_SIGNS);
      return;
    }

    if (currentStep === NUDGE_STEPS.WARNING_SIGNS) {
      showQuestionStep(NUDGE_STEPS.WAKE);
      return;
    }

    if (currentStep === NUDGE_STEPS.WAKE) {
      showQuestionStep(NUDGE_STEPS.BREATHING);
      return;
    }

    if (currentStep === NUDGE_STEPS.BREATHING) {
      showMessageStep();
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

  showQuestionStep(NUDGE_STEPS.SURROUNDINGS);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => initNudgePage());
}

if (typeof module !== 'undefined') {
  module.exports = { initNudgePage, NUDGE_STEPS };
}
