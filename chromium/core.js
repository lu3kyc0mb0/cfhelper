globalThis.CFHelper = (() => {
const defaults = { query: '', number: '', index: '', ratingMin: '', ratingMax: '', solvedMin: '', solvedMax: '', contestMin: '', contestMax: '', unrated: 'include', tags: [], excluded: [], tagMode: 'all', favoritesOnly: false, hideTags: false, hideRating: false, accepted: 'all', sort: 'newest' };
function cleanFilters(value = {}) {
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof value[key] === typeof fallback && (Array.isArray(fallback) ? Array.isArray(value[key]) : true) ? value[key] : structuredClone(fallback)]));
}
function filterProblems(problems, f, favorites = [], history = null) {
  const stars = new Set(favorites);
  const accepted = new Set(history?.solved || []), attempted = new Set(history?.attempted || []);
  const query = f.query.trim().toLocaleLowerCase();
  const number = f.number.replace(/\s/g, '').toUpperCase();
  const indexes = f.index.toUpperCase().split(/[\s,;]+/).filter(Boolean);
  const range = (value, min, max) => (min === '' || value >= Number(min)) && (max === '' || value <= Number(max));
  const result = problems.filter(p => {
    if (query && !p.name.toLocaleLowerCase().includes(query)) return false;
    if (number && (/^\d+$/.test(number) ? String(p.contestId) !== number : p.id.toUpperCase() !== number)) return false;
    if (indexes.length && !indexes.includes(p.index.toUpperCase())) return false;
    if (!range(p.contestId, f.contestMin, f.contestMax) || !range(p.solved, f.solvedMin, f.solvedMax)) return false;
    if (p.rating == null) {
      if (f.unrated === 'exclude' || f.ratingMin !== '' || f.ratingMax !== '') return false;
    } else if (f.unrated === 'only' || !range(p.rating, f.ratingMin, f.ratingMax)) return false;
    if (f.favoritesOnly && !stars.has(p.id)) return false;
    if (f.accepted && f.accepted !== 'all') {
      if (!history) return false;
      if (f.accepted === 'solved' && !accepted.has(p.id)) return false;
      if (f.accepted === 'unsolved' && accepted.has(p.id)) return false;
      if (f.accepted === 'attempted' && (!attempted.has(p.id) || accepted.has(p.id))) return false;
    }
    if (f.excluded.some(tag => p.tags.includes(tag))) return false;
    return !f.tags.length || (f.tagMode === 'all' ? f.tags.every(tag => p.tags.includes(tag)) : f.tags.some(tag => p.tags.includes(tag)));
  });
  return result.sort((a, b) => {
    let delta = 0;
    if (f.sort === 'oldest') delta = a.contestId - b.contestId;
    if (f.sort === 'newest') delta = b.contestId - a.contestId;
    if (f.sort === 'ratingAsc' || f.sort === 'ratingDesc') {
      if (a.rating == null && b.rating != null) return 1;
      if (b.rating == null && a.rating != null) return -1;
      delta = ((a.rating ?? 0) - (b.rating ?? 0)) * (f.sort === 'ratingAsc' ? 1 : -1);
    }
    if (f.sort === 'popular') delta = b.solved - a.solved;
    if (f.sort === 'rare') delta = a.solved - b.solved;
    if (f.sort === 'name') delta = a.name.localeCompare(b.name);
    return delta || b.contestId - a.contestId || a.index.localeCompare(b.index, undefined, { numeric: true });
  });
}
function problemUrl(p) { return `https://codeforces.com/problemset/problem/${p.contestId}/${encodeURIComponent(p.index)}`; }
function exportList(problems, filters, language = 'en') {
  const clean = value => String(value).replace(/[\r\n\t]/g, ' ');
  return [language === 'ru' ? 'CF Helper — список для тренировки' : 'CF Helper — practice list', ...problems.map(p => [
    p.id, clean(p.name), problemUrl(p),
    ...(filters.hideRating ? [] : [`${language === 'ru' ? 'Рейтинг' : 'Rating'}: ${p.rating ?? '—'}`]),
    ...(filters.hideTags ? [] : [`${language === 'ru' ? 'Теги' : 'Tags'}: ${p.tags.map(clean).join(', ')}`])
  ].join('\t'))].join('\n');
}
function summarizeSubmissions(submissions, previous = null) {
  const solved = new Set(previous?.solved || []), attempted = new Set(previous?.attempted || []);
  for (const submission of submissions) {
    const p = submission.problem;
    if (!Number.isInteger(p?.contestId) || !/^[A-Za-z0-9]+$/.test(p?.index)) continue;
    const id = `${p.contestId}${p.index}`;
    attempted.add(id);
    if (submission.verdict === 'OK') solved.add(id);
  }
  return { solved: [...solved], attempted: [...attempted] };
}
function tagStats(problems, history) {
  const solved = new Set(history?.solved || []), counts = new Map(); let total = 0;
  for (const p of problems) if (solved.has(p.id)) {
    total++;
    for (const tag of new Set(p.tags)) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return { total, tags: [...counts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])) };
}
return { defaults, cleanFilters, filterProblems, problemUrl, exportList, summarizeSubmissions, tagStats };
})();
