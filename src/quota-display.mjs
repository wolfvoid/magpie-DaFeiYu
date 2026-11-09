export function accountPercentages(quota, activity, now = Date.now()) {
  const activeIds = new Set(activity?.available && now >= activity.observedAt && now - activity.observedAt < 10000 ? activity.activeAccountIds || [] : []);
  return (quota?.accounts || []).map(account => {
    if (account.kind === 'balance') {
      const readable = quota.ok && typeof account.balance === 'string' && account.readAt;
      const fresh = readable && now >= account.readAt && now - account.readAt < 600000;
      const valid = fresh || (readable && account.cached);
      return { ...account, active: activeIds.has(account.accountId),
        text: valid ? account.balance : '余额待刷新', available: Boolean(valid) };
    }
    const windows = (quota.windows || []).filter(window => window.accountId === account.accountId);
    const valid = quota.ok && windows.length > 0 && windows.every(window => {
      const readable = Number.isFinite(window.remaining) && window.readAt;
      const fresh = readable && now >= window.readAt && now - window.readAt < 600000;
      return (fresh || (readable && window.cached)) && (!window.resetsAt || window.resetsAt * 1000 > now);
    });
    return { ...account, active: activeIds.has(account.accountId),
      text: valid ? `${Math.round(Math.min(...windows.map(window => window.remaining)))}%` : '—%',
      available: Boolean(valid) };
  });
}

export function quotaEntries(quota, activity, now = Date.now()) {
  const activeIds = new Set(activity?.available && now >= activity.observedAt && now - activity.observedAt < 10000 ? activity.activeAccountIds || [] : []);
  const accounts = new Map((quota?.accounts || []).map(account => [account.accountId, account]));
  const entries = [];
  for (const window of quota?.windows || []) {
    const account = accounts.get(window.accountId);
    if (!account) continue;
    const readable = quota.ok && Number.isFinite(window.remaining) && window.readAt;
    const fresh = readable && now >= window.readAt && now - window.readAt < 600000;
    const valid = (fresh || (readable && window.cached)) && (!window.resetsAt || window.resetsAt * 1000 > now);
    entries.push({ ...window, key: window.key || `${window.accountId}|${window.label}`,
      active: activeIds.has(window.accountId), text: valid ? `${Math.round(window.remaining)}%` : '—%',
      available: Boolean(valid), kind: 'subscription' });
  }
  for (const account of (quota?.accounts || []).filter(account => account.kind === 'balance')) {
    const readable = quota.ok && typeof account.balance === 'string' && account.readAt;
    const fresh = readable && now >= account.readAt && now - account.readAt < 600000;
    const valid = fresh || (readable && account.cached);
    entries.push({ ...account, key: account.key || `${account.accountId}|balance`,
      active: activeIds.has(account.accountId), text: valid ? account.balance : '余额待刷新',
      available: Boolean(valid), kind: 'balance' });
  }
  return entries;
}

export function compactQuotaLabel(entry) {
  if (entry.kind === 'balance') return '余额';
  const aliases = {
    'Cursor Models': '模型',
    'Other Models': '其他',
    'On-demand': '按量',
    'Grok Bot': 'Grok',
    Total: '总计',
    '7 days': '7天',
    '5 hours': '5小时',
    Weekly: '本周',
    Month: '本月',
  };
  const name = entry.windowName || '';
  if (aliases[name]) return aliases[name];
  return [...name].slice(0, name.codePointAt(0) > 0x2e80 ? 5 : 7).join('') || '额度';
}
