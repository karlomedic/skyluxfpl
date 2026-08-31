const LEAGUE_ID = 13174;
const REFRESH_MS = 60_000;

const state = {
  league: null,
  bootstrap: null,
  currentGw: null,
  timer: null,
};

const els = {
  connectionBadge: document.querySelector('#connectionBadge'),
  heroGw: document.querySelector('#heroGw'),
  heroBlock: document.querySelector('#heroBlock'),
  lastUpdated: document.querySelector('#lastUpdated'),
  refreshButton: document.querySelector('#refreshButton'),
  standingsLoading: document.querySelector('#standingsLoading'),
  standingsTable: document.querySelector('#standingsTable'),
  miniLoading: document.querySelector('#miniLoading'),
  miniTable: document.querySelector('#miniTable'),
  miniTitle: document.querySelector('#miniTitle'),
  miniRange: document.querySelector('#miniRange'),
  matchesPanel: document.querySelector('#matchesPanel'),
  matchesTitle: document.querySelector('#matchesTitle'),
  matchesStatus: document.querySelector('#matchesStatus'),
  articlesGrid: document.querySelector('#articlesGrid'),
  championsGrid: document.querySelector('#championsGrid'),
  toast: document.querySelector('#toast'),
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const key of ['results', 'data', 'items']) {
    if (Array.isArray(value[key])) return value[key];
  }
  return Object.values(value).filter(item => item && typeof item === 'object');
}

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function fetchJsonWithFallback(paths) {
  let lastError;
  for (const path of paths) {
    try {
      const res = await fetch(path, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const type = res.headers.get('content-type') || '';
      if (!type.includes('json')) throw new Error('Odgovor nije JSON');
      return await res.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('API nije dostupan');
}

function entryLookup(league) {
  const entries = asArray(league?.league_entries);
  return new Map(entries.map(entry => [
    n(entry.id ?? entry.league_entry ?? entry.entry_id, -1),
    entry.entry_name || entry.name || `Ekipa ${entry.id ?? ''}`,
  ]));
}

function deriveCurrentGw(league, bootstrap) {
  const events = asArray(bootstrap?.events);
  const current = events.find(e => e.is_current);
  if (current) return n(current.id, null);
  const next = events.find(e => e.is_next);
  if (next) return n(next.id, null);

  const matches = asArray(league?.matches);
  const unfinished = matches
    .filter(m => !Boolean(m.finished))
    .map(m => n(m.event, null))
    .filter(Boolean);
  if (unfinished.length) return Math.min(...unfinished);

  const allEvents = matches.map(m => n(m.event, 0)).filter(Boolean);
  return allEvents.length ? Math.max(...allEvents) : 1;
}

function blockForGw(gw) {
  const blocks = [
    { id: 1, start: 1, end: 7 },
    { id: 2, start: 8, end: 14 },
    { id: 3, start: 15, end: 21 },
    { id: 4, start: 22, end: 28 },
    { id: 5, start: 29, end: 35 },
  ];
  const found = blocks.find(b => gw >= b.start && gw <= b.end);
  if (found) return found;
  if (gw > 35) return { ...blocks[4], finished: true };
  return blocks[0];
}

function renderStandings() {
  const league = state.league;
  const lookup = entryLookup(league);
  const standings = asArray(league?.standings)
    .map(row => ({
      id: n(row.league_entry ?? row.id ?? row.entry_id, -1),
      rank: n(row.rank, 999),
      h2h: n(row.total ?? row.points, 0),
      fantasy: n(row.points_for ?? row.score, 0),
    }))
    .sort((a, b) => a.rank - b.rank || b.h2h - a.h2h || b.fantasy - a.fantasy);

  if (!standings.length) {
    els.standingsLoading.textContent = 'Tablica trenutno nije dostupna.';
    els.standingsTable.hidden = true;
    return;
  }

  const tbody = els.standingsTable.querySelector('tbody');
  tbody.innerHTML = standings.map((row, idx) => {
    const team = lookup.get(row.id) || `Ekipa ${row.id}`;
    const rank = row.rank === 999 ? idx + 1 : row.rank;
    return `
      <tr class="${rank === 1 ? 'rank-first' : ''}">
        <td>${rank}</td>
        <td class="team-cell">${escapeHtml(team)}</td>
        <td><span class="score-strong">${row.h2h}</span></td>
        <td><span class="score-strong">${row.fantasy}</span></td>
      </tr>`;
  }).join('');

  els.standingsLoading.hidden = true;
  els.standingsTable.hidden = false;
}

function extractScores(matches, startGw, endGw) {
  const result = new Map();
  const add = (entryId, event, points) => {
    const id = n(entryId, -1);
    if (id < 0) return;
    if (!result.has(id)) result.set(id, new Map());
    result.get(id).set(event, n(points, 0));
  };

  for (const match of matches) {
    const event = n(match.event, 0);
    if (event < startGw || event > endGw) continue;
    add(match.league_entry_1, event, match.league_entry_1_points);
    add(match.league_entry_2, event, match.league_entry_2_points);
  }
  return result;
}

function renderMini() {
  const gw = state.currentGw || 1;
  const block = blockForGw(gw);
  const lookup = entryLookup(state.league);
  const matches = asArray(state.league?.matches);
  const throughGw = Math.min(gw, block.end);
  const scores = extractScores(matches, block.start, throughGw);

  const rows = [...lookup.entries()].map(([id, team]) => {
    const gwMap = scores.get(id) || new Map();
    const values = [...gwMap.values()];
    return {
      id,
      team,
      total: values.reduce((sum, value) => sum + value, 0),
      maxGw: values.length ? Math.max(...values) : 0,
    };
  }).sort((a, b) => b.total - a.total || b.maxGw - a.maxGw || a.team.localeCompare(b.team, 'hr'));

  let previous = null;
  let visibleRank = 0;
  rows.forEach((row, index) => {
    const key = `${row.total}-${row.maxGw}`;
    if (key !== previous) visibleRank = index + 1;
    row.rank = visibleRank;
    previous = key;
  });

  els.miniTitle.textContent = block.finished ? 'Završeno mini-prvenstvo' : `Mini-prvenstvo ${block.id}`;
  els.miniRange.textContent = `GW ${block.start}–${block.end}`;
  els.heroBlock.textContent = block.finished ? 'Mini gotov' : `${block.start}–${block.end}`;

  if (!rows.length) {
    els.miniLoading.textContent = 'Nema podataka za mini-prvenstvo.';
    els.miniTable.hidden = true;
    return;
  }

  els.miniTable.querySelector('tbody').innerHTML = rows.map(row => `
    <tr class="${row.rank === 1 ? 'rank-first' : ''}">
      <td>${row.rank}</td>
      <td class="team-cell">${escapeHtml(row.team)}</td>
      <td><span class="score-strong">${row.total}</span></td>
      <td><span class="score-strong">${row.maxGw}</span></td>
    </tr>`).join('');

  els.miniLoading.hidden = true;
  els.miniTable.hidden = false;
}

function renderMatches() {
  const gw = state.currentGw || 1;
  const lookup = entryLookup(state.league);
  const matches = asArray(state.league?.matches).filter(m => n(m.event, 0) === gw);
  els.matchesTitle.textContent = `H2H parovi · GW ${gw}`;

  if (!matches.length) {
    els.matchesStatus.textContent = 'NEMA PODATAKA';
    els.matchesPanel.innerHTML = '<div class="loading-state">Parovi za ovo kolo još nisu dostupni.</div>';
    return;
  }

  const anyLive = matches.some(m => !Boolean(m.finished) && (n(m.league_entry_1_points) > 0 || n(m.league_entry_2_points) > 0));
  const allFinished = matches.every(m => Boolean(m.finished));
  els.matchesStatus.textContent = allFinished ? 'ZAVRŠENO' : anyLive ? 'LIVE' : 'USKORO';

  els.matchesPanel.innerHTML = matches.map(match => {
    const home = lookup.get(n(match.league_entry_1, -1)) || '—';
    const away = lookup.get(n(match.league_entry_2, -1)) || '—';
    const homePts = n(match.league_entry_1_points, 0);
    const awayPts = n(match.league_entry_2_points, 0);
    const finished = Boolean(match.finished);
    const live = !finished && (homePts > 0 || awayPts > 0);
    const status = finished ? 'FT' : live ? 'LIVE' : 'UPCOMING';
    return `
      <div class="match-row">
        <div class="match-team">${escapeHtml(home)}</div>
        <div class="match-score">${homePts} : ${awayPts}<span class="match-state ${live ? 'live' : ''}">${status}</span></div>
        <div class="match-team away">${escapeHtml(away)}</div>
      </div>`;
  }).join('');
}

async function loadEditorial() {
  try {
    const [articlesData, championsData] = await Promise.all([
      fetch('./data/articles.json', { cache: 'no-store' }).then(r => r.json()),
      fetch('./data/champions.json', { cache: 'no-store' }).then(r => r.json()),
    ]);
    renderArticles(asArray(articlesData.articles));
    renderChampions(asArray(championsData.champions));
  } catch (error) {
    renderArticles([]);
  }
}

function renderArticles(articles) {
  if (!articles.length) {
    els.articlesGrid.innerHTML = `
      <article class="article-card">
        <span class="article-type">Redakcija</span>
        <h3>Press room se tek zagrijava.</h3>
        <p>Najave kola i sažeci uskoro će se automatski pojavljivati ovdje nakon objave u GitHub repou.</p>
        <div class="article-footer"><span>SkyLux</span><span>uskoro</span></div>
      </article>`;
    return;
  }

  els.articlesGrid.innerHTML = articles.slice(0, 6).map(article => {
    const body = `
      <span class="article-type">${escapeHtml(article.type || 'Redakcija')}</span>
      <h3>${escapeHtml(article.title)}</h3>
      <p>${escapeHtml(article.excerpt || '')}</p>
      <div class="article-footer"><span>${escapeHtml(article.author || 'SkyLux redakcija')}</span><span>${escapeHtml(article.date || '')}${article.url ? ' · Otvori ↗' : ''}</span></div>`;

    if (article.url) {
      return `<a class="article-card" href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">${body}</a>`;
    }

    return `<article class="article-card">${body}</article>`;
  }).join('');
}

function renderChampions(champions) {
  els.championsGrid.innerHTML = champions.slice().reverse().map(item => `
    <div class="champion"><small>${escapeHtml(item.season)}</small><strong>${escapeHtml(item.winner)}</strong></div>`).join('');
}

function setConnection(status, label) {
  els.connectionBadge.className = `connection ${status}`;
  els.connectionBadge.textContent = label;
}

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.className = `toast show${isError ? ' error' : ''}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { els.toast.className = 'toast'; }, 3500);
}

async function refreshLive({ silent = false } = {}) {
  els.refreshButton.disabled = true;
  if (!silent) setConnection('waiting', 'SPAJANJE');

  try {
    const [league, bootstrap] = await Promise.all([
      fetchJsonWithFallback([
        '/api/league',
        `https://draft.premierleague.com/api/league/${LEAGUE_ID}/details`,
      ]),
      fetchJsonWithFallback([
        '/api/bootstrap',
        'https://draft.premierleague.com/api/bootstrap-static',
      ]).catch(() => null),
    ]);

    state.league = league;
    state.bootstrap = bootstrap;
    state.currentGw = deriveCurrentGw(league, bootstrap);

    els.heroGw.textContent = `GW ${state.currentGw}`;
    els.lastUpdated.textContent = new Intl.DateTimeFormat('hr-HR', { hour: '2-digit', minute: '2-digit' }).format(new Date());

    renderStandings();
    renderMini();
    renderMatches();
    setConnection('online', 'LIVE');
    if (!silent) showToast('Live podaci osvježeni.');
  } catch (error) {
    console.error(error);
    setConnection('offline', 'API GREŠKA');
    els.standingsLoading.textContent = 'Ne mogu dohvatiti FPL Draft API. Ako se ovo ponavlja, uključit ćemo Cloudflare proxy.';
    els.miniLoading.textContent = 'Mini-prvenstvo čeka live podatke.';
    els.matchesPanel.innerHTML = '<div class="loading-state">Live parovi trenutno nisu dostupni.</div>';
    if (!silent) showToast('FPL Draft API trenutno nije dostupan.', true);
  } finally {
    els.refreshButton.disabled = false;
  }
}

els.refreshButton.addEventListener('click', () => refreshLive());

loadEditorial();
refreshLive({ silent: true });
state.timer = setInterval(() => refreshLive({ silent: true }), REFRESH_MS);
