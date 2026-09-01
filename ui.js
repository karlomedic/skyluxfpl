const squadPicksCache=new Map();

async function getSquadSnapshot(entry,gw,live){
  const key=`${entry.entryId}:${gw}`;
  let data=squadPicksCache.get(key);
  if(!data){data=await fetchJson(`/api/entry/${entry.entryId}/event/${gw}`);squadPicksCache.set(key,data)}
  const picks=extractPicks(data),pmap=playerMap(),pts=livePointMap(live);
  const all=picks.map((p,i)=>{
    const id=num(p.element??p.element_id??p.id,-1),player=pmap.get(id)||{};
    return{id,name:player.web_name||player.second_name||player.first_name||`Igrač ${id}`,type:num(player.element_type??p.element_type,0),position:num(p.position??p.pick_position??i+1,i+1),points:pts.has(id)?num(pts.get(id),0):num(p.points??p.total_points,0)}
  }).sort((a,b)=>a.position-b.position);
  const start=all.filter((p,i)=>p.position<=11||(p.position===0&&i<11));
  const bench=all.filter((p,i)=>!(p.position<=11||(p.position===0&&i<11)));
  return{all,start,bench,total:start.reduce((s,p)=>s+p.points,0)}
}

function liveStatusForGw(gw,m){
  if(m?.finished)return{label:'FT',cls:'done'};
  const event=currentEventInfo(gw),deadline=event?.deadline_time?new Date(event.deadline_time).getTime():0;
  if(num(gw)===num(state.currentGw)&&deadline&&Date.now()>=deadline)return{label:'LIVE',cls:'live'};
  return{label:'USKORO',cls:'upcoming'}
}

async function getDisplayedMatchScores(m,gw,live,entries){
  const a=entries.get(num(m.league_entry_1)),b=entries.get(num(m.league_entry_2));
  if(m.finished||num(gw)<num(state.currentGw)||!a||!b)return{a:num(m.league_entry_1_points),b:num(m.league_entry_2_points)};
  try{const[sa,sb]=await Promise.all([getSquadSnapshot(a,gw,live),getSquadSnapshot(b,gw,live)]);return{a:sa.total,b:sb.total}}catch(e){console.warn('Live score fallback',e);return{a:num(m.league_entry_1_points),b:num(m.league_entry_2_points)}}
}

async function renderMatchCards(target,gw,limit=null){
  const host=typeof target==='string'?qs(target):target;if(!host)return;
  const entries=entryMap();let ms=matchesForGw(gw);if(limit)ms=ms.slice(0,limit);
  if(!ms.length){host.innerHTML='<div class="empty">Parovi za ovo kolo još nisu dostupni.</div>';return}
  const live=num(gw)===num(state.currentGw)?await getLive(gw):null;
  const rows=await Promise.all(ms.map(async m=>({m,scores:await getDisplayedMatchScores(m,gw,live,entries)})));
  host.innerHTML=rows.map(({m,scores})=>{const a=entries.get(num(m.league_entry_1))||{team:'—',manager:'—'},b=entries.get(num(m.league_entry_2))||{team:'—',manager:'—'},s=liveStatusForGw(gw,m);return`<a class="match-card" href="${matchUrl(m)}"><div class="match-team"><strong>${esc(a.team)}</strong><small>${esc(a.manager)}</small></div><div class="match-center"><div class="match-score">${scores.a} : ${scores.b}</div><div class="match-state ${s.cls==='live'?'live':''}">${s.label}</div></div><div class="match-team away"><strong>${esc(b.team)}</strong><small>${esc(b.manager)}</small></div></a>`}).join('')
}

