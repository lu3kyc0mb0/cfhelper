(async () => {
  const saved=await browser.storage.local.get('preferences');
  let prefs=globalThis.CFUI.cleanPrefs(saved.preferences);
  globalThis.CFUI.applyLayout(prefs);
  const update=p=>{prefs=p;document.documentElement.lang=p.language;document.title=globalThis.CFText.t(p.language,'settingsTitle');};
  update(prefs);
  globalThis.CFSettings(document.getElementById('settings-root'),prefs,{onPreferences:update});
})();
