function buildSignupCandidates(origin) {
  const localCandidates = [
    'http://127.0.0.1:3000/api/signup',
    'http://127.0.0.1:3001/api/signup',
    'http://127.0.0.1:3002/api/signup',
    'http://127.0.0.1:3003/api/signup',
  ];

  if (!origin || origin === 'null' || origin.startsWith('file://')) {
    return localCandidates;
  }

  if (origin.includes('5500')) {
    return localCandidates;
  }

  return [`${origin}/api/signup`];
}

function buildSignupUrl(origin) {
  return buildSignupCandidates(origin)[0];
}

function initSignupPage(rootWindow = window, rootDocument = document) {
  const form = rootDocument.querySelector('.sign-up-thq-form-elm');
  const button = rootDocument.querySelector('.sign-up-thq-button-elm2');
  const inviteInput = rootDocument.querySelector('.sign-up-thq-textinput-elm1');
  const nameInput = rootDocument.querySelector('.sign-up-thq-textinput-elm2');
  const phoneInput = rootDocument.querySelector('.sign-up-thq-textinput-elm3');
  const status = rootDocument.createElement('p');
  status.style.marginTop = '12px';
  status.style.fontSize = '0.95rem';
  form.appendChild(status);

  const redirectTarget = new URLSearchParams(rootWindow.location.search).get('redirect') || 'respond.html';
  // Normalize common short redirect values to the actual respond page path
  let normalizedRedirect = redirectTarget;
  if (redirectTarget === 'respond.html' || redirectTarget === 'respond') {
    normalizedRedirect = '../respond-page/respond.html';
  }

  const finishSignup = (name) => {
    localStorage.setItem('beaconSignedIn', 'true');
    localStorage.setItem('beaconUserName', name || 'Responder');
    rootWindow.location.href = normalizedRedirect;
  };

  button.addEventListener('click', async () => {
    const payload = {
      inviteCode: inviteInput.value.trim(),
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
    };

    if (!payload.inviteCode || !payload.name || !payload.phone) {
      status.textContent = 'Please fill in all fields.';
      status.style.color = '#c53030';
      return;
    }

    status.textContent = 'Signing you up...';
    status.style.color = '#4a5568';

    try {
        async function postToCandidates(payload, candidates) {
          let lastErr = null;
          for (const url of candidates) {
            try {
              const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });

              const text = await resp.text();
              let data = {};
              if (text) {
                try { data = JSON.parse(text); } catch { data = { error: text }; }
              }

              if (resp.ok) return { ok: true, data };

              // If server responded (but with non-OK), capture the error and stop trying further.
              return { ok: false, data };
            } catch (err) {
              // network-level error like connection refused — try next candidate
              lastErr = err;
              continue;
            }
          }

          throw lastErr || new Error('Failed to reach signup server');
        }

        const candidates = buildSignupCandidates(rootWindow.location.origin);
        const result = await postToCandidates(payload, candidates);

        if (!result.ok) {
          throw new Error(result.data && result.data.error ? result.data.error : 'Signup failed');
        }

        // Show different messages depending on whether this was a new signup or a login
        const action = result.data && result.data.action;
        if (action === 'login') {
          status.textContent = `Welcome back, ${result.data.name}! You are now logged in.`;
        } else {
          status.textContent = `Signed up successfully for ${result.data.name}.`;
        }
        status.style.color = '#2f855a';
        finishSignup(result.data.name);
    } catch (error) {
      status.textContent = error.message;
      status.style.color = '#c53030';
    }
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => initSignupPage());
}

if (typeof module !== 'undefined') {
  module.exports = { buildSignupCandidates, buildSignupUrl, initSignupPage };
}
