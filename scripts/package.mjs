import { packager } from '@electron/packager';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const APP_NAME = '蓝色大肥鱼';
export const EXECUTABLE_NAME = 'BlueDaFeiYu';
export const APP_BUNDLE_ID = 'local.blue-dafeiyu.codex';
export const SUPPORTED_TARGETS = { darwin: ['arm64'], win32: ['x64'] };

const root = fileURLToPath(new URL('..', import.meta.url));

function usageText() {
  return [
    'Usage: node scripts/package.mjs [--platform darwin|win32] [--arch arm64|x64]',
    `Defaults: current platform (${process.platform}); darwin defaults to arm64, win32 to x64.`,
  ].join('\n');
}
export function parseCliArgs(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usageText());
    return { help: true };
  }
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { platform: { type: 'string' }, arch: { type: 'string' } },
      allowPositionals: false,
    }));
  } catch (error) {
    console.error(usageText());
    throw error;
  }
  return { platform: values.platform, arch: values.arch };
}

export function resolveTarget({ platform = process.platform, arch } = {}) {
  const resolved = {
    platform,
    arch: arch ?? (platform === 'darwin' ? 'arm64' : platform === 'win32' ? 'x64' : process.arch),
  };
  if (!SUPPORTED_TARGETS[resolved.platform]?.includes(resolved.arch)) {
    const supported = Object.entries(SUPPORTED_TARGETS).map(([name, arches]) => `${name} ${arches.join('/')}`).join(', ');
    throw new Error(`Unsupported package target ${resolved.platform}/${resolved.arch}; supported: ${supported}`);
  }
  return resolved;
}

export function iconPathFor(platform, base = root) {
  const name = { darwin: 'app-icon.icns', win32: 'app-icon.ico' }[platform];
  if (!name) throw new Error(`No app icon convention for platform ${platform}`);
  return join(base, 'assets', name);
}

// cpSync filters receive platform-native separators, so normalize before comparing.
export function isVendorPath(source) {
  const normalized = String(source).replaceAll('\\', '/');
  return normalized === 'vendor' || normalized.endsWith('/vendor');
}

function trimLocales(resources) {
  const keep = ['en.lproj', 'en_US.lproj', 'en_GB.lproj', 'zh_CN.lproj', 'zh_TW.lproj'];
  for (const entry of readdirSync(resources)) {
    if (entry.endsWith('.lproj') && !keep.includes(entry)) rmSync(join(resources, entry), { recursive: true });
  }
}

function postProcessDarwin(bundle) {
  for (const resources of [
    join(bundle, 'Contents/Resources'),
    join(bundle, 'Contents/Frameworks/Electron Framework.framework/Versions/A/Resources'),
  ]) {
    trimLocales(resources);
  }
  if (process.platform === 'darwin') {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio: 'inherit' });
  }
}

function windowsZipName(version) {
  return `magpie-DaFeiYu-v${version}-Windows-x64.zip`;
}

async function packageTarget(metadata, staging, target) {
  const icon = iconPathFor(target.platform);
  if (!existsSync(icon)) throw new Error(`Missing ${target.platform} app icon: ${icon}`);
  const paths = await packager({
    dir: staging,
    out: join(root, 'dist'),
    name: APP_NAME,
    executableName: EXECUTABLE_NAME,
    icon,
    appBundleId: APP_BUNDLE_ID,
    appVersion: metadata.version,
    platform: target.platform,
    arch: target.arch,
    electronVersion: metadata.devDependencies.electron,
    electronZipDir: process.env.ELECTRON_ZIP_DIR,
    asar: false,
    overwrite: true,
    prune: false,
    ...(target.platform === 'darwin' ? {
      extendInfo: { LSUIElement: true, NSHighResolutionCapable: true, CFBundleDisplayName: APP_NAME },
    } : {}),
  });
  const artifacts = [];
  for (const output of paths) {
    if (target.platform === 'darwin') {
      postProcessDarwin(join(output, `${APP_NAME}.app`));
      artifacts.push(join(output, `${APP_NAME}.app`));
    } else {
      // Portable Windows distribution: the app directory plus the optional per-user installer.
      const installer = join(root, 'scripts', 'windows', 'install.ps1');
      if (!existsSync(installer)) throw new Error(`Missing installer script: ${installer}`);
      const zip = join(root, 'dist', windowsZipName(metadata.version));
      execFileSync(process.platform === 'win32' ? 'python' : 'python3',
        [join(root, 'scripts', 'windows', 'archive.py'), output, installer, zip], { stdio: 'inherit' });
      artifacts.push(zip);
    }
  }
  return artifacts;
}

async function main() {
  const args = parseCliArgs();
  if (args.help) return;
  const target = resolveTarget(args);
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
      recursive: true,
      filter: source => !isVendorPath(source),
    });
    mkdirSync(join(staging, 'assets'));
    for (const name of ['catalog.json', 'upstream.json', 'provider-icons', 'webm']) {
      cpSync(join(root, 'assets', name), join(staging, 'assets', name), { recursive: true, dereference: true });
    }
    const trayIcon = join(root, 'assets', 'tray-icon.png');
    cpSync(trayIcon, join(staging, 'assets', 'tray-icon.png'));
    for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'licenses']) {
      cpSync(join(root, name), join(staging, name), { recursive: true });
    }
    writeFileSync(join(staging, 'package.json'), JSON.stringify({
      name: metadata.name, version: metadata.version, description: metadata.description,
      author: metadata.author, license: metadata.license, main: 'src/main.cjs',
    }, null, 2));
    console.log((await packageTarget(metadata, staging, target)).join('\n'));
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

const invokedAs = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
const isMain = invokedAs === import.meta.url ||
  (process.platform === 'win32' && invokedAs.toLowerCase() === import.meta.url.toLowerCase());
if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
