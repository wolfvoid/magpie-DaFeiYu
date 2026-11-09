import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ActivityReader, chooseActivity, normalizeCards, readQuota, readLocal, activeAccountsForRoute } from '../src/magpie.mjs';
import { accountPercentages, compactQuotaLabel, quotaEntries } from '../src/quota-display.mjs';
import { clampPetPosition } from '../src/position.cjs';
import { AnimationDirector } from '../src/animation.mjs';
import { mergeCachedQuota } from '../src/magpie.cjs';

const now = 1800000000000;
const catalog = JSON.parse(readFileSync(new URL('../assets/catalog.json', import.meta.url)));
const concurrency = { object: 'concurrency', requests: 0, waiting: 0, tools: 0 };
const cards = { data: [{ name: 'Provider', plan: 'plus', user: 'PRIVATE', readAt: new Date(now).toISOString(),
  windows: [{ name: '7 days', used: 25, resetsAt: new Date(now + 60000).toISOString() }] }] };

test('API balances retain currency and coexist with subscription percentages', () => {
  const quota = normalizeCards({ data: [...cards.data,
    { provider: 'deepseek', kind: 'balance', balance: '¥12.34', readAt: new Date(now).toISOString(), windows: [] },
    { provider: 'other', kind: 'balance', balance: '$0.00', readAt: new Date(now).toISOString(), windows: [{ used: 20 }] },
  ] }, now);
  assert.equal(quota.ok, true);
  assert.equal(quota.windows.length, 1);
  const activity = { available: true, observedAt: now, activeAccountIds: [quota.accounts[1].accountId] };
  const badges = accountPercentages(quota, activity, now);
  assert.deepEqual(badges.map(badge => badge.text), ['75%', '¥12.34', '$0.00']);
  assert.equal(badges[1].active, true);
  assert.equal(accountPercentages(quota, activity, now + 600001)[1].text, '余额待刷新');
});

test('balance-only accounts work and invalid or undated balances never become percentages', () => {
  for (const balance of ['¥0.00', 'USD 4.25', '¥-0.01']) {
    const quota = normalizeCards({ data: [{ kind: 'balance', balance, readAt: new Date(now).toISOString() }] }, now);
    assert.equal(quota.ok, true);
    assert.equal(accountPercentages(quota, null, now)[0].text, balance);
  }
  for (const balance of [null, 12, 'PRIVATE sk-secret', '', 'NaN']) {
    const quota = normalizeCards({ data: [{ kind: 'balance', balance, readAt: new Date(now).toISOString() }] }, now);
    assert.equal(quota.ok, false);
    assert.equal(accountPercentages(quota, null, now)[0].text, '余额待刷新');
    assert.ok(!JSON.stringify(quota).includes('sk-secret'));
  }
  const undated = normalizeCards({ data: [{ kind: 'balance', balance: '¥5.00' }] }, now);
  assert.equal(accountPercentages(undated, null, now)[0].available, false);
});

test('Magpie distinguishes active requests, queues and client tools', () => {
  assert.equal(chooseActivity({ ...concurrency, requests: 2, waiting: 1 }).state, 'thinking');
  assert.equal(chooseActivity({ ...concurrency, requests: 1, waiting: 1 }).state, 'waiting');
  assert.equal(chooseActivity({ ...concurrency, tools: 1 }).state, 'working');
  assert.equal(chooseActivity(concurrency).state, 'idle');
  assert.notEqual(chooseActivity(concurrency).state, 'success');
});

test('malformed cards are isolated and future-dated balances are not fresh', () => {
  const quota = normalizeCards({ data: [null, 'invalid', ...cards.data,
    { kind: 'balance', balance: '¥1.00', readAt: new Date(now + 10000).toISOString() },
    { windows: [null] },
  ] }, now);
  assert.equal(quota.ok, true);
  const badges = accountPercentages(quota, { available: true, observedAt: now + 1,
    activeAccountIds: [quota.accounts[0].accountId] }, now);
  assert.equal(badges[0].text, '75%');
  assert.equal(badges[0].active, false);
  assert.equal(badges[1].text, '余额待刷新');
});

test('missing and incompatible Magpie states are unknown, not idle', () => {
  for (const value of [{}, null, { ...concurrency, requests: null }, { ...concurrency, requests: -1 }]) {
    assert.equal(chooseActivity(value).available, false);
  }
});

