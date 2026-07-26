(function () {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const signedIn = localStorage.getItem('beaconSignedIn') === 'true';
  const currentKey = currentPage === 'index.html' ? 'emergency' : currentPage.replace(/\.html$/, '');

  const setRespondDestination = (link) => {
    if (link.dataset.tab === 'respond') {
      link.href = signedIn ? '../respond-page/respond.html' : '../signup-page/signup.html?redirect=respond.html';
      link.addEventListener('click', (event) => {
        event.preventDefault();
        if (signedIn) {
          window.location.href = '../respond-page/respond.html';
        } else {
          window.location.href = '../signup-page/signup.html?redirect=respond.html';
        }
      });
    }
  };

  document.querySelectorAll('.bottom-nav-item[data-tab="respond"]').forEach(setRespondDestination);

  document.querySelectorAll('[data-nav-page]').forEach((link) => {
    const pageName = link.dataset.navPage;
    const target = pageName === 'respond' ? (signedIn ? 'respond.html' : 'signup.html') : undefined;

    if (target) {
      link.href = target;
    }

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
