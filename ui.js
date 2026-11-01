globalThis.CFUI = (() => {
  const palettes = {
    light: { background:'#ffffff', surface:'#ffffff', text:'#222222', muted:'#707070', border:'#c8c8c8', link:'#244f9b', stripe:'#f3f3f3' },
    dark: { background:'#16191f', surface:'#20252e', text:'#e2e6ed', muted:'#aab3c1', border:'#424b5a', link:'#8eb6ff', stripe:'#272e39' }
  };
  const defaults = { language:'en', theme:'native', custom:palettes.dark, pageSize:50, compact:false };
  function validPalette(value) {
    return value && Object.keys(palettes.light).every(k => typeof value[k] === 'string' && /^#[0-9a-f]{6}$/i.test(value[k]));
  }
  function cleanPrefs(value = {}) {
    return { language: value.language === 'ru' ? 'ru' : 'en', theme:['native','light','dark','system','custom'].includes(value.theme) ? value.theme : 'native', custom:validPalette(value.custom) ? Object.fromEntries(Object.keys(palettes.light).map(k => [k,value.custom[k]])) : {...palettes.dark}, pageSize:[25,50,100].includes(Number(value.pageSize)) ? Number(value.pageSize) : 50, compact:value.compact === true };
  }
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key,value] of Object.entries(attrs)) {
      if (key.startsWith('on')) node.addEventListener(key.slice(2),value);
      else if (key === 'class') node.className=value;
      else if (key in node && !key.startsWith('aria-')) node[key]=value;
      else node.setAttribute(key,value);
    }
    node.append(...children.filter(c => c !== null && c !== undefined)); return node;
  }
  function select(options, value, attrs = {}) {
    const node=el('select',attrs,...options.map(([id,label])=>el('option',{value:id},label))); node.value=value; return node;
  }
  function download(name, content, type='text/plain;charset=utf-8') {
    const url=URL.createObjectURL(new Blob([content],{type}));
    const a=el('a',{href:url,download:name}); document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function applyTheme(prefs) {
    const root=document.documentElement;
    root.classList.toggle('cfh-compact',prefs.compact);
    if (prefs.theme === 'native') {
      delete root.dataset.cfhTheme;
      for(const key of Object.keys(palettes.light)) root.style.removeProperty('--cfh-'+key);
      return;
    }
    const mode=prefs.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light') : prefs.theme;
    const colors=mode === 'custom' ? prefs.custom : palettes[mode];
    root.dataset.cfhTheme=mode;
    for (const [key,value] of Object.entries(colors)) root.style.setProperty('--cfh-'+key,value);
  }
  function themeJSON(palette) { return JSON.stringify({format:'cfhelper-theme',version:'1.0.0',colors:palette},null,2); }
  function parseTheme(text) {
    if (text.length>20000) throw Error('invalidTheme');
    const data=JSON.parse(text);
    if (data.format!=='cfhelper-theme' || !validPalette(data.colors)) throw Error('invalidTheme');
    return Object.fromEntries(Object.keys(palettes.light).map(k=>[k,data.colors[k]]));
  }
  return { defaults, palettes, cleanPrefs, validPalette, el, select, download, applyTheme, themeJSON, parseTheme };
})();