test('quota uses actual windows, excludes identities and marks stale data', () => {
  const result = normalizeCards(cards, now);
  assert.equal(result.windows[0].remaining, 75);
  assert.equal(result.windows[0].stale, false);
  assert.equal(result.windows[0].resetsAt, (now + 60000) / 1000);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.equal(normalizeCards(cards, now + 700000).windows[0].stale, true);
  assert.equal(normalizeCards({ data: [{ windows: [{ used: null }] }] }).ok, false);
  assert.equal(normalizeCards({}).ok, false);
});

test('integration uses loopback GETs and returns sanitized snapshots', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return Response.json(url.endsWith('/concurrency') ? { ...concurrency, active: [{ session: 'PRIVATE' }] } :
      url.endsWith('/cards') ? cards : { calls: 15, errors: 2, sessions: ['PRIVATE'] });
  };
  const quota = await readQuota({ fetcher });
  const activity = await new ActivityReader({ fetcher }).read();
  assert.equal(quota.ok, true);
  assert.deepEqual(quota.usage, { calls: 15, errors: 2 });
  assert.equal(JSON.stringify({ quota, activity }).includes('PRIVATE'), false);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.ok(call.url.startsWith('http://127.0.0.1:'));
    assert.equal(call.options.method, 'GET');
    assert.equal(call.options.redirect, 'error');
    assert.equal(call.options.headers.Authorization, undefined);
  }
});

test('offline clears state; usage failure does not hide valid quota', async () => {
  const fetcher = async () => { throw new Error('offline'); };
  assert.equal((await new ActivityReader({ fetcher }).read()).available, false);
  assert.deepEqual((await readQuota({ fetcher })).windows, []);
  const partial = await readQuota({ fetcher: async url => {
    if (url.endsWith('/cards')) return Response.json(cards);
    throw new Error('usage unavailable');
  } });
  assert.equal(partial.ok, true);
  assert.equal(partial.usage, undefined);
});

test('quota failures preserve the last usable account values', () => {
  const previous = { ok: true, accounts: [
    { accountId: 'first', kind: 'subscription' },
    { accountId: 'second', kind: 'balance', balance: '¥12.34', readAt: now },
  ], windows: [{ accountId: 'first', remaining: 72, readAt: now, resetsAt: now / 1000 + 60 }], observedAt: now };
  const fallback = { ok: false, accounts: [], windows: [], observedAt: now + 31000, error: 'offline' };
  const cached = mergeCachedQuota(previous, fallback);
  assert.deepEqual(accountPercentages(cached, { available: true, observedAt: now + 31000 }, now + 31000)
    .map(badge => [badge.text, badge.available]), [['72%', true], ['¥12.34', true]]);
  assert.equal(cached.error, 'offline');
  assert.equal(cached.observedAt, fallback.observedAt);
  assert.equal(mergeCachedQuota(null, fallback), fallback);
});

test('each quota window has an independent display key, icon metadata and cached value', () => {
  const quota = normalizeCards({ data: [
    { provider: 'cursor', name: 'Cursor', icon: 'cursor', plan: 'Team', readAt: new Date(now).toISOString(),
      windows: [
        { name: 'Models', used: 25, resetsAt: new Date(now + 3600000).toISOString() },
        { name: 'Other', used: 60, resetsAt: new Date(now + 3600000).toISOString() },
      ] },
    { provider: 'deepseek', name: 'DeepSeek', icon: 'deepseek-color', kind: 'balance',
      balance: '¥12.34', readAt: new Date(now).toISOString(), windows: [] },
  ] }, now);
  const entries = quotaEntries(quota, null, now);
  assert.equal(entries.length, 3);
  assert.equal(new Set(entries.map(entry => entry.key)).size, 3);
  assert.deepEqual(entries.map(entry => entry.text), ['75%', '40%', '¥12.34']);
  assert.deepEqual(entries.map(entry => entry.icon), ['cursor', 'cursor', 'deepseek-color']);
  assert.ok(entries[0].key.includes('Cursor|Team|1|window|0|Models'));

  const cached = mergeCachedQuota(quota, { ok: false, accounts: [], windows: [],
    observedAt: now + 700000, error: 'offline' });
  assert.deepEqual(quotaEntries(cached, null, now + 700000).map(entry => entry.text), ['75%', '40%', '¥12.34']);
});

test('expired reset windows stop showing a cached percentage', () => {
  const quota = normalizeCards({ data: [{
    provider: 'cursor', name: 'Cursor', plan: 'Team', readAt: new Date(now).toISOString(),
    windows: [{ name: 'Models', used: 25, resetsAt: new Date(now + 60000).toISOString() }],
  }] }, now);
  const cached = mergeCachedQuota(quota, { ok: false, accounts: [], windows: [], observedAt: now + 700000 });
  assert.equal(quotaEntries(cached, null, now + 700000)[0].text, '—%');
});

