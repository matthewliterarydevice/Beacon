function initSettingsModal(rootWindow = window, rootDocument = document) {
  const trigger = rootDocument.querySelector('[data-open-settings]');
  const overlay = rootDocument.getElementById('settingsModalOverlay');
  const closeButton = rootDocument.getElementById('settingsModalClose');
  const logoutButton = rootDocument.getElementById('settingsModalLogout');

  const nameEl = rootDocument.getElementById('settingsModalName');
  const usernameEl = rootDocument.getElementById('settingsModalUsername');
  const emailEl = rootDocument.getElementById('settingsModalEmail');
  const phoneEl = rootDocument.getElementById('settingsModalPhone');
  const newPasswordEl = rootDocument.getElementById('settingsModalNewPassword');
  const inviteCodeEl = rootDocument.getElementById('settingsModalInviteCode');
  const saveButton = rootDocument.getElementById('settingsModalSave');

  const setValue = (element, value) => {
    if (element) {
      element.textContent = value || '-';
    }
  };

  const setInputValue = (element, value) => {
    if (element) {
      element.value = value || '';
    }
  };

  const openModal = () => {
    if (!overlay) return;
    setInputValue(nameEl, rootWindow.localStorage.getItem('beaconUserName'));
    setInputValue(usernameEl, rootWindow.localStorage.getItem('beaconUsername'));
    setInputValue(emailEl, rootWindow.localStorage.getItem('beaconEmail'));
    setInputValue(phoneEl, rootWindow.localStorage.getItem('beaconPhone'));
    setInputValue(newPasswordEl, '');
    setValue(inviteCodeEl, rootWindow.localStorage.getItem('beaconInviteCode'));
    overlay.classList.add('is-open');
  };

  const closeModal = () => {
    if (overlay) {
      overlay.classList.remove('is-open');
    }
  };

  if (trigger) {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openModal();
    });
  }

  if (closeButton) {
    closeButton.addEventListener('click', closeModal);
  }

  if (overlay) {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeModal();
      }
    });
  }

  if (saveButton) {
    saveButton.addEventListener('click', async () => {
      try {
        const payload = {
          currentEmail: rootWindow.localStorage.getItem('beaconEmail') || '',
          currentUsername: rootWindow.localStorage.getItem('beaconUsername') || '',
          currentPhone: rootWindow.localStorage.getItem('beaconPhone') || '',
          phone: phoneEl && phoneEl.value.trim(),
          name: nameEl && nameEl.value.trim(),
          username: usernameEl && usernameEl.value.trim(),
          email: emailEl && emailEl.value.trim(),
          newPassword: newPasswordEl && newPasswordEl.value.trim(),
        };

        const response = await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Could not save settings.');
        }

        rootWindow.localStorage.setItem('beaconUserName', data.name || payload.name || '');
        rootWindow.localStorage.setItem('beaconUsername', data.username || payload.username || '');
        rootWindow.localStorage.setItem('beaconEmail', data.email || payload.email || '');
        rootWindow.localStorage.setItem('beaconPhone', data.phone || payload.phone || '');
        if (payload.newPassword) {
          rootWindow.localStorage.setItem('beaconPasswordUpdated', 'true');
        }
        closeModal();
      } catch (error) {
        window.alert(error.message);
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      rootWindow.localStorage.removeItem('beaconSignedIn');
      rootWindow.localStorage.removeItem('beaconUserName');
      rootWindow.localStorage.removeItem('beaconUsername');
      rootWindow.localStorage.removeItem('beaconEmail');
      rootWindow.localStorage.removeItem('beaconPhone');
      rootWindow.localStorage.removeItem('beaconInviteCode');
      rootWindow.location.href = '../login-page/login.html';
    });
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => initSettingsModal());
}

if (typeof module !== 'undefined') {
  module.exports = { initSettingsModal };
}
