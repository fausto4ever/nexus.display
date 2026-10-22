import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('Display: HTML, CSS, JS, manifest y configuración se revalidan al actualizar', async () => {
  const headers = await read('_headers');
  const sections = new Map([...headers.matchAll(/^([^\s#][^\n]*)\n((?:[ \t]+[^\n]*\n?)*)/gm)].map(([, path, rules]) => [path.trim(), rules]));
  for (const path of ['/', '/*.html', '/styles.css', '/styles-enhanced.css', '/src/*', '/manifest.webmanifest']) {
    assert.match(sections.get(path) || '', /Cache-Control:\s*no-cache/i, path);
  }
  for (const path of ['/config.json', '/build-info.json']) {
    assert.match(sections.get(path) || '', /Cache-Control:\s*no-store/i, path);
  }
});

test('Display: el build publica las reglas de caché y el manifest', async () => {
  const build = await read('scripts/build.mjs');
  assert.match(build, /rootRuntimeFiles\s*=\s*\[[^\]]*'_headers'/);
  assert.match(build, /rootRuntimeFiles\s*=\s*\[[^\]]*'manifest.webmanifest'/);
  const html = await read('index.html');
  assert.match(html, /rel="manifest"/);
  assert.match(html, /src="\.\/src\/app\.js"/);
});
