// Copies the static game into dist/, which both native wrappers load.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const FILES = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'vendor', 'icons'];

// the web version works offline only if the service worker caches every script:
// a new js/ file that is missing from sw.js would break the game without internet
const sw = readFileSync('sw.js', 'utf8');
const missing = readdirSync('js')
  .filter((f) => f.endsWith('.js'))
  .map((f) => `./js/${f}`)
  .filter((f) => !sw.includes(`'${f}'`));
if (missing.length) {
  console.error(`sw.js ASSETS is missing: ${missing.join(', ')}`);
  process.exit(1);
}

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const f of FILES) cpSync(f, `dist/${f}`, { recursive: true });
// the apps compare this with the latest GitHub release to offer updates
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
writeFileSync('dist/version.json', JSON.stringify({ version }));
console.log(`dist/ ready (v${version})`);
