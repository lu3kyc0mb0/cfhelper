globalThis.CFSettings = (container, initial, callbacks = {}) => {
  const {el,select,download,cleanPrefs} = globalThis.CFUI;
  let prefs=cleanPrefs(initial), history=null, busy=false, message='', failed=false;
  const t=(key,values)=>globalThis.CFText.t(prefs.language,key,values);
  function notice(key,error=false) { message=key; failed=error; const node=container.querySelector('[data-role=settings-status]'); if(node) {node.textContent=t(key);node.classList.toggle('error',error);} }
  async function change(delta, redraw=false) {
    prefs=cleanPrefs({...prefs,...delta});
    globalThis.CFUI.applyLayout(prefs); callbacks.onPreferences?.(prefs);
    if(redraw) render();
    try {
      await browser.storage.local.set({preferences:prefs});
    } catch { notice('saveError',true); }
  }
  const button=(key,fn,attrs={})=>el('button',{type:'button',...attrs,onclick:fn},t(key));
  function coverage() {
    if(!history) return t('profileEmpty');
    return t('profileFor',{handle:history.handle})+' · '+t(history.complete?'complete':'partial',{count:history.offset,date:new Date(history.time).toLocaleString(prefs.language)});
  }
  async function loadHistory(older) {
    if(busy) return;
    const handle=container.querySelector('[data-role=handle]').value.trim();
    if(!/^[A-Za-z0-9_.-]{1,24}$/.test(handle)) { notice('invalidHandle',true); return; }
    if(older && handle.toLowerCase()!==history?.handle.toLowerCase()) { notice('profileError',true); return; }
    busy=true; message='profileLoading'; render(handle);
    try {
      const response=await browser.runtime.sendMessage({type:'profile',handle,older,force:!older});
      if(!response?.ok) throw Error();
      history=response.data; message='saved'; failed=false; callbacks.onHistory?.(history);
    } catch {message='profileError';failed=true;}
    finally {busy=false; render(handle);}
  }
  async function exportProblems(bookmarks) {
    try {
      const saved=await browser.storage.local.get(['catalogueCache','favorites','filters','profileCache']);
      const filters=globalThis.CFHelper.cleanFilters(saved.filters);
      const problems=bookmarks ? (saved.catalogueCache?.problems || []).filter(p=>(saved.favorites || []).includes(p.id)) : callbacks.getResults ? callbacks.getResults() : globalThis.CFHelper.filterProblems(saved.catalogueCache?.problems || [],filters,saved.favorites || [],saved.profileCache);
      if(!problems?.length) {notice('noExport',true);return;}
      download(bookmarks?'cfhelper-bookmarks.txt':'cfhelper-problems.txt',globalThis.CFHelper.exportList(problems,callbacks.getFilters?.() || filters,prefs.language)); notice('exported');
    } catch {notice('error',true);}
  }
  function render(handleDraft) {
    container.replaceChildren(); container.classList.add('cfh-settings'); container.lang=prefs.language;
    const field=(key,control)=>el('label',{},el('span',{},t(key)),control);
    const title=el('div',{class:'cfh-settings-title'},el('img',{src:browser.runtime.getURL('cfhelper.jpg'),alt:'Codeforces Helper',width:82,height:82}),el('div',{},el('h2',{},t('settingsTitle')),el('p',{class:'cfh-hint'},t('version'))));
    if(callbacks.onClose) title.append(button('close',callbacks.onClose,{class:'cfh-close'}));
    const general=el('div',{class:'cfh-grid'},
      field('language',select([['en','English'],['ru','Русский']],prefs.language,{'data-role':'language',onchange:e=>change({language:e.target.value},true)})),
      field('pageSize',select([25,50,100].map(n=>[String(n),String(n)]),String(prefs.pageSize),{'data-role':'page-size',onchange:e=>change({pageSize:Number(e.target.value)})})));
    const compact=el('label',{class:'cfh-check'},el('input',{type:'checkbox',checked:prefs.compact,onchange:e=>change({compact:e.target.checked})}),t('compact'));
    const handle=el('input',{type:'text',value:handleDraft ?? history?.handle ?? '',maxLength:24,placeholder:'tourist','data-role':'handle',disabled:busy});
    const profileTools=el('div',{class:'cfh-actions'},field('handle',handle),button('sync',()=>loadHistory(false),{disabled:busy}),button('older',()=>loadHistory(true),{disabled:busy || !history || history.complete}),button('disconnect',async()=>{
      try {await browser.storage.local.remove('profileCache');history=null;callbacks.onHistory?.(null);message='historyCleared';failed=false;render();}catch{notice('saveError',true);}
    },{disabled:busy || !history}));
    const dataTools=el('div',{class:'cfh-actions'},button('exportResults',()=>exportProblems(false)),button('exportBookmarks',()=>exportProblems(true)));
    container.append(title,general,compact,el('h3',{},t('profile')),profileTools,el('p',{class:'cfh-hint'},t('historyHint')),el('p',{'data-role':'coverage',class:'cfh-hint'},coverage()),el('h3',{},t('data')),dataTools,el('p',{class:'cfh-hint'},t('exportHint')),el('p',{class:'cfh-hint'},t('privacy')),el('p',{class:'cfh-hint'},t('sourceNote')),el('p',{'data-role':'settings-status',role:'status',class:failed?'cfh-status error':'cfh-status'},message?t(message):''));
  }
  render();
  browser.storage.local.get('profileCache').then(saved=>{history=saved.profileCache || null;render();}).catch(()=>notice('readError',true));
  return { update(next){prefs=cleanPrefs(next);render();}, history(next){history=next;render();} };
};
