// After Vite build, copy index.html into dist/ so the subdomain root has a landing page.
// (Vite lib mode does NOT process index.html.)
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'index.html');
const DEST_DIR = resolve(ROOT, 'dist');
const DEST = resolve(DEST_DIR, 'index.html');

if (!existsSync(DEST_DIR)) mkdirSync(DEST_DIR, { recursive: true });
copyFileSync(SRC, DEST);
console.log('[widget] copied index.html -> dist/index.html');
