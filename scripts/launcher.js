#!/usr/bin/env node
// Simple launcher that spawns the Beacon backend and reports status over HTTP.
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.LAUNCHER_PORT ? Number(process.env.LAUNCHER_PORT) : 4000;
const projectRoot = path.join(__dirname, '..');
let serverProcess = null;
let lastStdout = '';

function startBackend() {
  return new Promise((resolve, reject) => {
    if (serverProcess && !serverProcess.killed) {
      return resolve({ started: false, message: 'already-running' });
    }

    serverProcess = spawn(process.execPath, [path.join(projectRoot, 'src', 'back-end', 'server.js')], {
      cwd: projectRoot,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (chunk) => {
      const s = chunk.toString();
      lastStdout += s;
      // console.log('[backend]', s);
      const m = /Beacon signup server is running at (http:\\/\\/localhost:(\\d+))/i.exec(lastStdout);
      if (m) {
        resolve({ started: true, url: m[1], port: Number(m[2]) });
      }
    });

    serverProcess.stderr.on('data', (chunk) => {
      lastStdout += chunk.toString();
    });

    serverProcess.on('exit', (code, sig) => {
      serverProcess = null;
    });

    // Safety timeout: if not resolved in 3s, still resolve that process launched
    setTimeout(() => {
      if (serverProcess) {
        resolve({ started: true, message: 'launched' });
      } else {
        reject(new Error('failed-to-start-backend'));
      }
    }, 3000);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/start') {
    try {
      const info = await startBackend();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(info));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/status') {
    const running = !!(serverProcess && !serverProcess.killed);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ running, lastStdout }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not-found' }));
});

server.listen(PORT, () => {
  console.log(`Launcher running on http://localhost:${PORT}`);
  console.log(`Call http://localhost:${PORT}/start to launch the backend.`);
});
