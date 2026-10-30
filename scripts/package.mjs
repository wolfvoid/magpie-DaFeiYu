import { packager } from '@electron/packager';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
const metadata = JSON.parse(readFileSync(join(root, 'package.json')));
const manifest = JSON.parse(readFileSync(join(root, 'assets/upstream.json')));
for (const entry of manifest.files) {
  const data = readFileSync(join(root, 'assets/webm', entry.name));
  const digest = createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
  if (digest !== entry.sha || data.length !== entry.size) throw new Error(`Invalid animation: ${entry.name}`);
}
mkdirSync(join(root, '.runtime'), { recursive: true });
const staging = mkdtempSync(join(root, '.runtime/package-'));
try {
  cpSync(join(root, 'src'), join(staging, 'src'), {
    recursive: true, filter: source => !source.endsWith('/vendor'),
  });
  mkdirSync(join(staging, 'assets'));
  for (const name of ['catalog.json', 'upstream.json', 'webm']) {
    cpSync(join(root, 'assets', name), join(staging, 'assets', name), { recursive: true, dereference: true });
  }
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'licenses']) {
    cpSync(join(root, name), join(staging, name), { recursive: true });
  }
  writeFileSync(join(staging, 'package.json'), JSON.stringify({
    name: metadata.name, version: metadata.version, description: metadata.description,
    author: metadata.author, license: metadata.license, main: 'src/main.cjs',
  }, null, 2));
  const paths = await packager({
    dir: staging, out: join(root, 'dist'), name: '蓝色大肥鱼',
    executableName: 'BlueDaFeiYu', icon: join(root, 'assets/app-icon.icns'),
    appBundleId: 'local.blue-dafeiyu.codex', appVersion: metadata.version,
    platform: 'darwin', arch: 'arm64', electronVersion: metadata.devDependencies.electron,
    electronZipDir: process.env.ELECTRON_ZIP_DIR, asar: false, overwrite: true, prune: false,
    extendInfo: { LSUIElement: true, NSHighResolutionCapable: true, CFBundleDisplayName: '蓝色大肥鱼' },
  });
  for (const output of paths) {
    const bundle = join(output, '蓝色大肥鱼.app');
    for (const resources of [
      join(bundle, 'Contents/Resources'),
      join(bundle, 'Contents/Frameworks/Electron Framework.framework/Versions/A/Resources'),
    ]) {
      for (const entry of readdirSync(resources)) {
        if (entry.endsWith('.lproj') && !['en.lproj', 'en_US.lproj', 'en_GB.lproj', 'zh_CN.lproj', 'zh_TW.lproj'].includes(entry)) {
          rmSync(join(resources, entry), { recursive: true });
        }
      }
    }
    if (process.platform === 'darwin') {
      execFileSync('codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio: 'inherit' });
    }
  }
  console.log(paths.join('\n'));
} finally {
  rmSync(staging, { recursive: true, force: true });
}