test('desktop badges use short recognizable quota labels', () => {
  assert.equal(compactQuotaLabel({ kind: 'subscription', windowName: 'Cursor Models' }), '模型');
  assert.equal(compactQuotaLabel({ kind: 'subscription', windowName: 'Other Models' }), '其他');
  assert.equal(compactQuotaLabel({ kind: 'subscription', windowName: '7 days' }), '7天');
  assert.equal(compactQuotaLabel({ kind: 'subscription', windowName: 'Weekly' }), '本周');
  assert.equal(compactQuotaLabel({ kind: 'balance' }), '余额');
});

test('HTTP errors, malformed JSON, timeout and oversized responses reject', async () => {
  await assert.rejects(readLocal('/test', { fetcher: async () => new Response('', { status: 403 }) }));
  await assert.rejects(readLocal('/test', { fetcher: async () => new Response('invalid') }));
  await assert.rejects(readLocal('/test', { fetcher: async () => new Response('x'.repeat(2000001)) }));
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(readLocal('/test', { timeoutMs: 10, fetcher: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    }) }));
  } finally { clearTimeout(keepAlive); }
});

test('both screen edges allow clipping but retain a center grab margin', () => {
  const dimensions = { width: 460, height: 371 };
  for (const area of [{ x: 0, y: 25, width: 1440, height: 875 }, { x: -1920, y: -100, width: 1920, height: 1080 }]) {
    const right = clampPetPosition({ x: area.x + area.width + 500, y: 40 }, area, dimensions);
    const left = clampPetPosition({ x: area.x - 1000, y: -2000 }, area, dimensions);
    assert.equal(right.x + dimensions.width / 2, area.x + area.width - 36);
    assert.ok(right.x + dimensions.width > area.x + area.width);
    assert.equal(left.x + dimensions.width / 2, area.x + 36);
    assert.equal(left.y, area.y);
    assert.deepEqual(clampPetPosition(right, area, dimensions), right);
  }
});

test('saved offscreen position and large size on tiny display stay recoverable', () => {
  const result = clampPetPosition({ x: 9000, y: 9000 }, { x: 0, y: 0, width: 300, height: 200 }, { width: 560, height: 427 });
  assert.equal(result.y, 0);
  assert.equal(result.x + 280, 264);
});

test('manual effects finish before returning to current request state', () => {
  const director = new AnimationDirector(catalog);
  director.select('凭空生花', true);
  assert.equal(director.update({ state: 'thinking' }), null);
  assert.ok(catalog.states.thinking.includes(director.next()));
});

test('animation IDs constrained; paused animation stays idle', () => {
  const director = new AnimationDirector(catalog, () => 0);
  assert.equal(director.select('../arbitrary'), null);
  director.paused = true;
  assert.equal(director.next(), catalog.idle[0]);
});

