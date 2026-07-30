http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = process.env.PORT || 3000;
const FRONT_END_ROOT = path.join(__dirname, '..');
const USERS_FOLDER = path.join(__dirname, 'data', 'users');
const INVITE_CODES_FILE = path.join(__dirname, 'data', 'invite-codes.json');

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

function findUserFilePathByIdentity({ currentEmail, currentUsername, currentPhone }) {
  if (!fs.existsSync(USERS_FOLDER)) {
    return null;
  }

  const candidates = fs.readdirSync(USERS_FOLDER)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(USERS_FOLDER, file));

  for (const filePath of candidates) {
    try {
      const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const email = String(record.email || '').trim();
      const username = String(record.username || '').trim();
      const phone = String(record.phone || '').trim();

      if ((currentEmail && email === currentEmail)
          || (currentUsername && username === currentUsername)
          || (currentPhone && phone === currentPhone)) {
        return filePath;
      }
    } catch (err) {
      continue;
    }
  }

  return null;
}

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

      const filePath = findUserFilePathByIdentity({ currentEmail, currentUsername, currentPhone });
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
        password: newPassword || existing.password,
      };

      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
      sendJson(response, 200, updated);
    } catch (error) {
      sendJson(response, 400, { error: 'Could not update profile.' });
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
        password,
        createdAt: new Date().toISOString(),
      };

      fs.mkdirSync(USERS_FOLDER, { recursive: true });
      const fileName = `${safeUserId(phone || name)}.json`;
      const filePath = path.join(USERS_FOLDER, fileName);

      const alreadyExists = fs.existsSync(filePath);
      if (alreadyExists) {
        try {
          const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          existing.action = 'login';
          sendJson(response, 200, existing);
        } catch (err) {
          record.action = 'login';
          sendJson(response, 200, record);
        }
      } else {
        fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
        record.action = 'signup';
        sendJson(response, 200, record);
      }
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
          return (loginEmail === email || loginUsername === username || loginUsername === email) && record.password === password;
        });

      if (!matchedUser) {
        return sendJson(response, 401, { error: 'Invalid username or password.' });
      }

      sendJson(response, 200, { ...matchedUser, action: 'login' });
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

  if (request.method === 'OPTIONS' && (pathName === '/api/signup' || pathName === '/api/login')) {
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

  if (request.method === 'POST' && pathName === '/api/profile') {
    return updateResponderProfile(request, response);
  }

  return serveFile(request, response, pathName);
});

function startServer(port) {
  const server = createServer();
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < 3010) {
      console.log(`Port ${port} is busy; trying ${port + 1} instead.`);
      startServer(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port, () => {
    console.log(`Beacon signup server is running at http://localhost:${port}`);
  });
}

startServer(DEFAULT_PORT);
