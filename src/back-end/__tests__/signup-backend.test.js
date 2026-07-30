const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..', '..');
const { buildSignupCandidates, buildSignupUrl } = require(path.join(projectRoot, 'src', 'front-end', 'pages', 'signup-page', 'signup.js'));

function waitForServer(port, timeoutMs = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const request = require('node:http').request({ host: '127.0.0.1', port, path: '/' }, (res) => {
        res.resume();
        resolve();
      });

      request.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Server did not start in time'));
        } else {
          setTimeout(tryConnect, 100);
        }
      });

      request.end();
    };

    tryConnect();
  });
}

test('OPTIONS /api/signup responds with CORS headers', async () => {
  const projectRoot = path.join(__dirname, '..', '..', '..');
  const serverProcess = spawn(process.execPath, [path.join(projectRoot, 'src', 'back-end', 'server.js')], {
    cwd: projectRoot,
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
      const req = require('node:http').request({
        host: '127.0.0.1',
        port: 3112,
        path: '/api/signup',
        method: 'OPTIONS',
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
      });

      req.on('error', reject);
      req.end();
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], '*');
  } finally {
    serverProcess.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
});

test('OPTIONS /api/profile responds with CORS headers', async () => {
  const projectRoot = path.join(__dirname, '..', '..', '..');
  const serverProcess = spawn(process.execPath, [path.join(projectRoot, 'src', 'back-end', 'server.js')], {
    cwd: projectRoot,
    env: { ...process.env, PORT: '3117' },
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
    await waitForServer(3117);

    const response = await new Promise((resolve, reject) => {
      const req = require('node:http').request({
        host: '127.0.0.1',
        port: 3117,
        path: '/api/profile',
        method: 'OPTIONS',
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
      });

      req.on('error', reject);
      req.end();
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], '*');
  } finally {
    serverProcess.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
});

test('buildSignupUrl uses the same origin when the page is served from Beacon', () => {
  assert.equal(buildSignupUrl('http://localhost:3001'), 'http://localhost:3001/api/signup');
  assert.equal(buildSignupUrl('http://127.0.0.1:3001'), 'http://127.0.0.1:3001/api/signup');
  assert.deepEqual(buildSignupCandidates('http://localhost:5500').slice(0, 3), [
    'http://127.0.0.1:3000/api/signup',
    'http://127.0.0.1:3001/api/signup',
    'http://127.0.0.1:3002/api/signup',
  ]);
});

test('POST /api/signup rejects invite codes that are not in the allowlist', async () => {
  const usersDir = path.join(projectRoot, 'src', 'back-end', 'data', 'users');

  fs.rmSync(usersDir, { recursive: true, force: true });
  fs.mkdirSync(usersDir, { recursive: true });

  const serverProcess = spawn(process.execPath, [path.join(projectRoot, 'src', 'back-end', 'server.js')], {
    cwd: projectRoot,
    env: { ...process.env, PORT: '3114' },
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
    await waitForServer(3114);

    const response = await new Promise((resolve, reject) => {
      const req = require('node:http').request({
        host: '127.0.0.1',
        port: 3114,
        path: '/api/signup',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      });

      req.on('error', reject);
      req.write(JSON.stringify({
        inviteCode: 'BAD-CODE',
        name: 'Avery',
        phone: '123-456-7890',
        email: 'avery@example.com',
        username: 'avery',
        password: 'secret123',
      }));
      req.end();
    });

    assert.equal(response.statusCode, 400);
    const payload = JSON.parse(response.body);
    assert.equal(payload.error, 'Invite code is not valid.');
  } finally {
    serverProcess.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
});

test('POST /api/signup returns a descriptive error when the invite code list cannot be loaded', async () => {
  const usersDir = path.join(projectRoot, 'src', 'back-end', 'data', 'users');
  const inviteCodesFile = path.join(projectRoot, 'src', 'back-end', 'data', 'invite-codes.json');

  fs.rmSync(usersDir, { recursive: true, force: true });
  fs.mkdirSync(usersDir, { recursive: true });
  fs.rmSync(inviteCodesFile, { force: true });

  const serverProcess = spawn(process.execPath, [path.join(projectRoot, 'src', 'back-end', 'server.js')], {
    cwd: projectRoot,
    env: { ...process.env, PORT: '3115' },
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
    await waitForServer(3115);

    const response = await new Promise((resolve, reject) => {
      const req = require('node:http').request({
        host: '127.0.0.1',
        port: 3115,
        path: '/api/signup',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      });

      req.on('error', reject);
      req.write(JSON.stringify({
        inviteCode: 'UGM-7X2K',
        name: 'Avery',
        phone: '123-456-7890',
        username: 'avery',
        password: 'secret123',
      }));
      req.end();
    });

    assert.equal(response.statusCode, 503);
    const payload = JSON.parse(response.body);
    assert.equal(payload.error, 'Could not load invite codes.');
    assert.match(payload.details, /invite code list/i);
  } finally {
    serverProcess.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 200));
    fs.writeFileSync(inviteCodesFile, '[\n  "UGM-7X2K"\n]\n');
  }
});

test('POST /api/profile updates editable account details', async () => {
  const usersDir = path.join(projectRoot, 'src', 'back-end', 'data', 'users');

  fs.rmSync(usersDir, { recursive: true, force: true });
  fs.mkdirSync(usersDir, { recursive: true });

  const serverProcess = spawn(process.execPath, [path.join(projectRoot, 'src', 'back-end', 'server.js')], {
    cwd: projectRoot,
    env: { ...process.env, PORT: '3116' },
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
    await waitForServer(3116);

    const signupResponse = await new Promise((resolve, reject) => {
      const req = require('node:http').request({
        host: '127.0.0.1',
        port: 3116,
        path: '/api/signup',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      });

      req.on('error', reject);
      req.write(JSON.stringify({
        inviteCode: 'UGM-7X2K',
        name: 'Avery',
        phone: '123-456-7890',
        email: 'avery@example.com',
        username: 'avery',
        password: 'secret123',
      }));
      req.end();
    });

    assert.equal(signupResponse.statusCode, 200);

    const updateResponse = await new Promise((resolve, reject) => {
      const req = require('node:http').request({
        host: '127.0.0.1',
        port: 3116,
        path: '/api/profile',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      });

      req.on('error', reject);
      req.write(JSON.stringify({
        phone: '123-456-7890',
        name: 'Avery Updated',
        username: 'avery-updated',
        email: 'avery.updated@example.com',
        newPassword: 'new-secret',
      }));
      req.end();
    });

    assert.equal(updateResponse.statusCode, 200);
    const payload = JSON.parse(updateResponse.body);
    assert.equal(payload.name, 'Avery Updated');
    assert.equal(payload.email, 'avery.updated@example.com');
    assert.equal(payload.username, 'avery-updated');
    assert.equal(payload.password, 'new-secret');
  } finally {
    serverProcess.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
});

test('POST /api/login authenticates a stored responder profile', async () => {
  const usersDir = path.join(projectRoot, 'src', 'back-end', 'data', 'users');

  fs.rmSync(usersDir, { recursive: true, force: true });
  fs.mkdirSync(usersDir, { recursive: true });

  const serverProcess = spawn(process.execPath, [path.join(projectRoot, 'src', 'back-end', 'server.js')], {
    cwd: projectRoot,
    env: { ...process.env, PORT: '3113' },
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
    await waitForServer(3113);

    const signupResponse = await new Promise((resolve, reject) => {
      const req = require('node:http').request({
        host: '127.0.0.1',
        port: 3113,
        path: '/api/signup',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      });

      req.on('error', reject);
      req.write(JSON.stringify({
        inviteCode: 'UGM-7X2K',
        name: 'Avery',
        phone: '123-456-7890',
        username: 'avery',
        password: 'secret123',
      }));
      req.end();
    });

    assert.equal(signupResponse.statusCode, 200);

    const loginResponse = await new Promise((resolve, reject) => {
      const req = require('node:http').request({
        host: '127.0.0.1',
        port: 3113,
        path: '/api/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      });

      req.on('error', reject);
      req.write(JSON.stringify({ username: 'avery', password: 'secret123' }));
      req.end();
    });

    assert.equal(loginResponse.statusCode, 200);
    const payload = JSON.parse(loginResponse.body);
    assert.equal(payload.action, 'login');
    assert.equal(payload.username, 'avery');
  } finally {
    serverProcess.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
});

test('POST /api/signup saves a responder profile', async () => {
  const usersDir = path.join(projectRoot, 'src', 'back-end', 'data', 'users');

  fs.rmSync(usersDir, { recursive: true, force: true });
  fs.mkdirSync(usersDir, { recursive: true });

  const serverProcess = spawn(process.execPath, [path.join(projectRoot, 'src', 'back-end', 'server.js')], {
    cwd: projectRoot,
    env: { ...process.env, PORT: '3111' },
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
    await waitForServer(3111);

    const response = await new Promise((resolve, reject) => {
      const req = require('node:http').request({
        host: '127.0.0.1',
        port: 3111,
        path: '/api/signup',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      });

      req.on('error', reject);
      req.write(JSON.stringify({
        inviteCode: 'UGM-7X2K',
        name: 'Avery',
        phone: '123-456-7890',
        username: 'avery',
        password: 'secret123',
      }));
      req.end();
    });

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.equal(payload.name, 'Avery');
    assert.equal(payload.inviteCode, 'UGM-7X2K');
    assert.equal(payload.action, 'signup');

    const savedFile = path.join(usersDir, 'avery.json');
    assert.equal(fs.existsSync(savedFile), true);
    const savedPayload = JSON.parse(fs.readFileSync(savedFile, 'utf8'));
    assert.equal(savedPayload.phone, '123-456-7890');

    // Call the signup endpoint again with the same phone — should be treated as a login
    const response2 = await new Promise((resolve, reject) => {
      const req2 = require('node:http').request({
        host: '127.0.0.1',
        port: 3111,
        path: '/api/signup',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      });

      req2.on('error', reject);
      req2.write(JSON.stringify({
        inviteCode: 'UGM-7X2K',
        name: 'Avery',
        phone: '123-456-7890',
        username: 'avery',
        password: 'secret123',
      }));
      req2.end();
    });

    assert.equal(response2.statusCode, 200);
    const payload2 = JSON.parse(response2.body);
    assert.equal(payload2.action, 'login');
  } finally {
    serverProcess.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
});