function seededRandom() {
  let seed = 14327;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test('idle playlists avoid the last 15 programs and consecutive breathing clips', () => {
  const director = new AnimationDirector(catalog, seededRandom());
  const programs = [];
  let idleCount = 0;
  let previous;
  for (let index = 0; index < 2000; index++) {
    const name = director.next();
    assert.ok(catalog.names.includes(name));
    if (catalog.idle.includes(name)) {
      idleCount++;
      assert.notEqual(name, previous);
    } else {
      assert.ok(!programs.slice(-15).includes(name), `repeated program: ${name}`);
      programs.push(name);
    }
    previous = name;
  }
  assert.ok(idleCount / 2000 > 0.10 && idleCount / 2000 < 0.18);
  assert.ok(new Set(programs).size > 70);
});

test('working playlists interleave a diverse small action every two status clips', () => {
  for (const state of ['thinking', 'working']) {
    const director = new AnimationDirector(catalog, seededRandom());
    director.activity = { state };
    const programs = [];
    for (let index = 0; index < 90; index++) {
      const name = director.next();
      if (index % 3 === 2) {
        assert.ok(director.lightActions.includes(name));
        assert.ok(!programs.slice(-15).includes(name));
        programs.push(name);
      } else assert.ok(catalog.states[state].includes(name));
    }
    assert.ok(new Set(programs).size >= 16);
  }
});

test('rapid Magpie changes update state without interrupting the current program', () => {
  const director = new AnimationDirector(catalog, seededRandom());
  director.select('凭空生花', false, true);
  for (const state of ['thinking', 'idle', 'working', 'waiting']) {
    assert.equal(director.update({ state }), null);
    assert.equal(director.current, '凭空生花');
    assert.equal(director.activity.state, state);
  }
  assert.ok(catalog.states.waiting.includes(director.next()));
  director.select('放烟花', true);
  assert.equal(director.current, '放烟花');
});

test('random-play off disables extras, and state animation pools stay relevant', () => {
  const director = new AnimationDirector(catalog, seededRandom());
  director.active = false;
  for (let index = 0; index < 10; index++) assert.ok(catalog.idle.includes(director.next()));
  director.activity = { state: 'thinking' };
  for (let index = 0; index < 10; index++) assert.ok(catalog.states.thinking.includes(director.next()));
  director.active = true;
  director.activity = { state: 'waiting' };
  for (let index = 0; index < 10; index++) assert.ok(catalog.states.waiting.includes(director.next()));
});

test('account matching distinguishes seats on one provider and excludes finished tries', () => {
  const quotas = normalizeCards({ data: [
    { provider: 'vendor', user: 'first@example.com', windows: [] },
    { provider: 'vendor', user: 'second@example.com', windows: [] },
  ] });
  const route = { done: false, order: [
    { id: 'default', provider: 'vendor', who: 'first@example.com' },
    { id: 'other', provider: 'vendor', who: 'second@example.com' },
  ], tries: [{ id: 'default', done: true }, { id: 'other', done: false }] };
  assert.deepEqual(activeAccountsForRoute(route), [quotas.accounts[1].accountId]);
  assert.deepEqual(activeAccountsForRoute({ ...route, done: true }), []);
  assert.deepEqual(activeAccountsForRoute({ ...route, order: [] }), []);
  assert.ok(!JSON.stringify(quotas).includes('@'));
});

test('incremental trace follows active requests, clears completed accounts and recovers after failure', async () => {
  const quota = normalizeCards({ data: [{ provider: 'vendor', user: 'private', windows: [] }] });
  let sample = 0;
  let fail = false;
  const reader = new ActivityReader({ fetcher: async url => {
    if (url.endsWith('/concurrency')) return Response.json({ ...concurrency, requests: sample === 3 ? 0 : 1,
      active: sample === 3 ? [] : [{ phase: sample === 4 ? 'slot' : 'upstream', route: 42 }] });
    if (fail) throw new Error('trace unavailable');
    return Response.json({ object: 'trace', seq: 2, ids: [42], routes: sample === 1 ? [] : [
      { id: 42, done: false, order: [{ id: 'seat', provider: 'vendor', who: 'private' }], tries: [{ id: 'seat', done: false }] },
    ] });
  } });
  assert.deepEqual((await reader.read()).activeAccountIds, [quota.accounts[0].accountId]);
  sample = 1;
  assert.equal((await reader.read()).activeAccountIds.length, 1);
  fail = true;
  assert.equal((await reader.read()).activeAccountIds.length, 0);
  assert.equal(reader.traceSequence, 0);
  fail = false;
  sample = 0;
  assert.equal((await reader.read()).activeAccountIds.length, 1);
  sample = 3;
  assert.equal((await reader.read()).activeAccountIds.length, 0);
  sample = 4;
  assert.equal((await reader.read()).activeAccountIds.length, 0);
});

test('one percentage per account uses minimum window and red requires fresh activity', () => {
  const quota = { ok: true, accounts: [{ accountId: 'first' }, { accountId: 'second' }], windows: [
    { accountId: 'first', remaining: 80, readAt: now, resetsAt: now / 1000 + 30 },
    { accountId: 'first', remaining: 45, readAt: now },
    { accountId: 'second', remaining: 12, readAt: now },
  ] };
  const activity = { available: true, observedAt: now, activeAccountIds: ['second'] };
  const badges = accountPercentages(quota, activity, now);
  assert.deepEqual(badges.map(badge => badge.text), ['45%', '12%']);
  assert.deepEqual(badges.map(badge => badge.active), [false, true]);
  assert.equal(accountPercentages(quota, activity, now + 11000)[1].active, false);
  assert.equal(accountPercentages(quota, activity, now + 31000)[0].text, '—%');
  assert.ok(accountPercentages(quota, activity, now + 610000).every(badge => badge.text === '—%'));
  assert.ok(accountPercentages(quota, { ...activity, available: false }, now).every(badge => !badge.active));
});
