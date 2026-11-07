import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const executable = process.env.EDGE_BINARY || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const extension = fileURLToPath(new URL('../chromium', import.meta.url));
const profile = mkdtempSync(join(tmpdir(), 'cfhelper-edge-'));
const edge = spawn(executable, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${profile}`, '--remote-debugging-port=0',
  `--disable-extensions-except=${extension}`, `--load-extension=${extension}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
let launchError;
edge.on('error', error => { launchError = error; });
try {
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    try {
      const [port, path] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').trim().split(/\r?\n/);
      endpoint = `ws://127.0.0.1:${port}${path}`;
      break;
    } catch { await delay(200); }
  }
  assert.ok(endpoint, 'Edge did not open a debugging endpoint');
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let serial = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  function cdp(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timed out: ${method}`)); }, 10000);
      pending.set(id, message => {
        clearTimeout(timer);
        if (message.error) reject(Error(message.error.message)); else resolve(message.result);
      });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  let worker;
  for (let attempt = 0; attempt < 50; attempt++) {
    const { targetInfos } = await cdp('Target.getTargets');
    worker = targetInfos.find(t => t.type === 'service_worker' && t.url.startsWith('chrome-extension://') && t.url.endsWith('/background.js'));
    if (worker) break;
    await delay(200);
  }
  assert.ok(worker, 'Chromium extension service worker did not load');
  const base = new URL('.', worker.url).href;
  const { targetId } = await cdp('Target.createTarget', { url: `${base}popup.html` });
  const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
  let result;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      result = await cdp('Runtime.evaluate', { expression: 'document.querySelector(".cfh-settings-title")?.textContent', returnByValue: true }, sessionId);
      if (result.result.value) break;
    } catch (error) {
      if (!/execution context/i.test(error.message)) throw error;
    }
    await delay(100);
  }
  if (!result?.result.value) {
    const diagnostic = await cdp('Runtime.evaluate', { expression: 'JSON.stringify({url:location.href,body:document.body?.innerText})', returnByValue: true }, sessionId);
    throw Error(`Popup settings did not render: ${diagnostic.result.value}`);
  }
  const evaluation = await cdp('Runtime.evaluate', {
    expression: `(async () => {
      await chrome.storage.local.set({catalogueCache:{time:Date.now(),problems:[{id:'1A'}]}});
      const cache = await chrome.runtime.sendMessage({type:'catalogue'});
      const invalid = await chrome.runtime.sendMessage({type:'profile',handle:'../invalid'});
      return {cached:cache.ok && cache.data.cached && cache.data.problems[0].id==='1A', invalid:invalid.error};
    })()`, awaitPromise: true, returnByValue: true
  }, sessionId);
  assert.equal(evaluation.exceptionDetails, undefined);
  assert.deepEqual(evaluation.result.value, { cached: true, invalid: 'INVALID_HANDLE' });
  console.log('Edge smoke test passed: service worker, popup rendering, storage and asynchronous messages.');
  await cdp('Browser.close');
} finally {
  socket?.close();
  edge.kill();
  console.log(`Isolated test profile: ${profile}`);
}
