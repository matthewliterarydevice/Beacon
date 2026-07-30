function initSettingsPage(rootWindow = window, rootDocument = document) {
  const nameEl = rootDocument.getElementById('settingsName');
  const usernameEl = rootDocument.getElementById('settingsUsername');
  const phoneEl = rootDocument.getElementById('settingsPhone');
  const inviteCodeEl = rootDocument.getElementById('settingsInviteCode');
  const logoutButton = rootDocument.getElementById('logoutButton');

  const setValue = (element, value) => {
    if (element) {
      element.textContent = value || '-';
    }
  };

  setValue(nameEl, rootWindow.localStorage.getItem('beaconUserName'));
  setValue(usernameEl, rootWindow.localStorage.getItem('beaconUsername'));
  setValue(phoneEl, rootWindow.localStorage.getItem('beaconPhone'));
  setValue(inviteCodeEl, rootWindow.localStorage.getItem('beaconInviteCode'));

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      rootWindow.localStorage.removeItem('beaconSignedIn');
      rootWindow.localStorage.removeItem('beaconUserName');
      rootWindow.localStorage.removeItem('beaconUsername');
      rootWindow.localStorage.removeItem('beaconPhone');
      rootWindow.localStorage.removeItem('beaconInviteCode');
      rootWindow.location.href = '../login-page/login.html';
    });
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => initSettingsPage());
}

if (typeof module !== 'undefined') {
  module.exports = { initSettingsPage };
}
