const assert = require('assert');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { test } = require('node:test');

function waitForServer(port, timeoutMs = 5000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const req = http.request({ host: '127.0.0.1', port, path: '/', method: 'GET' }, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server did not start on port ${port}`));
          return;
        }
        setTimeout(tryConnect, 100);
      });

      req.end();
    };

    tryConnect();
  });
}

test('profile endpoint supports CORS preflight for settings saves', async () => {
  const serverProcess = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..', '..', '..'),
    env: { ...process.env, PORT: '3112' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverOutput = '';
  serverProcess.stdout.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
  serverProcess.stderr.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });

  try {
    await waitForServer(3112);

    const response = await new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port: 3112,
        path: '/api/profile',
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      }, (res) => {
        resolve(res);
      });

      req.on('error', reject);
      req.end();
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-methods'], 'GET, POST, OPTIONS');
    assert.equal(response.headers['access-control-allow-headers'], 'Content-Type');
  } finally {
    serverProcess.kill('SIGTERM');
  }
});
