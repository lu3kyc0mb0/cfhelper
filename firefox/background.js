const API_GAP = 2500, CACHE_TTL = 6 * 60 * 60 * 1000;
let queue = Promise.resolve();
const pending = new Map();
let profileRequest = '';
function once(key, task) {
  if (pending.has(key)) return pending.get(key);
  const promise = task().finally(() => pending.delete(key));
  pending.set(key, promise); return promise;
}
function api(method, params = {}) {
  const run = queue.then(async () => {
    const stored = await browser.storage.local.get(['apiLastAttempt', 'apiBackoffUntil']);
    if (Date.now() < (stored.apiBackoffUntil || 0)) throw new Error('API_COOLDOWN');
    const delay = Math.max(0, API_GAP - (Date.now() - (stored.apiLastAttempt || 0)));
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    await browser.storage.local.set({ apiLastAttempt: Date.now() });
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`https://codeforces.com/api/${method}${query ? '?' + query : ''}`, {
      method: 'GET', credentials: 'omit', signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) {
      if ([403, 429, 503].includes(response.status)) {
        const retry = Number(response.headers?.get('Retry-After'));
        const wait = Number.isFinite(retry) ? Math.max(60, Math.min(retry, 3600)) : 60;
        await browser.storage.local.set({ apiBackoffUntil: Date.now() + wait * 1000 });
      }
      throw new Error(`HTTP_${response.status}`);
    }
    const data = await response.json();
    if (data.status !== 'OK') {
      if (/limit/i.test(data.comment || '')) await browser.storage.local.set({ apiBackoffUntil: Date.now() + 60000 });
      throw new Error('API_FAILED');
    }
    return data.result;
  });
  queue = run.catch(() => {}); return run;
}
function catalogue(force) {
  return once('catalogue', async () => {
    const { catalogueCache: cache } = await browser.storage.local.get('catalogueCache');
    if (cache && !force && Date.now() - cache.time < CACHE_TTL) return { ...cache, cached: true };
    try {
      const data = await api('problemset.problems');
      if (!Array.isArray(data?.problems) || !Array.isArray(data?.problemStatistics)) throw new Error('INVALID_RESPONSE');
      const stats = new Map(data.problemStatistics.map(p => [`${p.contestId}${p.index}`, p.solvedCount]));
      const problems = data.problems.filter(p => Number.isInteger(p.contestId) && /^[A-Za-z0-9]+$/.test(p.index)).map(p => ({
        id: `${p.contestId}${p.index}`, contestId: p.contestId, index: p.index,
        name: String(p.name), rating: p.rating ?? null, tags: Array.isArray(p.tags) ? p.tags : [], solved: stats.get(`${p.contestId}${p.index}`) ?? 0
      }));
      const result = { time: Date.now(), problems };
      await browser.storage.local.set({ catalogueCache: result }); return result;
    } catch (error) {
      if (cache) return { ...cache, stale: true, warning: error.message };
      throw error;
    }
  });
}
function profile(handle, older, force) {
  if (typeof handle !== 'string' || !/^[A-Za-z0-9_.-]{1,24}$/.test(handle)) return Promise.reject(new Error('INVALID_HANDLE'));
  const requestKey = JSON.stringify([handle.toLowerCase(),older,force]);
  if (pending.has('profile') && requestKey !== profileRequest) return Promise.reject(new Error('PROFILE_BUSY'));
  profileRequest = requestKey;
  return once('profile', async () => {
    const { profileCache: saved } = await browser.storage.local.get('profileCache');
    const cache = saved?.handle.toLowerCase() === handle.toLowerCase() ? saved : null;
    if (older && !cache) throw new Error('SYNC_FIRST');
    if (older && cache.complete) return cache;
    if (!older && !force && cache && Date.now() - cache.time < 15 * 60 * 1000) return cache;
    const from = older ? cache.offset + 1 : 1;
    const data = await api('user.status', { handle, from: String(from), count: '1000' });
    if (!Array.isArray(data)) throw new Error('INVALID_RESPONSE');
    const summary = globalThis.CFHelper.summarizeSubmissions(data, older ? cache : null);
    const result = { ...summary, handle, offset: from - 1 + data.length, complete: data.length < 1000, time: Date.now() };
    await browser.storage.local.set({ profileCache: result }); return result;
  });
}
browser.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== browser.runtime.id) return;
  let task;
  if (message?.type === 'catalogue') task = catalogue(message.force === true);
  else if (message?.type === 'profile') task = profile(message.handle, message.older === true, message.force === true);
  else return;
  return task.then(data => ({ ok: true, data }), error => ({ ok: false, error: error.message }));
});
