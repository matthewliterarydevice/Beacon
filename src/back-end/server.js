const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_PORT = process.env.PORT || 3000;
const DEFAULT_HOST = process.env.HOST || '127.0.0.1';
const FRONT_END_ROOT = path.join(__dirname, '..');
const USERS_FOLDER = path.join(__dirname, 'data', 'users');
const INVITE_CODES_FILE = path.join(__dirname, 'data', 'invite-codes.json');

const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SCRYPT_KEY_LENGTH = 64;

const FILE_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(response, statusCode, data, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extraHeaders,
  });
  response.end(JSON.stringify(data));
}

function safeUserId(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 40);
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

// ---- Password hashing -------------------------------------------------
// Passwords are never stored or returned in plaintext. We use Node's
// built-in scrypt (no extra dependency needed) with a random salt per
// user, stored as "salt:hash" in the passwordHash field.

function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, SCRYPT_KEY_LENGTH);
  return `${salt}:${derivedKey.toString('hex')}`;
}

function verifyPassword(plainPassword, storedHash) {
  if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) {
    return false;
  }

  const [salt, hashHex] = storedHash.split(':');
  const derivedKey = crypto.scryptSync(plainPassword, salt, SCRYPT_KEY_LENGTH);
  const storedKey = Buffer.from(hashHex, 'hex');

  if (storedKey.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedKey, derivedKey);
}

// Strip anything password-related before a user record ever leaves the
// server, whether it's a fresh signup, a login, or a profile update.
function sanitizeUserRecord(record) {
  const { password, passwordHash, ...safeRecord } = record;
  return safeRecord;
}

function isValidEmail(email) {
  return EMAIL_PATTERN.test(email);
}

// ---- User lookup helpers -----------------------------------------------

function findUserFilePathByUsername(username, excludeFilePath) {
  if (!username || !fs.existsSync(USERS_FOLDER)) {
    return null;
  }

  const normalizedUsername = normalizeValue(username);
  return fs.readdirSync(USERS_FOLDER)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(USERS_FOLDER, file))
    .find((filePath) => {
      if (excludeFilePath && filePath === excludeFilePath) {
        return false;
      }

      try {
        const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return normalizeValue(record.username) === normalizedUsername;
      } catch (err) {
        return false;
      }
    });
}

function getValidInviteCodes() {
  if (!fs.existsSync(INVITE_CODES_FILE)) {
    const error = new Error('Invite code list file is missing.');
    error.code = 'INVITE_CODES_MISSING';
    throw error;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(INVITE_CODES_FILE, 'utf8'));
    if (Array.isArray(parsed)) {
      return parsed.map((code) => String(code || '').trim()).filter(Boolean);
    }
  } catch (error) {
    error.code = error.code || 'INVITE_CODES_INVALID';
    throw error;
  }

  const error = new Error('Invite code list is not a valid array.');
  error.code = 'INVITE_CODES_INVALID';
  throw error;
}

function findUserFilePathByIdentity({ currentEmail, currentUsername, currentPhone, fallbackEmail, fallbackUsername, fallbackPhone }) {
  if (!fs.existsSync(USERS_FOLDER)) {
    return null;
  }

  const candidates = fs.readdirSync(USERS_FOLDER)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(USERS_FOLDER, file));

  const matchesIdentity = (record, email, username, phone) => {
    const recordEmail = normalizeValue(record.email);
    const recordUsername = normalizeValue(record.username);
    const recordPhone = normalizeValue(record.phone);

    return (email && recordEmail === normalizeValue(email))
      || (username && recordUsername === normalizeValue(username))
      || (phone && recordPhone === normalizeValue(phone));
  };

  for (const filePath of candidates) {
    try {
      const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (matchesIdentity(record, currentEmail, currentUsername, currentPhone)) {
        return filePath;
      }
    } catch (err) {
      continue;
    }
  }

  if (fallbackEmail || fallbackUsername || fallbackPhone) {
    for (const filePath of candidates) {
      try {
        const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (matchesIdentity(record, fallbackEmail, fallbackUsername, fallbackPhone)) {
          return filePath;
        }
      } catch (err) {
        continue;
      }
    }
  }

  return null;
}

// ---- Route handlers ------------------------------------------------------

