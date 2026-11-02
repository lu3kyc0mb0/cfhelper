(() => {
  if (!/^\/problemset(?:\/page\/\d+)?\/?$/.test(location.pathname) || document.getElementById('cf-helper')) return;
  const table=document.querySelector('#pageContent table.problems');
  if(!table)return;
  const {defaults,cleanFilters,filterProblems,problemUrl,tagStats}=globalThis.CFHelper;
  const {el,select,cleanPrefs,applyLayout}=globalThis.CFUI;
  const host=el('section',{id:'cf-helper'}),anchor=table.closest('.datatable') || table;
  anchor.before(host);
  const pager=el('nav',{class:'cfh-pages',hidden:true}); anchor.after(pager);
  const originals=[...table.childNodes];
  const nativePagination=[...document.querySelectorAll('#pageContent .pagination')].map(node=>({node,hidden:node.hidden}));
  const nativeClasses=new Map();
  for(const row of table.rows) {const link=row.querySelector('a[href*="/problemset/problem/"]');const match=link?.getAttribute('href').match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/);if(match)nativeClasses.set(match[1]+match[2],row.className);}
  let prefs=cleanPrefs(),filters=structuredClone(defaults),favorites=[],presets=[],history=null,problems=[],results=[];
  let page=1,ready=false,active=false,wanted=false,loading=false,filterOpen=false,statsOpen=false,initialized=false;
  let snapshot=0,stale=false,statusKey='',statusError=false,search='';
  let writes=Promise.resolve();
  const t=(key,values)=>globalThis.CFText.t(prefs.language,key,values);
  const $=role=>host.querySelector(`[data-role="${role}"]`);
  const button=(key,fn,attrs={})=>el('button',{type:'button',...attrs,onclick:fn},t(key));
  function status(key='',error=false){statusKey=key;statusError=error;if($('status')){$('status').textContent=key?t(key):'';$('status').hidden=!key;$('status').classList.toggle('error',error);}}
  function save(data){writes=writes.then(()=>browser.storage.local.set(data)).catch(()=>status('saveError',true));}
  function field(key,input){return el('label',{},el('span',{},t(key)),input);}
  function control(name,placeholder='',type='text'){
    return el('input',{name,type,value:filters[name],placeholder,...(type==='number'?{min:name.startsWith('contest')?'1':'0',step:name.startsWith('rating')?'100':'1'}:{})});
  }
  function range(key,label){const min=control(key+'Min',t('min'),'number'),max=control(key+'Max',t('max'),'number');min.setAttribute('aria-label',t(label)+' '+t('min'));max.setAttribute('aria-label',t(label)+' '+t('max'));return field(label,el('span',{class:'cfh-range'},min,'—',max));}
  function check(name,key){return el('label',{class:'cfh-check'},el('input',{type:'checkbox',name,checked:filters[name]}),t(key));}
  function syncControls(){for(const c of host.querySelectorAll('[name]'))if(c.name in filters){if(c.type==='checkbox')c.checked=filters[c.name];else c.value=filters[c.name];}}
  function validate(){
    if(!$('form').checkValidity())return 'numberError';
    for(const p of ['rating','solved','contest'])if(filters[p+'Min']!=='' && filters[p+'Max']!=='' && +filters[p+'Min']>+filters[p+'Max'])return 'rangeError';
    if(filters.unrated==='only' && (filters.ratingMin!=='' || filters.ratingMax!==''))return 'unratedError';
    if(filters.accepted!=='all' && !history)return 'profileNeeded';
    return '';
  }
  function renderTags(){
    const node=$('tags');if(!node)return;node.replaceChildren();
    for(const tag of [...new Set([...problems.flatMap(p=>p.tags),...filters.tags,...filters.excluded])].sort().filter(tag=>tag.toLowerCase().includes(search.toLowerCase()))){
      const included=filters.tags.includes(tag),excluded=filters.excluded.includes(tag);
      const b=el('button',{type:'button',class:'cfh-tag'+(included?' include':excluded?' exclude':''),'aria-label':`${tag}: ${t(included?'included':excluded?'excluded':'neutral')}`},(included?'+ ':excluded?'− ':'')+tag);
      b.onclick=()=>{filters.tags=filters.tags.filter(x=>x!==tag);filters.excluded=filters.excluded.filter(x=>x!==tag);if(included)filters.excluded.push(tag);else if(!excluded)filters.tags.push(tag);renderTags();apply();[...node.children].find(c=>c.textContent.endsWith(tag))?.focus();};
      node.append(b);
    }
  }
  function renderPresets(){
    const node=$('presets');node.replaceChildren(el('option',{value:''},t('presets')));
    presets.forEach((p,i)=>node.append(el('option',{value:String(i)},p.name)));$('delete').disabled=true;
  }
  function renderStats(){
    const node=$('statistics');if(!node)return;node.replaceChildren();node.hidden=!statsOpen;
    node.append(el('h3',{},t('statistics')),el('p',{class:'cfh-hint'},t('statsHint')));
    if(!ready || !history){node.append(el('p',{},t('statsEmpty')));return;}
    const stats=tagStats(problems,history);
    node.append(el('p',{},t('statsCount',{count:stats.total})),el('p',{class:'cfh-hint'},historyText()));
    const list=el('div',{class:'cfh-topic-stats'});
    for(const [tag,count] of stats.tags)list.append(el('span',{},tag,el('strong',{},String(count))));
    node.append(list);
  }
  function historyText(){return !history ? '' : t('profileFor',{handle:history.handle})+' · '+t(history.complete?'complete':'partial',{count:history.offset,date:new Date(history.time).toLocaleString(prefs.language)});}
  function renderRows(){
    active=true;$('restore').hidden=false;nativePagination.forEach(({node})=>{node.hidden=true;});
    const body=el('tbody'),header=el('tr',{},el('th',{},'#'),el('th',{},t('name')),el('th',{'aria-label':t('favoritesOnly')},'☆'),el('th',{},t('rating')),el('th',{},t('solvedCount')));body.append(header);
    const pages=Math.max(1,Math.ceil(results.length/prefs.pageSize));page=Math.min(page,pages);
    const solved=new Set(history?.solved || []),attempted=new Set(history?.attempted || []);
    for(const [i,p] of results.slice((page-1)*prefs.pageSize,page*prefs.pageSize).entries()){
      const row=el('tr',{class:'cfh-row'+(i%2===0?' dark':'')});
      if(history){if(solved.has(p.id))row.classList.add('accepted-problem');else if(attempted.has(p.id))row.classList.add('rejected-problem');}
      else for(const cls of (nativeClasses.get(p.id)||'').split(/\s+/).filter(Boolean))row.classList.add(cls);
      const cells=Array.from({length:5},()=>el('td'));
      cells[0].className='id';cells[0].append(el('a',{href:problemUrl(p)},p.id));
      cells[1].append(el('div',{class:'cfh-task-title'},el('a',{href:problemUrl(p)},p.name)));
      if(!filters.hideTags){const tags=el('div',{class:'cfh-task-tags'});p.tags.forEach((tag,j)=>{if(j)tags.append(', ');tags.append(el('a',{class:'notice',href:'https://codeforces.com/problemset?tags='+encodeURIComponent(tag)},tag));});cells[1].append(tags);}
      const favorite=favorites.includes(p.id);
      const star=el('button',{type:'button',class:'cfh-star'+(favorite?' active':''),'aria-label':`${t(favorite?'unbookmark':'bookmark')}: ${p.id}`,'aria-pressed':String(favorite),onclick:()=>{favorites=favorite?favorites.filter(id=>id!==p.id):[...favorites,p.id];save({favorites:[...favorites]});apply(false);}},favorite?'★':'☆');cells[2].append(star);
      if(!filters.hideRating)cells[3].append(el('span',{class:'ProblemRating'},String(p.rating??'')));else cells[3].setAttribute('aria-label',t('hiddenRating'));
      cells[4].append(el('a',{href:`https://codeforces.com/problemset/status/${p.contestId}/problem/${encodeURIComponent(p.index)}`},'×'+new Intl.NumberFormat(prefs.language).format(p.solved)));
      row.append(...cells);body.append(row);
    }
    if(!results.length)body.append(el('tr',{},el('td',{colSpan:5,class:'cfh-empty'},t('empty'))));
    table.replaceChildren(body);
    $('summary').textContent=t('found',{count:new Intl.NumberFormat(prefs.language).format(results.length)});
    $('random').disabled=!results.length;
    $('coverage').textContent=historyText();$('coverage').hidden=!history;
    pager.hidden=false;pager.setAttribute('aria-label',t('pages'));pager.replaceChildren(button('previous',()=>{page--;renderRows();},{disabled:page<=1}),el('span',{},`${page} / ${pages}`),button('next',()=>{page++;renderRows();},{disabled:page>=pages}));
  }
  function apply(reset=true){
    save({filters:structuredClone(filters)});
    if(!ready || !wanted)return;
    if(reset)page=1;
    const error=validate();results=error?[]:filterProblems(problems,filters,favorites,history);
    renderRows();renderStats();status(error || (stale?'stale':''),!!error || stale);
  }
  function restore(){wanted=false;if(active)table.replaceChildren(...originals);active=false;nativePagination.forEach(({node,hidden})=>{node.hidden=hidden;});pager.hidden=true;filterOpen=false;status('');renderUI();}
  function preferencesChanged(next){
    const old=prefs;prefs=cleanPrefs(next);applyLayout(prefs);
    if(old.language!==prefs.language)renderUI();
    if(active && (old.pageSize!==prefs.pageSize || old.language!==prefs.language))apply();
  }
  function historyChanged(next){history=next;if(!history)filters.accepted='all';syncControls();if(active)apply();renderStats();}
  function renderUI(){
    host.replaceChildren();host.lang=prefs.language;host.setAttribute('aria-label',t('toolbar'));
    const sort=select(['newest','oldest','ratingAsc','ratingDesc','popular','rare','name'].map(k=>[k,t(k)]),filters.sort,{name:'sort','data-role':'sort',disabled:!initialized,onchange:async e=>{filters.sort=e.target.value;wanted=true;$('restore').hidden=false;if(ready)apply();else{save({filters:structuredClone(filters)});await load();}}});
    const bar=el('div',{class:'cfh-bar'},el('img',{class:'cfh-brand',src:browser.runtime.getURL('cfhelper.png'),alt:'Codeforces Helper',width:32,height:32}),button('filters',async()=>{filterOpen=!filterOpen;$('form').hidden=!filterOpen;$('toggle').setAttribute('aria-expanded',String(filterOpen));if(filterOpen){wanted=true;$('restore').hidden=false;if(ready)apply();else await load();}},{'data-role':'toggle','aria-controls':'cfh-panel','aria-expanded':String(filterOpen),disabled:!initialized}),field('sort',sort),el('span',{class:'cfh-summary','data-role':'summary'},active?t('found',{count:results.length}):''),button('restore',restore,{'data-role':'restore',hidden:!wanted}),button('statistics',()=>{statsOpen=!statsOpen;renderStats();},{'data-role':'stats-toggle','aria-controls':'cfh-statistics'}));
    bar.querySelector('label').className='cfh-sort';
    const form=el('form',{id:'cfh-panel',class:'cfh-panel','data-role':'form',hidden:!filterOpen,onsubmit:e=>e.preventDefault(),oninput:e=>{const c=e.target;if(!(c.name in filters))return;filters[c.name]=c.type==='checkbox'?c.checked:c.value;apply();}},
      el('div',{class:'cfh-grid'},field('query',control('query',t('query'),'search')),field('number',control('number','1900A / 1900')),field('index',control('index','A, B, C1')),range('rating','rating'),range('solved','solvedCount'),range('contest','contest'),field('unrated',select([['include',t('include')],['exclude',t('exclude')],['only',t('only')]],filters.unrated,{name:'unrated'})),field('solvedFilter',select([['all',t('anyStatus')],['solved',t('accepted')],['unsolved',t('noAC')],['attempted',t('attempted')]],filters.accepted,{name:'accepted'}))),
      el('div',{class:'cfh-checks'},check('favoritesOnly','favoritesOnly'),check('hideTags','hideTags'),check('hideRating','hideRating')),
      el('div',{class:'cfh-tags-head'},el('strong',{},t('tags')),select([['all',t('all')],['any',t('any')]],filters.tagMode,{name:'tagMode','aria-label':t('tags')}),el('input',{type:'search',value:search,placeholder:t('tagSearch'),'aria-label':t('tagSearch'),'data-role':'tag-search',oninput:e=>{search=e.target.value;renderTags();}})),el('p',{class:'cfh-hint'},t('tagHint')),el('div',{class:'cfh-tags','data-role':'tags'}),
      el('div',{class:'cfh-actions'},button('reset',()=>{filters=structuredClone(defaults);search='';syncControls();$('tag-search').value='';renderTags();apply();},{'data-role':'reset'}),button('random',()=>{if(results.length)location.assign(problemUrl(results[Math.floor(Math.random()*results.length)]));},{'data-role':'random',disabled:!results.length}),button('refresh',()=>load(true),{'data-role':'refresh',disabled:loading})),
      el('div',{class:'cfh-presets'},el('input',{maxLength:60,placeholder:t('presetName'),'aria-label':t('presetName'),'data-role':'preset-name'}),button('save',()=>{const name=$('preset-name').value.trim(),error=validate();if(!name || error){status(error || 'presetError',true);return;}if(presets.length>=30){status('presetLimit',true);return;}presets.push({name,filters:structuredClone(filters)});save({presets:structuredClone(presets)});renderPresets();$('preset-name').value='';status('saved');},{'data-role':'save'}),el('select',{'data-role':'presets','aria-label':t('presets'),onchange:e=>{const v=e.target.value;$('delete').disabled=v==='';if(v!==''){filters=cleanFilters(presets[+v].filters);syncControls();renderTags();apply();}}}),button('remove',()=>{const v=$('presets').value;if(v==='')return;presets.splice(+v,1);save({presets:structuredClone(presets)});renderPresets();},{'data-role':'delete',disabled:true})),el('p',{class:'cfh-hint'},t('archiveHint')));
    host.append(bar,form,el('div',{id:'cfh-statistics',class:'cfh-panel','data-role':'statistics',hidden:!statsOpen}),el('p',{class:'cfh-hint','data-role':'coverage',hidden:!history},historyText()),el('p',{class:'cfh-status','data-role':'status',role:'status','aria-live':'polite',hidden:!statusKey},statusKey?t(statusKey):''));
    renderTags();renderPresets();renderStats();status(statusKey,statusError);
  }
  async function load(force=false){
    if(loading)return;loading=true;$('refresh').disabled=true;status('loading');
    try{
      const response=await browser.runtime.sendMessage({type:'catalogue',force});if(!response?.ok)throw Error();
      problems=response.data.problems;snapshot=response.data.time;stale=!!response.data.stale;ready=true;renderTags();apply();renderStats();
      if(wanted && snapshot)$('summary').title=t('cacheTime',{date:new Date(snapshot).toLocaleString(prefs.language)});
    }catch{if(wanted){filterOpen=true;$('form').hidden=false;$('toggle').setAttribute('aria-expanded','true');status('unavailable',true);}}
    finally{loading=false;$('refresh').disabled=false;}
  }
  renderUI();
  browser.storage.local.get(['preferences','filters','favorites','presets','profileCache']).then(saved=>{
    prefs=cleanPrefs(saved.preferences);filters=cleanFilters(saved.filters);favorites=saved.favorites || [];presets=(saved.presets || []).map(p=>({...p,filters:cleanFilters(p.filters)}));history=saved.profileCache || null;
    initialized=true;applyLayout(prefs);renderUI();
    browser.storage.local.remove('progress').catch(()=>{});
  }).catch(()=>{initialized=true;renderUI();status('readError',true);});
  browser.storage.onChanged?.addListener((changes,area)=>{
    if(area!=='local')return;
    if(changes.preferences){const next=cleanPrefs(changes.preferences.newValue);if(JSON.stringify(next)!==JSON.stringify(prefs)){preferencesChanged(next);}}
    if(changes.profileCache){historyChanged(changes.profileCache.newValue || null);}
  });
})();
