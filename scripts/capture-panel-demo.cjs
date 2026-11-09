const { app, BrowserWindow, ipcMain } = require('electron');
const { readFileSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');

const root = path.join(__dirname, '..');
const profile = mkdtempSync(path.join(tmpdir(), 'dafeiyu-panel-demo-'));
app.setPath('userData', profile);
const catalog = JSON.parse(readFileSync(path.join(root, 'assets/catalog.json'), 'utf8'));
const now = Date.now();
const accountIds = ['demo-cursor', 'demo-codex', 'demo-volcengine', 'demo-deepseek'];
const snapshot = {
  catalog,
  settings: { size: 460, active: true, paused: false, locked: false, followTasks: true,
    showBulbs: true, showQuotas: true, hiddenQuotas: { 'cursor|Cursor|Team|1|window|1|Other Models': true } },
  activity: { state: 'thinking', label: 'Magpie 正在处理模型请求', available: true, activeCount: 2, observedAt: now },
  quota: { ok: true, observedAt: now, accounts: [
    { accountId: accountIds[0], provider: 'cursor', icon: 'cursor', name: 'Cursor', plan: 'Team', kind: 'subscription', label: 'Cursor · Team #1' },
    { accountId: accountIds[1], provider: 'codex', icon: 'codex-color', name: 'Codex', plan: 'Plus', kind: 'subscription', label: 'Codex · Plus #2' },
    { accountId: accountIds[2], provider: 'volcengine', icon: 'volcengine-color', name: 'Volcengine Ark', plan: 'Coding Plan', kind: 'subscription', label: 'Volcengine Ark · Coding Plan #3' },
    { accountId: accountIds[3], provider: 'deepseek', icon: 'deepseek-color', name: 'DeepSeek', plan: 'API', kind: 'balance', balance: '¥19.98', readAt: now, label: 'DeepSeek · API #4' },
  ], windows: [
    { accountId: accountIds[0], key: 'cursor|Cursor|Team|1|window|0|Cursor Models', provider: 'cursor', icon: 'cursor', name: 'Cursor', windowName: 'Cursor Models', label: 'Cursor · Team #1 · Cursor Models', remaining: 100, readAt: now, resetsAt: now / 1000 + 3600 },
    { accountId: accountIds[0], key: 'cursor|Cursor|Team|1|window|1|Other Models', provider: 'cursor', icon: 'cursor', name: 'Cursor', windowName: 'Other Models', label: 'Cursor · Team #1 · Other Models', remaining: 82, readAt: now, resetsAt: now / 1000 + 3600 },
    { accountId: accountIds[1], key: 'codex|Codex|Plus|2|window|0|7 days', provider: 'codex', icon: 'codex-color', name: 'Codex', windowName: '7 days', label: 'Codex · Plus #2 · 7 days', remaining: 24, readAt: now, resetsAt: now / 1000 + 3600 },
    { accountId: accountIds[2], key: 'volcengine|Volcengine Ark|Coding Plan|3|window|0|Month', provider: 'volcengine', icon: 'volcengine-color', name: 'Volcengine Ark', windowName: 'Month', label: 'Volcengine Ark · Coding Plan #3 · Month', remaining: 87, readAt: now, resetsAt: now / 1000 + 3600 },
  ] },
};

app.whenReady().then(async () => {
  ipcMain.handle('snapshot', () => snapshot);
  const window = new BrowserWindow({ width: 460, height: 760, show: false,
    webPreferences: { preload: path.join(root, 'src/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  await window.loadFile(path.join(root, 'src/panel.html'));
  await new Promise(resolve => setTimeout(resolve, 500));
  const output = path.join(root, 'qa');
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(output, 'panel.png'), (await window.webContents.capturePage()).toPNG());
  console.log('Saved qa/panel.png using synthetic quota data.');
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });

app.on('will-quit', () => rmSync(profile, { recursive: true, force: true }));
