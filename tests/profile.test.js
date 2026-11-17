import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

for (const target of ['firefox', 'chromium']) {
  function setup(saved, getPage) {
    let listener, now = 2_000_000_000, calls = 0;
    const source = name => readFileSync(new URL(`../${target}/${name}`, import.meta.url), 'utf8');
    const runtime = { id:'test', onMessage:{ addListener(fn) { listener=fn; } } };
    const storage = { local:{
      async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k=>[k,saved[k]])); },
      async set(values) { Object.assign(saved,values); }
    } };
    const context = vm.createContext({
      URLSearchParams, AbortSignal,
      Date:class extends Date { static now() { return now; } },
      setTimeout(fn) { fn(); },
      async fetch(url) {
        calls++;
        const data = await getPage(new URL(url).searchParams);
        return { ok:true, async json() { return { status:'OK', result:data }; } };
      },
      [target === 'firefox' ? 'browser' : 'chrome']:{ runtime,storage },
      importScripts(...names) { for (const name of names) vm.runInContext(source(name),context); }
    });
    if (target === 'firefox') vm.runInContext(source('core.js'),context);
    vm.runInContext(source('background.js'),context);
    return {
      saved, get calls() { return calls; }, advance(ms) { now+=ms; },
      request(message) {
        if (target === 'firefox') return listener(message,{id:'test'});
        return new Promise(resolve=>listener(message,{id:'test'},resolve));
      }
    };
  }
  const submission = (id,index='B') => ({ id, problem:{contestId:1,index}, verdict:'OK' });
  const cache = extra => ({handle:'tourist',latestId:100,offset:3000,complete:true,time:0,solved:['1A'],attempted:['1A'],...extra});

  test(`${target}: incremental sync preserves history and stops at the saved submission`,async()=>{
    const current=setup({profileCache:cache()},()=>[submission(101),submission(100,'A')]);
    const result=await current.request({type:'profile',handle:'tourist',force:true});
    assert.equal(result.ok,true);
    assert.deepEqual(Array.from(result.data.solved),['1A','1B']);
    assert.equal(result.data.offset,3001);
    assert.equal(result.data.complete,true);
    assert.equal(result.data.latestId,101);
    assert.equal(current.calls,1);
  });

  test(`${target}: sync traverses multiple pages and preserves older-history pagination`,async()=>{
    const current=setup({profileCache:cache({complete:false})},params=>params.get('from')==='1'
      ? Array.from({length:1000},(_,i)=>submission(1101-i))
      : [submission(101),submission(100,'A'),...Array.from({length:998},(_,i)=>submission(99-i))]);
    const result=await current.request({type:'profile',handle:'tourist',force:true});
    assert.equal(result.ok,true);
    assert.equal(current.calls,2);
    assert.equal(result.data.offset,4001);
    assert.equal(result.data.complete,false);
  });

  test(`${target}: automatic sync deduplicates tabs and survives background restart`,async()=>{
    const saved={profileCache:cache()};
    const current=setup(saved,()=>[submission(101),submission(100)]);
    await Promise.all([current.request({type:'profile-auto'}),current.request({type:'profile-auto'})]);
    assert.equal(current.calls,1);
    const restarted=setup(saved,()=>assert.fail('Unexpected request'));
    await restarted.request({type:'profile-auto'});
    current.advance(300001);
    await current.request({type:'profile-auto'});
    assert.equal(current.calls,2);
  });

  test(`${target}: disabled sync and disconnected handles make no requests`,async()=>{
    const current=setup({preferences:{autoSync:false},profileCache:cache()},()=>assert.fail('Unexpected request'));
    await current.request({type:'profile-auto'});
    delete current.saved.profileCache;
    current.saved.preferences.autoSync=true;
    await current.request({type:'profile-auto'});
    assert.equal(current.calls,0);
  });

  test(`${target}: failed sync preserves cache and throttles retry attempts`,async()=>{
    const original=cache();
    const current=setup({profileCache:original},()=>{throw Error('OFFLINE');});
    assert.equal((await current.request({type:'profile-auto'})).ok,false);
    await current.request({type:'profile-auto'});
    assert.equal(current.calls,1);
    assert.equal(current.saved.profileCache,original);
    current.advance(300001);
    await current.request({type:'profile-auto'});
    assert.equal(current.calls,2);
  });

  test(`${target}: disconnect during a request does not restore the handle`,async()=>{
    const saved={profileCache:cache()};
    const current=setup(saved,()=>{delete saved.profileCache;return [submission(101)];});
    assert.equal((await current.request({type:'profile-auto'})).ok,false);
    assert.equal(saved.profileCache,undefined);
  });

  test(`${target}: legacy snapshots keep previously loaded problems`,async()=>{
    const current=setup({profileCache:cache({latestId:undefined})},()=>[submission(101)]);
    const result=await current.request({type:'profile',handle:'tourist',force:true});
    assert.equal(result.ok,true);
    assert.equal(result.data.latestId,101);
    assert.ok(result.data.solved.includes('1A'));
  });

  test(`${target}: loading older history retains the latest-submission marker`,async()=>{
    const current=setup({profileCache:cache({complete:false})},params=>{
      assert.equal(params.get('from'),'3001');
      return [submission(50,'C')];
    });
    const result=await current.request({type:'profile',handle:'tourist',older:true});
    assert.equal(result.ok,true);
    assert.equal(result.data.latestId,100);
    assert.equal(result.data.offset,3001);
    assert.deepEqual(Array.from(result.data.solved),['1A','1C']);
  });

  test(`${target}: changing handle starts separate history`,async()=>{
    const current=setup({profileCache:cache()},()=>[submission(101)]);
    const result=await current.request({type:'profile',handle:'another',force:true});
    assert.equal(result.ok,true);
    assert.deepEqual(Array.from(result.data.solved),['1B']);
    assert.equal(result.data.handle,'another');
  });
}