function updateResponderProfile(request, response) {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });

  request.on('end', () => {
    try {
      const incoming = JSON.parse(body);
      const currentEmail = String(incoming.currentEmail || '').trim();
      const currentUsername = String(incoming.currentUsername || '').trim();
      const currentPhone = String(incoming.currentPhone || '').trim();
      const phone = String(incoming.phone || '').trim();
      const name = String(incoming.name || '').trim();
      const username = String(incoming.username || '').trim();
      const email = String(incoming.email || '').trim();
      const newPassword = String(incoming.newPassword || '').trim();

      if (!currentEmail && !currentUsername && !currentPhone) {
        return sendJson(response, 400, { error: 'Current email, username, or phone is required to update profile.' });
      }

      if (email && !isValidEmail(email)) {
        return sendJson(response, 400, { error: 'Please enter a valid email address.' });
      }

      if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
        return sendJson(response, 400, { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      }

      let filePath = findUserFilePathByIdentity({ currentEmail, currentUsername, currentPhone });
      if (!filePath) {
        filePath = findUserFilePathByIdentity({
          fallbackEmail: email,
          fallbackUsername: username,
          fallbackPhone: phone,
        });
      }

      if (!filePath) {
        return sendJson(response, 404, { error: 'Account not found.' });
      }

      const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const updated = {
        ...existing,
        name: name || existing.name,
        username: username || existing.username,
        email: email || existing.email,
        phone: phone || existing.phone,
        passwordHash: newPassword ? hashPassword(newPassword) : existing.passwordHash,
      };
      delete updated.password; // migrate away from any legacy plaintext field

      const duplicateUsernamePath = findUserFilePathByUsername(username, filePath);
      if (duplicateUsernamePath) {
        return sendJson(response, 400, { error: 'That username is already taken.' });
      }

      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
      sendJson(response, 200, sanitizeUserRecord(updated));
    } catch (error) {
      sendJson(response, 400, { error: 'Could not update profile.' });
    }
  });
}

function deleteResponderProfile(request, response) {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });

  request.on('end', () => {
    try {
      const incoming = JSON.parse(body);
      const currentEmail = String(incoming.currentEmail || '').trim();
      const currentUsername = String(incoming.currentUsername || '').trim();
      const currentPhone = String(incoming.currentPhone || '').trim();

      if (!currentEmail && !currentUsername && !currentPhone) {
        return sendJson(response, 400, { error: 'Current email, username, or phone is required to delete profile.' });
      }

      const filePath = findUserFilePathByIdentity({ currentEmail, currentUsername, currentPhone });
      if (!filePath) {
        return sendJson(response, 404, { error: 'Account not found.' });
      }

      fs.unlinkSync(filePath);
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, { error: 'Could not delete profile.' });
    }
  });
}

