import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { magpieAppCandidates } from '../src/platform.cjs';
import { resolvePort, readLocal } from '../src/magpie.mjs';

test('Magpie app discovery preserves Mac locations and supports Windows paths with spaces', () => {
  assert.deepEqual(magpieAppCandidates({ platform: 'darwin', home: '/Users/test', env: {} }), [
    '/Applications/magpie.app', '/Users/test/Applications/magpie.app',
  ]);
  assert.deepEqual(magpieAppCandidates({
    platform: 'win32', home: 'C:\\Users\\Test User',
    env: { LOCALAPPDATA: 'D:\\Local Data', ProgramFiles: 'C:\\Program Files' },
  }), [
    'D:\\Local Data\\Programs\\magpie\\magpie.exe',
    'D:\\Local Data\\magpie\\magpie.exe',
    'C:\\Program Files\\magpie\\magpie.exe',
  ]);
  assert.equal(magpieAppCandidates({ platform: 'win32', home: 'C:\\Users\\Test User', env: {} })[0],
    'C:\\Users\\Test User\\AppData\\Local\\Programs\\magpie\\magpie.exe');
  assert.deepEqual(magpieAppCandidates({ platform: 'linux', env: {} }), []);
});

test('Magpie port uses the shared home config and respects XDG on every OS', t => {
  const home = mkdtempSync(join(tmpdir(), 'dafeiyu-config-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const standard = join(home, '.config', 'magpie');
  const custom = join(home, 'custom config \u6d4b\u8bd5');
  mkdirSync(standard, { recursive: true });
  mkdirSync(join(custom, 'magpie'), { recursive: true });
  writeFileSync(join(standard, 'settings.json'), JSON.stringify({ port: 4567, language: '\u4e2d\u6587' }));
  writeFileSync(join(custom, 'magpie', 'settings.json'), JSON.stringify({ port: 5678 }));
  assert.equal(resolvePort({ home, env: {} }), 4567);
  assert.equal(resolvePort({ home, env: { XDG_CONFIG_HOME: custom } }), 5678);
  assert.equal(resolvePort({ home, env: { XDG_CONFIG_HOME: join(home, 'absent') } }), 3425);
  for (const port of [0, -1, 65536, 12.5, '3425', null]) {
    writeFileSync(join(standard, 'settings.json'), JSON.stringify({ port }));
    assert.equal(resolvePort({ home, env: {} }), 3425);
  }
  writeFileSync(join(standard, 'settings.json'), 'invalid json');
  assert.equal(resolvePort({ home, env: {} }), 3425);
});

test('the local integration advertises the packaged version', async () => {
  const { default: metadata } = await import('../package.json', { with: { type: 'json' } });
  await readLocal('/api/hello', { port: 3425, fetcher: async (_url, options) => {
    assert.equal(options.headers['User-Agent'], `Magpie-DaFeiYu/${metadata.version}`);
    return Response.json({ name: 'magpie' });
  } });
});
