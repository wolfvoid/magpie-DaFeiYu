import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const metadata = JSON.parse(readFileSync(new URL('package.json', root)));

test('Magpie discovers a committed page rather than loading Electron in its plugin host', () => {
  assert.equal(metadata.main, undefined);
  assert.equal(metadata.exports, undefined);
  assert.deepEqual(metadata.magpie.permissions, []);
  for (const name of [metadata.magpie.page.file, metadata.magpie.page.icon]) {
    assert.ok(existsSync(fileURLToPath(new URL(name, root))));
  }
  const page = readFileSync(new URL(metadata.magpie.page.file, root), 'utf8');
  assert.ok(page.includes('_magpie/bridge.js'));
  assert.ok(page.includes('不会自动安装或启动桌宠'));
  assert.ok(page.includes('https://github.com/wolfvoid/DaFeiYu-magpie/releases/latest'));
});
