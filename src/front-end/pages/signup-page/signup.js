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
  const emailInput = rootDocument.querySelector('.sign-up-thq-textinput-elm4');
  const usernameInput = rootDocument.querySelector('.sign-up-thq-textinput-elm5');
  const passwordInput = rootDocument.querySelector('.sign-up-thq-textinput-elm6');
  const status = rootDocument.createElement('p');
  status.style.marginTop = '12px';
  status.style.fontSize = '0.95rem';
  form.appendChild(status);

  const isPreviewServer = rootWindow.location.origin.includes('5500');
  if (isPreviewServer) {
    localStorage.removeItem('beaconSignedIn');
    localStorage.removeItem('beaconUserName');
  }

  const redirectTarget = new URLSearchParams(rootWindow.location.search).get('redirect') || 'respond.html';
  // Normalize common short redirect values to the actual respond page path
  let normalizedRedirect = redirectTarget;
  if (redirectTarget === 'respond.html' || redirectTarget === 'respond') {
    normalizedRedirect = '../respond-page/respond.html';
  }

  const finishSignup = (name, userData = {}) => {
    localStorage.setItem('beaconSignedIn', 'true');
    localStorage.setItem('beaconUserName', name || userData.name || 'Responder');
    localStorage.setItem('beaconUsername', userData.username || userData.email || '');
    localStorage.setItem('beaconEmail', userData.email || '');
    localStorage.setItem('beaconPhone', userData.phone || '');
    localStorage.setItem('beaconInviteCode', userData.inviteCode || '');
    rootWindow.location.href = normalizedRedirect;
  };

  const renderStatus = (message, color) => {
    status.textContent = message;
    status.style.color = color;
  };

  const startBackendLauncher = async () => {
    if (!isPreviewServer) return;

    try {
      await fetch('http://127.0.0.1:4000/start', {
        method: 'GET',
        mode: 'cors',
      });
    } catch (error) {
      // Ignore launcher failures; signup will still attempt backend candidates.
    }
  };

  button.addEventListener('click', async () => {
    await startBackendLauncher();

    const payload = {
      inviteCode: inviteInput.value.trim(),
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      email: emailInput.value.trim(),
      username: usernameInput.value.trim() || emailInput.value.trim(),
      password: passwordInput.value.trim(),
    };

    if (!payload.inviteCode || !payload.name || !payload.email || !payload.password) {
      renderStatus('Please provide an invite code, name, email, and password.', '#c53030');
      return;
    }

    renderStatus('Signing you up...', '#4a5568');

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
          const message = result.data && result.data.error ? result.data.error : 'Signup failed';
          const details = result.data && result.data.details ? ` ${result.data.details}` : '';
          throw new Error(`${message}${details}`);
        }

        // Show different messages depending on whether this was a new signup or a login
        const action = result.data && result.data.action;
        if (action === 'login') {
          renderStatus(`Welcome back, ${result.data.name}! You are now logged in.`, '#2f855a');
        } else {
          renderStatus(`Signed up successfully for ${result.data.name}.`, '#2f855a');
        }
        finishSignup(result.data.name, result.data);
    } catch (error) {
      renderStatus(error.message, '#c53030');
    }
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => initSignupPage());
}

if (typeof module !== 'undefined') {
  module.exports = { buildSignupCandidates, buildSignupUrl, initSignupPage };
}
