const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runNavigationScript(signedIn) {
  const scriptPath = path.join(__dirname, '..', '..', 'front-end', 'utils', 'navigation.js');
  const source = fs.readFileSync(scriptPath, 'utf8');

  const events = {};
  const link = {
    dataset: { tab: 'respond' },
    href: '',
    classList: { add() {} },
    addEventListener(type, handler) {
      events[type] = handler;
    },
  };

  const context = {
    window: {
      location: { href: '', pathname: '/pages/learn-page/learn.html' },
      history: { back() {} },
    },
    document: {
      querySelectorAll(selector) {
        if (selector === '.bottom-nav-item[data-tab="respond"]') {
          return [link];
        }
        return [];
      },
    },
    localStorage: {
      getItem(key) {
        if (key === 'beaconSignedIn') {
          return signedIn ? 'true' : null;
        }
        return null;
      },
    },
    console,
  };

  context.global = context;
  vm.createContext(context);
  vm.runInContext(source, context);

  return { link, events };
}

test('respond nav sends signed-out users to signup and signed-in users to respond', () => {
  const unsigned = runNavigationScript(false);
  unsigned.events.click({ preventDefault() {} });
  assert.equal(unsigned.link.href, '../signup-page/signup.html?redirect=respond.html');

  const signed = runNavigationScript(true);
  signed.events.click({ preventDefault() {} });
  assert.equal(signed.link.href, '../respond-page/respond.html');
});
