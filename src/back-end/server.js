const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = process.env.PORT || 3000;
const FRONT_END_ROOT = path.join(__dirname, '..');
const USERS_FOLDER = path.join(__dirname, 'data', 'users');

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

      if (!inviteCode || !name || !phone) {
        return sendJson(response, 400, { error: 'Invite code, name, and phone are required.' });
      }

      const record = {
        inviteCode,
        name,
        phone,
        createdAt: new Date().toISOString(),
      };

      fs.mkdirSync(USERS_FOLDER, { recursive: true });
        const fileName = `${safeUserId(phone || name)}.json`;
        const filePath = path.join(USERS_FOLDER, fileName);

        const alreadyExists = fs.existsSync(filePath);
        if (alreadyExists) {
          // Treat this as a login: read stored record and return action 'login'
          try {
            const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            existing.action = 'login';
            sendJson(response, 200, existing);
          } catch (err) {
            // If reading fails, fallback to returning the incoming record marked as login
            record.action = 'login';
            sendJson(response, 200, record);
          }
        } else {
          // New signup: save the record and return action 'signup'
          fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
          record.action = 'signup';
          sendJson(response, 200, record);
        }
    } catch (error) {
      sendJson(response, 400, { error: 'Could not read signup data.' });
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

  if (request.method === 'OPTIONS' && pathName === '/api/signup') {
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
