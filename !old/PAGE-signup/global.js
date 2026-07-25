function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSignedInState(session) {
  const signedInState = document.getElementById('signed-in-state');
  if (!session || !signedInState) {
    return;
  }

  signedInState.innerHTML = `
    <h2>Signed in as ${escapeHtml(session.name)}</h2>
    <p class="signed-in-text">
      You’re saved as a responder for invite code <strong>${escapeHtml(session.inviteCode)}</strong>
      and phone <strong>${escapeHtml(session.phone)}</strong>.
    </p>
    <button type="button" class="sign-out-button">Sign out</button>
  `;

  const signOutButton = signedInState.querySelector('.sign-out-button');
  signOutButton.addEventListener('click', () => {
    localStorage.removeItem('responderSession');
    signedInState.hidden = true;
    const form = document.getElementById('responder-sign-up');
    if (form) {
      form.style.display = 'flex';
    }
  });

  signedInState.hidden = false;
  const form = document.getElementById('responder-sign-up');
  if (form) {
    form.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('responder-sign-up');
  const savedSession = localStorage.getItem('responderSession');
  if (savedSession) {
    try {
      const session = JSON.parse(savedSession);
      if (session && session.name) {
        renderSignedInState(session);
      }
    } catch (error) {
      localStorage.removeItem('responderSession');
    }
  }

  if (!form) {
    return;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const session = {
      inviteCode: formData.get('inviteCode') || '',
      name: formData.get('name') || '',
      phone: formData.get('phone') || '',
      signedInAt: new Date().toISOString(),
    };

    localStorage.setItem('responderSession', JSON.stringify(session));
    renderSignedInState(session);
  });
});