function saveResponder(request, response) {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });

  request.on('end', () => {
    try {
      const incoming = JSON.parse(body);
      const phone = String(incoming.phone || '').trim();
      const inviteCode = String(incoming.inviteCode || '').trim();
      const name = String(incoming.name || '').trim();
      const username = String(incoming.username || '').trim();
      const email = String(incoming.email || '').trim();
      const password = String(incoming.password || '').trim();

      if (!inviteCode || !name || !email || !password) {
        return sendJson(response, 400, { error: 'Invite code, name, email, and password are required.' });
      }

      if (!isValidEmail(email)) {
        return sendJson(response, 400, { error: 'Please enter a valid email address.' });
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        return sendJson(response, 400, { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      }

      let validInviteCodes;
      try {
        validInviteCodes = getValidInviteCodes();
      } catch (error) {
        return sendJson(response, 503, {
          error: 'Could not load invite codes.',
          details: error.message,
        });
      }

      if (!validInviteCodes.includes(inviteCode)) {
        return sendJson(response, 400, { error: 'Invite code is not valid.' });
      }

      const record = {
        inviteCode,
        name,
        phone,
        username: username || email,
        email,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
      };

      const fileName = `${safeUserId(record.username || email || phone || name)}.json`;
      const filePath = path.join(USERS_FOLDER, fileName);
      fs.mkdirSync(USERS_FOLDER, { recursive: true });

      // If an account with this identity already exists, treat this as a
      // login attempt rather than a hard failure — resubmitting the signup
      // form (e.g. a double-tap, or a returning user) should feel seamless.
      const existingFilePath = fs.existsSync(filePath)
        ? filePath
        : findUserFilePathByUsername(normalizeValue(record.username));

      if (existingFilePath) {
        const existingRecord = JSON.parse(fs.readFileSync(existingFilePath, 'utf8'));
        const passwordMatches = existingRecord.passwordHash
          ? verifyPassword(password, existingRecord.passwordHash)
          : existingRecord.password === password;

        if (!passwordMatches) {
          return sendJson(response, 400, { error: 'That username is already taken.' });
        }

        const responseBody = sanitizeUserRecord(existingRecord);
        responseBody.action = 'login';
        return sendJson(response, 200, responseBody);
      }

      fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
      const responseBody = sanitizeUserRecord(record);
      responseBody.action = 'signup';
      sendJson(response, 200, responseBody);
    } catch (error) {
      sendJson(response, 400, { error: 'Could not read signup data.' });
    }
  });
}

function loginResponder(request, response) {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });

  request.on('end', () => {
    try {
      const incoming = JSON.parse(body);
      const email = String(incoming.email || '').trim();
      const username = String(incoming.username || '').trim();
      const password = String(incoming.password || '').trim();

      if (!email && !username) {
        return sendJson(response, 400, { error: 'Email or username is required.' });
      }

      if (!password) {
        return sendJson(response, 400, { error: 'Password is required.' });
      }

      fs.mkdirSync(USERS_FOLDER, { recursive: true });
      const candidates = fs.readdirSync(USERS_FOLDER)
        .filter((file) => file.endsWith('.json'))
        .map((file) => path.join(USERS_FOLDER, file));

      const matchedUser = candidates
        .map((filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8')))
        .find((record) => {
          const loginEmail = String(record.email || '').trim();
          const loginUsername = String(record.username || '').trim();
          const identityMatches = loginEmail === email || loginUsername === username || loginUsername === email;
          if (!identityMatches) {
            return false;
          }

          // Support both hashed accounts (current) and any legacy plaintext
          // accounts that haven't been migrated yet.
          if (record.passwordHash) {
            return verifyPassword(password, record.passwordHash);
          }

          return record.password === password;
        });

      if (!matchedUser) {
        return sendJson(response, 401, { error: 'Invalid username or password.' });
      }

      const responseBody = sanitizeUserRecord(matchedUser);
      responseBody.action = 'login';
      sendJson(response, 200, responseBody);
    } catch (error) {
      sendJson(response, 400, { error: 'Could not read login data.' });
    }
  });
}

function serveFile(request, response, urlPath) {
  let relativePath = urlPath === '/' ? '/index.html' : urlPath;

  if (relativePath.includes('/back-end/')) {
    response.writeHead(403, {
      'Access-Control-Allow-Origin': '*',
    });
    return response.end('Not allowed.');
  }

  const filePath = path.normalize(path.join(FRONT_END_ROOT, relativePath));
  if (!filePath.startsWith(FRONT_END_ROOT)) {
    response.writeHead(403, {
      'Access-Control-Allow-Origin': '*',
    });
    return response.end('Not allowed.');
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
      return response.end('<h1>404 — page not found</h1>');
    }

    const type = FILE_TYPES[path.extname(filePath)] || 'text/plain';
    response.writeHead(200, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
    response.end(contents);
  });
}

const createServer = () => http.createServer((request, response) => {
  const parsedUrl = new URL(request.url, 'http://localhost');
  const pathName = parsedUrl.pathname;

  if (request.method === 'OPTIONS' && (pathName === '/api/signup' || pathName === '/api/login' || pathName === '/api/profile')) {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return response.end();
  }

  if (request.method === 'POST' && pathName === '/api/signup') {
    return saveResponder(request, response);
  }

  if (request.method === 'POST' && pathName === '/api/login') {
    return loginResponder(request, response);
  }

  if (request.method === 'DELETE' && pathName === '/api/profile') {
    return deleteResponderProfile(request, response);
  }

  if (request.method === 'POST' && pathName === '/api/profile') {
    return updateResponderProfile(request, response);
  }

  return serveFile(request, response, pathName);
});

function startServer(port, host = DEFAULT_HOST) {
  const server = createServer();
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < 3010) {
      console.log(`Port ${port} is busy; trying ${port + 1} instead.`);
      startServer(port + 1, host);
      return;
    }

    throw error;
  });

  server.listen(port, host, () => {
    console.log(`Beacon signup server is running at http://${host}:${port}`);
  });
}

if (require.main === module) {
  startServer(DEFAULT_PORT);
}

module.exports = {
  createServer,
  startServer,
  safeUserId,
  hashPassword,
  verifyPassword,
  sanitizeUserRecord,
  isValidEmail,
  findUserFilePathByIdentity,
  updateResponderProfile,
  saveResponder,
  loginResponder,
  serveFile,
};
