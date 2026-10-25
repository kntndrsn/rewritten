import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

export function findEsbuild() {
  const candidates = [
    process.env.ESBUILD_BINARY_PATH,
    join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild'),
    process.env.USERPROFILE ? join(process.env.USERPROFILE, '.lmstudio', '.internal', 'utils', 'esbuild.exe') : null,
    'esbuild'
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === 'esbuild' || existsSync(candidate)) {
      return candidate;
    }
  }
  return 'esbuild';
}

export function buildProject() {
  mkdirSync(distDir, { recursive: true });
  const esbuildBin = findEsbuild();
  const entry = join(rootDir, 'src', 'main.ts');
  const outfile = join(distDir, 'bundle.js');

  execFileSync(
    esbuildBin,
    [
      entry,
      '--bundle',
      '--format=esm',
      '--target=es2022',
      '--sourcemap',
      `--outfile=${outfile}`
    ],
    { stdio: 'inherit', cwd: rootDir }
  );

  if (existsSync(join(rootDir, 'index.html'))) {
    copyFileSync(join(rootDir, 'index.html'), join(distDir, 'index.html'));
  }
  if (existsSync(join(rootDir, 'styles.css'))) {
    copyFileSync(join(rootDir, 'styles.css'), join(distDir, 'styles.css'));
  }
  console.log('Build complete: dist/bundle.js');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildProject();
}
