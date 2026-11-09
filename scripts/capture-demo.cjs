const { app, BrowserWindow, ipcMain } = require('electron');
const { readFileSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');

const root = path.join(__dirname, '..');
const profile = mkdtempSync(path.join(tmpdir(), 'dafeiyu-demo-'));
app.setPath('userData', profile);
app.setName('magpie-DaFeiYu Demo');
const catalog = JSON.parse(readFileSync(path.join(root, 'assets/catalog.json'), 'utf8'));
const now = Date.now();
const accountIds = ['demo-cursor', 'demo-codex', 'demo-deepseek', 'demo-volcengine'];
const snapshot = {
  catalog,
  settings: { size: 560, active: true, paused: false, locked: false, followTasks: true, showBulbs: true, showQuotas: true, hiddenQuotas: {} },
  activity: { state: 'thinking', label: 'Magpie 演示请求', available: true, activeCount: 5, observedAt: now, activeAccountIds: [accountIds[1]] },
  quota: { ok: true, observedAt: now, accounts: [
    { accountId: accountIds[0], provider: 'cursor', icon: 'cursor', name: 'Cursor', plan: 'Team', kind: 'subscription', label: 'Cursor · Team #1' },
    { accountId: accountIds[1], provider: 'codex', icon: 'codex-color', name: 'Codex', plan: 'Plus', kind: 'subscription', label: 'Codex · Plus #2' },
    { accountId: accountIds[2], provider: 'deepseek', icon: 'deepseek-color', name: 'DeepSeek', plan: 'API', kind: 'balance', balance: '¥19.98', readAt: now, label: 'DeepSeek · API #3' },
    { accountId: accountIds[3], provider: 'volcengine', icon: 'volcengine-color', name: 'Volcengine Ark', plan: 'Coding Plan', kind: 'subscription', label: 'Volcengine Ark · Coding Plan #4' },
  ], windows: [
    { accountId: accountIds[0], key: 'cursor|Cursor|Team|1|window|0|Cursor Models', windowName: 'Cursor Models', icon: 'cursor', provider: 'cursor', remaining: 100, used: 0, readAt: now, resetsAt: now / 1000 + 3600 },
    { accountId: accountIds[1], key: 'codex|Codex|Plus|2|window|0|7 days', windowName: '7 days', icon: 'codex-color', provider: 'codex', remaining: 71, used: 29, readAt: now, resetsAt: now / 1000 + 3600 },
    { accountId: accountIds[3], key: 'volcengine|Volcengine Ark|Coding Plan|4|window|0|Month', windowName: 'Month', icon: 'volcengine-color', provider: 'volcengine', remaining: 87, used: 13, readAt: now, resetsAt: now / 1000 + 3600 },
  ] },
};

app.whenReady().then(async () => {
  app.dock?.hide();
  ipcMain.handle('snapshot', () => snapshot);
  const window = new BrowserWindow({ width: 560, height: 427, frame: false, show: false,
    backgroundColor: '#eff5fc', webPreferences: { preload: path.join(root, 'src/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  await window.loadFile(path.join(root, 'src/pet.html'));
  await window.webContents.insertCSS('body { background: radial-gradient(ellipse at 50% 55%, #ffffff 0%, #eff5fc 75%); }');
  window.showInactive();
  await new Promise(resolve => setTimeout(resolve, 800));
  window.webContents.send('play', '撸猫');
  await new Promise(resolve => setTimeout(resolve, 4500));
  const report = await window.webContents.executeJavaScript('({ ...window.petDiagnostics, percentages: [...document.querySelectorAll(".account-value")].map(element => element.textContent) })');
  if (report.errors.length || !report.loaded || report.percentages.join(',') !== '100%,71%,87%,¥19.98') {
    throw new Error(`Demo render failed: ${JSON.stringify({ errors: report.errors, loaded: report.loaded, percentages: report.percentages })}`);
  }
  const output = path.join(root, 'docs/images');
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(output, 'desktop.png'), (await window.webContents.capturePage()).toPNG());
  console.log('Saved docs/images/desktop.png using synthetic account data.');
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });

app.on('will-quit', () => rmSync(profile, { recursive: true, force: true }));
