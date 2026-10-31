// Copies the static game into dist/, which both native wrappers load.
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const FILES = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'vendor', 'icons'];

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const f of FILES) cpSync(f, `dist/${f}`, { recursive: true });
console.log('dist/ ready');
