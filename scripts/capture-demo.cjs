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
const demo = [
  ['cursor', 'cursor', 'Cursor', 96], ['codex', 'codex-color', 'Codex', 71], ['claude', 'claude-color', 'Claude', 64],
  ['gemini', 'gemini-color', 'Gemini', 88], ['openai', 'openai', 'OpenAI', 52], ['grok', 'grok', 'Grok', 100],
  ['qwen', 'qwen-color', 'Qwen', 79], ['zhipu', 'zhipu-color', 'GLM', 43], ['volcengine', 'volcengine-color', 'Volcengine Ark', 87],
];
const accountIds = demo.map(([provider]) => `demo-${provider}`);
const snapshot = {
  catalog,
  settings: { size: 560, active: true, paused: false, locked: false, followTasks: true, showBulbs: true, showQuotas: true, hiddenQuotas: {} },
  activity: { state: 'thinking', label: 'Magpie 演示请求', available: true, activeCount: 8, observedAt: now, activeAccountIds: [accountIds[1]] },
  quota: { ok: true, observedAt: now, accounts: [
    ...demo.map(([provider, icon, name], index) => ({ accountId: accountIds[index], provider, icon, name, plan: 'Demo', kind: 'subscription', label: `${name} · Demo #${index + 1}` })),
    { accountId: 'demo-deepseek', provider: 'deepseek', icon: 'deepseek-color', name: 'DeepSeek', plan: 'API', kind: 'balance', balance: '¥19.98', readAt: now, label: 'DeepSeek · API' },
  ], windows: demo.map(([provider, icon, name, remaining], index) => ({ accountId: accountIds[index], key: `${provider}|demo|${index}`,
    windowName: 'Demo', icon, provider, name, remaining, used: 100 - remaining, readAt: now, resetsAt: now / 1000 + 3600 })) },
};
const expected = [...demo.map(([, , , remaining]) => `${remaining}%`), '¥19.98'].join(',');

app.whenReady().then(async () => {
  app.dock?.hide();
  ipcMain.handle('snapshot', () => snapshot);
  let window;
  ipcMain.on('resize', (_event, height) => { if (window && Number.isFinite(height)) window.setContentSize(560, Math.round(height)); });
  window = new BrowserWindow({ width: 560, height: 470, frame: false, show: false,
    backgroundColor: '#eff5fc', webPreferences: { preload: path.join(root, 'src/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  await window.loadFile(path.join(root, 'src/pet.html'));
  await window.webContents.insertCSS('body { background: radial-gradient(ellipse at 50% 55%, #ffffff 0%, #eff5fc 75%); }');
  window.showInactive();
  await new Promise(resolve => setTimeout(resolve, 800));
  window.webContents.send('play', '撸猫');
  await new Promise(resolve => setTimeout(resolve, 4500));
  const report = await window.webContents.executeJavaScript('({ ...window.petDiagnostics, percentages: [...document.querySelectorAll(".account-value")].map(element => element.textContent) })');
  if (report.errors.length || !report.loaded || report.percentages.join(',') !== expected) {
    throw new Error(`Demo render failed: ${JSON.stringify({ errors: report.errors, loaded: report.loaded, percentages: report.percentages })}`);
  }
  const output = path.join(root, 'docs/images');
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(output, 'desktop.png'), (await window.webContents.capturePage()).toPNG());
  console.log('Saved docs/images/desktop.png using synthetic account data.');
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });

app.on('will-quit', () => rmSync(profile, { recursive: true, force: true }));
