// Copies the static game into dist/, which both native wrappers load.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const FILES = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'vendor', 'icons'];

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const f of FILES) cpSync(f, `dist/${f}`, { recursive: true });
// the apps compare this with the latest GitHub release to offer updates
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
writeFileSync('dist/version.json', JSON.stringify({ version }));
console.log(`dist/ ready (v${version})`);
