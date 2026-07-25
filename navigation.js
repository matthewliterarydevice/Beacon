(function () {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const signedIn = localStorage.getItem('beaconSignedIn') === 'true';
  const primaryMap = {
    learn: 'learn.html',
    emergency: 'emergency.html',
    respond: signedIn ? 'respond.html' : 'signup.html',
  };

  document.querySelectorAll('[data-nav-page]').forEach((link) => {
    const pageName = link.dataset.navPage;
    const target = primaryMap[pageName];

    if (target) {
      link.href = target;
    }

    const currentKey = currentPage === 'index.html' ? 'emergency' : currentPage.replace(/\.html$/, '');
    if (pageName === currentKey) {
      link.classList.add('active');
    }
  });

  document.querySelectorAll('[data-back-link]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      window.history.back();
    });
  });

  document.querySelectorAll('[data-signin-submit]').forEach((button) => {
    button.addEventListener('click', () => {
      localStorage.setItem('beaconSignedIn', 'true');
      window.location.href = 'respond.html';
    });
  });
})();
