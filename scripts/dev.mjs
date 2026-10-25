import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname, resolve, relative, isAbsolute } from 'node:path';
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

function isContainedInDir(baseDir, targetPath) {
  const rel = relative(baseDir, targetPath);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

const server = createServer((req, res) => {
  const rawUrlPath = (req.url || '/').split('?')[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawUrlPath);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  // Reject null bytes or explicit parent-directory traversal segments
  if (decodedPath.includes('\0') || decodedPath.split(/[\\/]+/).includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  let relPath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^[/\\]+/, '');
  if (relPath.startsWith('dist/') || relPath.startsWith('dist\\')) {
    relPath = relPath.slice('dist/'.length);
  }

  const candidateBases = [distDir, rootDir];

  for (const baseDir of candidateBases) {
    const filePath = resolve(baseDir, relPath);
    if (!isContainedInDir(baseDir, filePath)) {
      continue;
    }

    try {
      if (!existsSync(filePath)) continue;
      const stat = statSync(filePath);
      if (!stat.isFile()) continue;

      const body = readFileSync(filePath);
      const ext = extname(filePath);
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(body);
      return;
    } catch {
      continue;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Rewritten dev server listening at http://127.0.0.1:${port}`);
});
