const { win32, posix } = require('node:path');
const { homedir } = require('node:os');

function magpieAppCandidates({ platform = process.platform, home = homedir(), env = process.env } = {}) {
  if (platform === 'darwin') {
    return ['/Applications/magpie.app', posix.join(home, 'Applications', 'magpie.app')];
  }
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA || win32.join(home, 'AppData', 'Local');
    return [
      win32.join(local, 'Programs', 'magpie', 'magpie.exe'),
      win32.join(local, 'magpie', 'magpie.exe'),
      ...[env.ProgramFiles, env['ProgramFiles(x86)']].filter(Boolean)
        .map(directory => win32.join(directory, 'magpie', 'magpie.exe')),
    ];
  }
  return [];
}

module.exports = { magpieAppCandidates };
