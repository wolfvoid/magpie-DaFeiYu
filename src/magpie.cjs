function mergeCachedQuota(previous, fallback) {
  if (!previous || !previous.ok) return fallback;
  return {
    ...previous,
    accounts: previous.accounts.map(account => ({
      ...account,
      cached: true,
      ...(account.kind === 'balance' ? { balance: account.balance ?? fallback.accounts?.find(item => item.accountId === account.accountId)?.balance ?? null } : {}),
    })),
    windows: previous.windows.map(window => ({ ...window, cached: true })),
    usage: fallback.usage ?? previous.usage,
    cachedAt: previous.observedAt,
    observedAt: fallback.observedAt,
    error: fallback.error,
  };
}

module.exports = { mergeCachedQuota };