function renderMiniTable(target,block,throughGw,compact=false){const table=typeof target==='string'?qs(target):target;if(!table)return;const body=qs('tbody',table);body.innerHTML=miniRows(block,throughGw).map(r=>`<tr class="${r.rank===1?'leader':''}"><td class="rank">${r.rank}</td><td><span class="team-name">${esc(r.team)}</span><span class="manager-name">${esc(r.manager)}</span></td>${compact?'':`<td class="num">${r.played}</td>`}<td class="num emph">${r.total}</td><td class="num">${r.max}</td></tr>`).join('')}
function renderLeagueTable(target,compact=false){const table=typeof target==='string'?qs(target):target;if(!table)return;qs('tbody',table).innerHTML=standingsRows().map(r=>`<tr class="${r.rank===1?'leader':''}"><td class="rank">${r.rank}</td><td><span class="team-name">${esc(r.team)}</span><span class="manager-name">${esc(r.manager)}</span></td>${compact?'':`<td class="num">${r.played}</td><td class="num">${r.won}</td><td class="num">${r.drawn}</td><td class="num">${r.lost}</td>`}<td class="num emph">${r.h2h}</td><td class="num">${r.for}</td>${compact?'':`<td class="num">${r.against}</td><td class="num">${r.for-r.against}</td>`}</tr>`).join('')}
function renderLatestNews(target,count=3){const host=typeof target==='string'?qs(target):target;if(!host)return;const a=asArray(state.articles?.articles).slice(0,count);host.innerHTML=a.map(x=>{const url=x.url||'/redakcija.html',ext=Boolean(x.external||/^https?:/.test(url));return`<a class="news-card" href="${esc(url)}" ${ext?'target="_blank" rel="noopener noreferrer"':''}><span class="news-type">${esc(x.type||'Redakcija')}</span><h3>${esc(x.title)}</h3><p>${esc(x.excerpt||'')}</p><div class="news-meta"><span>${esc(x.author||'D. Olivari')}</span><span>${esc(x.date||'')}</span></div></a>`}).join('')||'<div class="empty">Redakcija priprema novi tekst.</div>'}

async function renderSquad(host,entry,gw,live,snapshot=null){
  host.innerHTML='<div class="loading">Dohvaćam postavu…</div>';
  try{const snap=snapshot||await getSquadSnapshot(entry,gw,live),{start,bench}=snap;if(!start.length)throw new Error('No lineup');const rows=[1,2,3,4].map(t=>start.filter(p=>p.type===t)).filter(r=>r.length);host.innerHTML=`<div class="squad-head"><div><h2>${esc(entry.team)}</h2><p>${esc(entry.manager)}</p></div><span class="badge live">${snap.total} pts</span></div><div class="pitch">${rows.map(r=>`<div class="pitch-row">${r.map(p=>`<div class="player-chip"><strong title="${esc(p.name)}">${esc(p.name)}</strong><span>${p.points} pts</span></div>`).join('')}</div>`).join('')}</div><div class="bench"><div class="bench-title">Klupa</div><div class="bench-grid">${bench.map(p=>`<div class="player-chip"><strong title="${esc(p.name)}">${esc(p.name)}</strong><span>${p.points} pts</span></div>`).join('')||'<span class="manager-name">Nema podataka o klupi.</span>'}</div></div>`;return snap}catch(e){console.error(e);host.innerHTML='<div class="empty">Postava za ovo kolo trenutno nije dostupna iz Draft API-ja.</div>';return null}
}

function renderShame(target){const host=typeof target==='string'?qs(target):target;if(!host)return;const m=shameMetrics();host.innerHTML=m.map(x=>`<article class="shame-card"><div class="shame-icon">${x.icon}</div><div class="shame-label">${esc(x.label)}</div><div class="shame-value">${esc(x.value)}</div><div class="shame-sub">${esc(x.sub)}</div></article>`).join('')||'<div class="empty">Hall of Shame čeka prve završene rezultate.</div>'}
function renderHallOfFame(){const host=qs('#hofGrid');if(!host)return;const champs=asArray(state.champions?.champions).slice().reverse(),counts={};champs.forEach(c=>counts[c.winner]=(counts[c.winner]||0)+1);const images={'Kristian Radoš|2019/20':'/assets/hof/kristian-rados-2019-20.jpg','Kristian Radoš|2021/22':'/assets/hof/kristian-rados-2021-22.jpg','Karlo Medić|2025/26':'/assets/hof/karlo-medic-2025-26.jpg'};host.innerHTML=champs.map(c=>{const img=images[`${c.winner}|${c.season}`],initials=c.winner.split(/\s+/).map(x=>x[0]).join('').slice(0,2);return`<article class="hof-card ${img?'featured':''}">${counts[c.winner]>1?`<span class="hof-count">${counts[c.winner]}× prvak</span>`:''}<div class="hof-photo">${img?`<img src="${img}" loading="lazy" decoding="async" alt="${esc(c.winner)} sa SkyLux trofejem"><span class="trophy-season">${esc(c.season)}</span>`:`<div class="hof-placeholder">${esc(initials)}</div>`}</div><div class="hof-info"><span class="hof-season">${esc(c.season)}</span><h3>${esc(c.winner)}</h3><p>${esc(c.team||'')}</p></div></article>`}).join('')}