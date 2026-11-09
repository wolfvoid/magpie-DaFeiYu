import { quotaEntries } from './quota-display.mjs';
import { providerIconSource, providerInitial } from './provider-icons.mjs';

const api = window.pet;
let catalog;
let lastQuota;
let settings = { hiddenQuotas: {} };

function renderActivity(activity) {
  document.querySelector('#activity').textContent = activity.label + (activity.activeCount > 1 ? ` · ${activity.activeCount} 个请求` : '');
  document.querySelector('#scope').textContent = activity.available ? '本机 Magpie' : '状态未知';
}

function renderQuota(quota) {
  lastQuota = quota;
  const container = document.querySelector('#quota');
  container.replaceChildren();
  if (!quota.ok) {
    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = quota.error || '额度暂不可用';
    container.append(error);
  }
  for (const entry of quotaEntries(quota)) {
    const row = document.createElement('div');
    row.className = 'quota-row';
    const head = document.createElement('div');
    head.className = 'quota-head';
    const icon = document.createElement('span');
    icon.className = 'quota-icon';
    const source = providerIconSource(entry.icon);
    if (source) {
      const image = document.createElement('img');
      image.src = source;
      image.alt = '';
      icon.append(image);
    } else icon.textContent = providerInitial(entry);
    const name = document.createElement('span');
    name.className = 'quota-name';
    name.textContent = entry.kind === 'balance' ? entry.label : entry.windowName;
    name.title = entry.label;
    const remaining = document.createElement('strong');
    remaining.className = 'quota-value';
    remaining.textContent = entry.text;
    const toggle = document.createElement('button');
    const visible = settings.hiddenQuotas?.[entry.key] !== true;
    toggle.className = 'quota-switch';
    toggle.type = 'button';
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', String(visible));
    toggle.setAttribute('aria-label', `${visible ? '隐藏' : '显示'}「${entry.label}」在桌宠右侧`);
    toggle.title = visible ? '当前显示在桌宠上，点击隐藏' : '当前已隐藏，点击显示在桌宠上';
    toggle.onclick = () => {
      const hiddenQuotas = { ...(settings.hiddenQuotas || {}) };
      if (visible) hiddenQuotas[entry.key] = true;
      else delete hiddenQuotas[entry.key];
      settings = { ...settings, hiddenQuotas };
      api.setting('hiddenQuotas', hiddenQuotas);
      renderQuota(quota);
    };
    head.append(icon, name, remaining, toggle);
    row.append(head);
    if (entry.kind === 'subscription') {
      const meter = document.createElement('div');
      meter.className = 'meter';
      const fill = document.createElement('span');
      fill.style.width = `${entry.available ? entry.remaining : 0}%`;
      if (entry.remaining < 20) fill.style.background = '#db9f78';
      meter.append(fill);
      const reset = document.createElement('div');
      reset.className = 'reset';
      reset.textContent = entry.resetsAt ? `重置：${new Date(entry.resetsAt * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}（北京时间）` : '重置时间暂不可用';
      reset.textContent += entry.readAt ? ` · 数据 ${new Date(entry.readAt).toLocaleTimeString('zh-CN')}${entry.cached ? ' · 本地缓存' : ''}` : ' · 数据时间未知';
      row.append(meter, reset);
    } else if (entry.cached) {
      const note = document.createElement('div');
      note.className = 'reset';
      note.textContent = '本地缓存余额';
      row.append(note);
    }
    container.append(row);
  }
  const stale = quota.observedAt && Date.now() - quota.observedAt > 240000;
  document.querySelector('#quota-time').textContent = quota.observedAt ?
    `${quota.ok ? (quota.cachedAt ? '显示最近成功缓存' : 'Magpie 缓存 · 订阅额度 / API 余额') : '查询未成功'} · ${new Date(quota.observedAt).toLocaleTimeString('zh-CN')}${stale ? ' · 请刷新' : ''}。每 30 秒同步；右侧开关控制桌面徽章。` : '正在读取 Magpie 额度…';
  document.querySelector('#usage').textContent = quota.usage ? `Magpie 今日：${quota.usage.calls} 次请求 · ${quota.usage.errors} 次错误（按 Magpie 统计口径）` : '';
}

function renderSettings(value) {
  settings = value;
  for (const input of document.querySelectorAll('[data-setting]')) input.checked = value[input.dataset.setting];
  document.querySelector('#size').value = value.size;
}

function filterActions() {
  const query = document.querySelector('#search').value.trim().toLowerCase();
  const container = document.querySelector('#actions');
  container.replaceChildren();
  for (const name of catalog.names.filter(name => name.toLowerCase().includes(query))) {
    const button = document.createElement('button');
    button.textContent = name;
    button.onclick = () => api.play(name);
    container.append(button);
  }
}

document.querySelector('#refresh').onclick = async () => {
  const button = document.querySelector('#refresh');
  button.disabled = true;
  button.textContent = '查询中…';
  try { renderQuota(await api.refreshQuota()); }
  finally { button.disabled = false; button.textContent = '刷新'; }
};
document.querySelector('#open-magpie').onclick = () => api.openMagpie();
document.querySelector('#search').oninput = filterActions;
document.querySelector('#size').onchange = event => api.setting('size', Number(event.target.value));
for (const input of document.querySelectorAll('[data-setting]')) input.onchange = () => api.setting(input.dataset.setting, input.checked);
for (const button of document.querySelectorAll('[data-play]')) button.onclick = () => api.play(button.dataset.play);
api.on('activity', renderActivity);
api.on('quota', renderQuota);
api.on('settings', value => { renderSettings(value); if (lastQuota) renderQuota(lastQuota); });
api.getSnapshot().then(snapshot => {
  catalog = snapshot.catalog;
  renderActivity(snapshot.activity);
  renderSettings(snapshot.settings);
  renderQuota(snapshot.quota);
  filterActions();
});
setInterval(() => { if (lastQuota) renderQuota(lastQuota); }, 30000);
