import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProject } from './build.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');
const port = Number(process.env.PORT || 5173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

buildProject();

const server = createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  let relPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  if (relPath.startsWith('dist/')) {
    relPath = relPath.slice('dist/'.length);
  }

  const candidatePaths = [
    join(distDir, relPath),
    join(rootDir, relPath)
  ];

  for (const filePath of candidatePaths) {
    if (existsSync(filePath)) {
      const ext = extname(filePath);
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(readFileSync(filePath));
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Rewritten dev server listening at http://127.0.0.1:${port}`);
});
