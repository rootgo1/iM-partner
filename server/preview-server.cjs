'use strict';
// Optional zero-dependency Node 20+ static preview server.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json; charset=utf-8' };
function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
      const requestPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const resolved = path.resolve(ROOT, '.' + requestPath), relative = path.relative(ROOT, resolved);
      const extension = path.extname(resolved).toLowerCase();
      if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => part.startsWith('.')) || !MIME[extension] || !/^(index\.html|prototype[\\/])/.test(relative) || /[\\/]tests[\\/]/.test(relative)) { res.writeHead(404); res.end(); return; }
      const content = await fs.readFile(resolved);
      res.writeHead(200, { 'Content-Type': MIME[extension], 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (_) { res.writeHead(404); res.end(); }
  });
}
if (require.main === module) {
  const port = Number(process.env.PORT || 8877);
  createServer().listen(port, '127.0.0.1', () => process.stdout.write('Preview: http://127.0.0.1:' + port + '/prototype/main-screen.html\n'));
}
module.exports = { createServer };
