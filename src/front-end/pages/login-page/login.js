function buildLoginCandidates(origin) {
  const localCandidates = [
    'http://127.0.0.1:3000/api/login',
    'http://127.0.0.1:3001/api/login',
    'http://127.0.0.1:3002/api/login',
    'http://127.0.0.1:3003/api/login',
  ];

  if (!origin || origin === 'null' || origin.startsWith('file://')) {
    return localCandidates;
  }

  if (origin.includes('5500')) {
    return localCandidates;
  }

  return [`${origin}/api/login`];
}

function initLoginPage(rootWindow = window, rootDocument = document) {
  const form = rootDocument.querySelector('.login-thq-form-elm');
  const button = rootDocument.querySelector('.login-thq-button-elm2');
  const usernameInput = rootDocument.querySelector('.login-thq-textinput-elm1');
  const passwordInput = rootDocument.querySelector('.login-thq-textinput-elm2');
  const status = rootDocument.createElement('p');
  status.style.marginTop = '8px';
  status.style.fontSize = '0.95rem';
  form.appendChild(status);

  const setFieldError = (field, hasError) => {
    if (!field) return;
    field.classList.toggle('input-error', hasError);
  };

  const clearFieldErrors = () => {
    setFieldError(usernameInput, false);
    setFieldError(passwordInput, false);
  };

  const redirectTarget = new URLSearchParams(rootWindow.location.search).get('redirect') || 'respond.html';
  let normalizedRedirect = redirectTarget;
  if (redirectTarget === 'respond.html' || redirectTarget === 'respond') {
    normalizedRedirect = '../respond-page/respond.html';
  }

  const finishLogin = (name, userData = {}) => {
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

  button.addEventListener('click', async () => {
    clearFieldErrors();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      if (!username) setFieldError(usernameInput, true);
      if (!password) setFieldError(passwordInput, true);
      renderStatus('Please enter your email or username and password.', '#c53030');
      return;
    }

    renderStatus('Signing you in...', '#4a5568');

    try {
      const candidates = buildLoginCandidates(rootWindow.location.origin);
      let lastErr = null;
      let receivedResponse = false;
      for (const url of candidates) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: username, username, password }),
          });

          receivedResponse = true;
          const text = await response.text();
          let data = {};
          if (text) {
            try { data = JSON.parse(text); } catch { data = { error: text }; }
          }

          if (response.ok) {
            if (data && data.action === 'login') {
              renderStatus(`Welcome back, ${data.name || data.username}!`, '#2f855a');
              finishLogin(data.name || data.username, data);
              return;
            }

            const message = data.error || 'Login failed';
            const details = data.details ? ` ${data.details}` : '';
            lastErr = new Error(`${message}${details}`);
            break;
          }

          const message = (data && data.error) ? data.error : 'Invalid username or password.';
          lastErr = new Error(message);
          break;
        } catch (error) {
          lastErr = error;
        }
      }

      if (lastErr && (lastErr.message === 'Failed to fetch' || lastErr.message.includes('NetworkError') || !receivedResponse)) {
        setFieldError(usernameInput, true);
        setFieldError(passwordInput, true);
        renderStatus('Unable to reach the login server. Please check your backend.', '#c53030');
      } else {
        setFieldError(usernameInput, true);
        setFieldError(passwordInput, true);
        renderStatus(lastErr ? lastErr.message : 'Invalid username or password.', '#c53030');
      }
    } catch (error) {
      renderStatus(error.message, '#c53030');
    }
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => initLoginPage());
}

if (typeof module !== 'undefined') {
  module.exports = { buildLoginCandidates, initLoginPage };
}
