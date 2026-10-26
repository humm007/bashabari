#!/usr/bin/env node
/*
 * Basha Bari demo server. Serves the demo and shares its data live between devices on your Wi-Fi,
 * so a phone (the app) and a laptop (the admin website) see the same thing.
 *
 *   node server.js            → http://localhost:8080
 *   node server.js 3000       → another port
 *
 * Demo only: no login, made-up data, saved to .demo-state.json next to this file.
 * Do not open it to the internet (no port forwarding).
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const PORT = +process.argv[2] || 8080;
const DATA = path.join(ROOT, '.demo-state.json');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };

let state = null;
try { state = fs.readFileSync(DATA, 'utf8'); JSON.parse(state); } catch (e) { state = null; }
const clients = new Set();

function send(res, code, body, type) {
  res.writeHead(code, { 'content-type': type || 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/state') {
    if (req.method === 'GET') return send(res, 200, state || 'null', 'application/json');
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 25e6) req.destroy(); });
      req.on('end', () => {
        try { JSON.parse(body); } catch (e) { return send(res, 400, 'bad json'); }
        state = body;
        fs.writeFile(DATA, body, () => {});
        for (const c of clients) c.write(`data: ${body}\n\n`);
        send(res, 204, '');
      });
      return;
    }
    return send(res, 405, 'method not allowed');
  }
  if (url.pathname === '/api/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep) || path.basename(file).startsWith('.')) return send(res, 404, 'not found');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'not found');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
    res.end(buf);
  });
});

setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 25000);

server.listen(PORT, '0.0.0.0', () => {
  const addrs = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) addrs.push(a.address);
  console.log('\nBasha Bari demo is running.\n');
  console.log('  On this computer:   http://localhost:' + PORT);
  for (const a of addrs) console.log('  On your phone:      http://' + a + ':' + PORT + '   (same Wi-Fi)');
  console.log('\n  App:   /app.html     Admin website:   /admin.html');
  console.log('  Data is shared live between every device that opens it. Press Ctrl+C to stop.\n');
});
