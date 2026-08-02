const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const { createServer } = require(path.join(__dirname, '..', 'server.js'));

class MockRequest extends EventEmitter {
  constructor(method, url, body = '') {
    super();
    this.method = method;
    this.url = url;
    this.headers = {};
    this.body = body;
  }
}

class MockResponse {
  constructor() {
    this.statusCode = null;
    this.headers = {};
    this.body = '';
    this.ended = false;
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = headers;
  }

  end(payload = '') {
    this.body = payload;
    this.ended = true;
  }
}

function dispatchRequest(method, url, body = '') {
  const request = new MockRequest(method, url, body);
  const response = new MockResponse();
  const server = createServer();
  const requestHandler = server.listeners('request')[0];

  requestHandler(request, response);
  if (body) {
    request.emit('data', body);
  }
  request.emit('end');
  return { request, response };
}

test('OPTIONS /api/profile responds with CORS headers', () => {
  const { response } = dispatchRequest('OPTIONS', '/api/profile');

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['Access-Control-Allow-Origin'], '*');
  assert.equal(response.headers['Access-Control-Allow-Methods'], 'GET, POST, OPTIONS');
});

test('POST /api/profile updates editable account details', () => {
  const usersDir = path.join(__dirname, '..', 'data', 'users');
  fs.rmSync(usersDir, { recursive: true, force: true });
  fs.mkdirSync(usersDir, { recursive: true });

  const userFile = path.join(usersDir, 'avery.json');
  fs.writeFileSync(userFile, JSON.stringify({
    name: 'Avery',
    username: 'avery',
    email: 'avery@example.com',
    phone: '123-456-7890',
    password: 'secret123',
  }, null, 2));

  const payload = JSON.stringify({
    currentEmail: 'avery@example.com',
    currentUsername: 'avery',
    currentPhone: '123-456-7890',
    phone: '999-000-1111',
    name: 'Avery Updated',
    username: 'avery-updated',
    email: 'avery.updated@example.com',
    newPassword: 'new-secret',
  });

  const { response } = dispatchRequest('POST', '/api/profile', payload);

  const updated = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(updated.name, 'Avery Updated');
  assert.equal(updated.email, 'avery.updated@example.com');
  assert.equal(updated.username, 'avery-updated');
  assert.equal(updated.phone, '999-000-1111');
  // The password must never be echoed back, hashed or otherwise.
  assert.equal(updated.password, undefined);
  assert.equal(updated.passwordHash, undefined);

  const savedRecord = JSON.parse(fs.readFileSync(userFile, 'utf8'));
  assert.equal(savedRecord.password, undefined);
  assert.notEqual(savedRecord.passwordHash, undefined);
  assert.notEqual(savedRecord.passwordHash, 'new-secret');
});
