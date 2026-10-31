import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { APP_NAME, iconPathFor, isVendorPath, resolveTarget } from '../scripts/package.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const python = process.platform === 'win32' ? 'python' : 'python3';

test('packaging selects native targets and icons without changing Mac defaults', () => {
  assert.deepEqual(resolveTarget({ platform: 'darwin' }), { platform: 'darwin', arch: 'arm64' });
  assert.deepEqual(resolveTarget({ platform: 'win32' }), { platform: 'win32', arch: 'x64' });
  assert.equal(iconPathFor('darwin'), join(root, 'assets', 'app-icon.icns'));
  assert.equal(iconPathFor('win32'), join(root, 'assets', 'app-icon.ico'));
  assert.throws(() => resolveTarget({ platform: 'linux' }));
  assert.throws(() => resolveTarget({ platform: 'win32', arch: 'arm64' }));
  assert.throws(() => resolveTarget({ platform: 'darwin', arch: 'x64' }));
});

test('development sources are excluded with either path separator', () => {
  for (const source of ['src/vendor', 'src\\vendor', 'vendor']) assert.equal(isVendorPath(source), true);
  for (const source of ['src/pickers.mjs', 'src\\main.cjs']) assert.equal(isVendorPath(source), false);
});

test('Windows ZIP preserves Unicode names, binary contents and the installer', t => {
  const fixture = mkdtempSync(join(tmpdir(), 'dafeiyu-zip-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const app = join(fixture, `${APP_NAME}-win32-x64`);
  const archive = join(fixture, 'release.zip');
  mkdirSync(join(app, 'resources'), { recursive: true });
  writeFileSync(join(app, 'BlueDaFeiYu.exe'), Buffer.from([0, 1, 128, 255]));
  writeFileSync(join(app, 'resources', '\u52a8\u753b.webm'), 'fixture');
  execFileSync(python, [join(root, 'scripts/windows/archive.py'), app,
    join(root, 'scripts/windows/install.ps1'), archive]);
  const inspection = JSON.parse(execFileSync(python, ['-c',
    'import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({"names":z.namelist(),"invalid":z.testzip(),"exe":list(z.read(sys.argv[2]))}))',
    archive, `${APP_NAME}-win32-x64/BlueDaFeiYu.exe`], { encoding: 'utf8' }));
  assert.equal(inspection.invalid, null);
  assert.deepEqual(inspection.exe, [0, 1, 128, 255]);
  assert.deepEqual(inspection.names.sort(), [
    'install.ps1', `${APP_NAME}-win32-x64/BlueDaFeiYu.exe`, `${APP_NAME}-win32-x64/resources/\u52a8\u753b.webm`,
  ].sort());
});

test('Windows installer upgrades safely, rejects unrelated directories and retains user data',
  { skip: process.platform !== 'win32' }, t => {
    const fixture = mkdtempSync(join(tmpdir(), 'dafeiyu install '));
    t.after(() => rmSync(fixture, { recursive: true, force: true }));
    const release = join(fixture, 'release');
    const app = join(release, `${APP_NAME}-win32-x64`);
    const local = join(fixture, 'local');
    const roaming = join(fixture, 'roaming');
    const installed = join(local, 'Programs', 'magpie-DaFeiYu');
    const preferences = join(roaming, 'BlueDaFeiYu-Codex', 'settings.json');
    const script = join(release, 'install.ps1');
    mkdirSync(app, { recursive: true });
    mkdirSync(join(roaming, 'BlueDaFeiYu-Codex'), { recursive: true });
    mkdirSync(installed, { recursive: true });
    writeFileSync(preferences, '{"paused":true}');
    writeFileSync(join(app, 'BlueDaFeiYu.exe'), 'version one');
    writeFileSync(join(installed, 'unrelated.txt'), 'keep me');
    copyFileSync(join(root, 'scripts/windows/install.ps1'), script);
    const run = (file, ...args) => execFileSync('powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file, ...args],
      { env: { ...process.env, LOCALAPPDATA: local, APPDATA: roaming }, stdio: 'pipe' });
    assert.throws(() => run(script));
    assert.equal(readFileSync(join(installed, 'unrelated.txt'), 'utf8'), 'keep me');
    rmSync(installed, { recursive: true });
    run(script);
    assert.equal(readFileSync(join(installed, 'BlueDaFeiYu.exe'), 'utf8'), 'version one');
    const shortcut = join(roaming, 'Microsoft/Windows/Start Menu/Programs', `${APP_NAME}.lnk`);
    assert.ok(existsSync(shortcut));
    writeFileSync(join(installed, 'old-file.txt'), 'obsolete');
    writeFileSync(join(app, 'BlueDaFeiYu.exe'), 'version two');
    run(script);
    assert.equal(readFileSync(join(installed, 'BlueDaFeiYu.exe'), 'utf8'), 'version two');
    assert.equal(existsSync(join(installed, 'old-file.txt')), false);
    run(join(installed, 'install.ps1'), '-Uninstall');
    assert.equal(existsSync(installed), false);
    assert.equal(existsSync(shortcut), false);
    assert.equal(readFileSync(preferences, 'utf8'), '{"paused":true}');
  });
