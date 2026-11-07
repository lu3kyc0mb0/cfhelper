import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const source = name => readFileSync(new URL(`../chromium/${name}`, import.meta.url), 'utf8');
function worker(saved = {}, fetch = async () => { throw Error('Unexpected network request'); }) {
  let listener;
  const context = vm.createContext({
    URLSearchParams, AbortSignal, setTimeout, fetch,
    chrome: {
      runtime: { id: 'cfhelper-test', onMessage: { addListener(fn) { listener = fn; } } },
      storage: { local: {
        async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, saved[k]])); },
        async set(values) { Object.assign(saved, values); }
      } }
    },
    importScripts(...names) { for (const name of names) vm.runInContext(source(name), context); }
  });
  vm.runInContext(source('background.js'), context);
  return {
    listener,
    request(message) {
      return new Promise(resolve => {
        assert.equal(listener(message, { id: 'cfhelper-test' }, resolve), true);
      });
    }
  };
}

test('catalogue messaging fetches, persists and survives a worker restart', async () => {
  const saved = {};
  let calls = 0;
  const first = worker(saved, async (url, options) => {
    calls++;
    assert.equal(url, 'https://codeforces.com/api/problemset.problems');
    assert.equal(options.credentials, 'omit');
    return { ok: true, async json() { return { status: 'OK', result: {
      problems: [{ contestId: 1, index: 'A', name: 'Theatre Square', rating: 1000, tags: ['math'] }],
      problemStatistics: [{ contestId: 1, index: 'A', solvedCount: 100 }]
    } }; } };
  });
  const result = await first.request({ type: 'catalogue' });
  assert.equal(result.ok, true);
  assert.equal(result.data.problems[0].solved, 100);
  assert.equal(saved.catalogueCache.problems[0].id, '1A');
  const restarted = await worker(saved).request({ type: 'catalogue' });
  assert.equal(restarted.data.cached, true);
  assert.equal(calls, 1);
});

test('profile worker imports the core and summarizes submissions', async () => {
  const result = await worker({}, async () => ({ ok: true, async json() {
    return { status: 'OK', result: [
      { problem: { contestId: 1, index: 'A' }, verdict: 'OK' },
      { problem: { contestId: 2, index: 'B' }, verdict: 'WRONG_ANSWER' }
    ] };
  } })).request({ type: 'profile', handle: 'tourist' });
  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(result.data.solved), ['1A']);
  assert.deepEqual(Array.from(result.data.attempted), ['1A', '2B']);
  assert.equal(result.data.complete, true);
});

test('API failure returns an error, or stale data if available', async () => {
  const offline = async () => { throw Error('OFFLINE'); };
  const failure = await worker({}, offline).request({ type: 'catalogue' });
  assert.equal(failure.ok, false);
  assert.equal(failure.error, 'OFFLINE');
  const stale = await worker({ catalogueCache: { time: 0, problems: [] } }, offline).request({ type: 'catalogue' });
  assert.equal(stale.ok, true);
  assert.equal(stale.data.stale, true);
});

test('unknown messages and foreign senders are ignored; invalid handles are rejected', async () => {
  const current = worker();
  const unexpectedResponse = () => assert.fail('Unexpected response');
  assert.equal(current.listener({ type: 'unknown' }, { id: 'cfhelper-test' }, unexpectedResponse), undefined);
  assert.equal(current.listener({ type: 'catalogue' }, { id: 'foreign' }, unexpectedResponse), undefined);
  const response = await current.request({ type: 'profile', handle: '../invalid' });
  assert.equal(response.ok, false);
  assert.equal(response.error, 'INVALID_HANDLE');
});

test('both packages include every manifest and HTML entry point', () => {
  for (const browser of ['firefox', 'chromium']) {
    const base = new URL(`../${browser}/`, import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', base)));
    const paths = [
      ...Object.values(manifest.icons), manifest.action.default_popup,
      manifest.action.default_icon, manifest.options_ui.page,
      ...(manifest.background.scripts ?? [manifest.background.service_worker]),
      ...manifest.content_scripts.flatMap(s => [...s.js, ...s.css]),
      ...manifest.web_accessible_resources.flatMap(s => s.resources)
    ];
    for (const html of readdirSync(base).filter(f => f.endsWith('.html'))) {
      for (const match of readFileSync(new URL(html, base), 'utf8').matchAll(/(?:src|href)="([^"]+)"/g)) paths.push(match[1]);
    }
    for (const path of paths) assert.ok(existsSync(new URL(path, base)), `${browser}/${path} missing`);
  }
});
