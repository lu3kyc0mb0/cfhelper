globalThis.CFUI = (() => {
  const defaults = { language:'en', pageSize:50, compact:false };
  function cleanPrefs(value = {}) {
    return { language: value.language === 'ru' ? 'ru' : 'en', pageSize:[25,50,100].includes(Number(value.pageSize)) ? Number(value.pageSize) : 50, compact:value.compact === true };
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
  function applyLayout(prefs) {
    document.documentElement.classList.toggle('cfh-compact',prefs.compact);
  }
  return { defaults, cleanPrefs, el, select, download, applyLayout };
})();
