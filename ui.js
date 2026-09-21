const squadPicksCache=new Map();
const playerPopupData=new Map();
let playerPointsModalBound=false;

function lineupsAvailableForGw(gw){
  const n=num(gw,0),current=num(state.currentGw,0),event=currentEventInfo(n);
  if(n<current||event?.finished)return true;
  const deadline=event?.deadline_time?new Date(event.deadline_time).getTime():0;
  return Boolean(deadline&&Date.now()>=deadline)
}

function liveElementMap(live){
  const src=live?.elements;
  if(Array.isArray(src))return new Map(src.map(el=>[num(el?.id??el?.element,-1),el]).filter(([id])=>id>=0));
  if(src&&typeof src==='object')return new Map(Object.entries(src).map(([key,el])=>[num(el?.id??el?.element??key,-1),el]).filter(([id])=>id>=0));
  return new Map()
}

function fixtureStateForTeam(live,teamId){
  const fixtures=asArray(live?.fixtures).filter(f=>num(f.team_h,-1)===num(teamId,-2)||num(f.team_a,-1)===num(teamId,-2));
  return{
    hasFixture:fixtures.length>0,
    anyStarted:fixtures.some(f=>Boolean(f.started||f.finished||f.finished_provisional||num(f.minutes,0)>0)),
    allFinished:fixtures.length>0&&fixtures.every(f=>Boolean(f.finished||f.finished_provisional))
  }
}

function pointsArePending(gw,liveEl,fixtureState){
  if(num(gw)!==num(state.currentGw))return false;
  const minutes=num(liveEl?.stats?.minutes,0);
  if(minutes>0)return false;
  return !fixtureState.allFinished
}

async function getSquadSnapshot(entry,gw,live){
  if(!lineupsAvailableForGw(gw))throw new Error('Postave trenutno nisu dostupne.');
  const key=`${entry.entryId}:${gw}`;
  let data=squadPicksCache.get(key);
  if(!data){data=await fetchJson(`/api/entry/${entry.entryId}/event/${gw}`);squadPicksCache.set(key,data)}
  const picks=extractPicks(data),pmap=playerMap(),liveMap=liveElementMap(live),teams=new Map(asArray(state.bootstrap?.teams).map(t=>[num(t.id,-1),t]));
  const all=picks.map((p,i)=>{
    const id=num(p.element??p.element_id??p.id,-1),player=pmap.get(id)||{},teamId=num(player.team??p.team,-1),club=teams.get(teamId)||{},liveEl=liveMap.get(id)||null;
    const points=liveEl?num(liveEl?.stats?.total_points??liveEl?.total_points??liveEl?.points,0):num(p.points??p.total_points,0);
    const fixtureState=fixtureStateForTeam(live,teamId),pending=pointsArePending(gw,liveEl,fixtureState);
    return{id,name:player.web_name||player.second_name||player.first_name||`Igrač ${id}`,type:num(player.element_type??p.element_type,0),position:num(p.position??p.pick_position??i+1,i+1),points,displayPoints:pending?'—':String(points),pending,teamId,teamCode:num(club.code??club.id,0),club:club.short_name||club.name||'',liveEl,fixtureState,gw}
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
  if(m.finished||num(gw)<num(state.currentGw)||!a||!b||!lineupsAvailableForGw(gw))return{a:num(m.league_entry_1_points),b:num(m.league_entry_2_points)};
  try{const[sa,sb]=await Promise.all([getSquadSnapshot(a,gw,live),getSquadSnapshot(b,gw,live)]);return{a:sa.total,b:sb.total}}catch(e){console.warn('Live score fallback',e);return{a:num(m.league_entry_1_points),b:num(m.league_entry_2_points)}}
}

async function renderMatchCards(target,gw,limit=null){
  const host=typeof target==='string'?qs(target):target;if(!host)return;
  const entries=entryMap();let ms=matchesForGw(gw);if(limit)ms=ms.slice(0,limit);
  if(!ms.length){host.innerHTML='<div class="empty">Parovi za ovo kolo još nisu dostupni.</div>';return}
  const live=lineupsAvailableForGw(gw)&&num(gw)===num(state.currentGw)?await getLive(gw):null;
  const rows=await Promise.all(ms.map(async m=>({m,scores:await getDisplayedMatchScores(m,gw,live,entries)})));
  host.innerHTML=rows.map(({m,scores})=>{const a=entries.get(num(m.league_entry_1))||{team:'—',manager:'—'},b=entries.get(num(m.league_entry_2))||{team:'—',manager:'—'},s=liveStatusForGw(gw,m);return`<a class="match-card" href="${matchUrl(m)}"><div class="match-team"><strong>${esc(a.team)}</strong><small>${esc(a.manager)}</small></div><div class="match-center"><div class="match-score">${scores.a} : ${scores.b}</div><div class="match-state ${s.cls==='live'?'live':''}">${s.label}</div></div><div class="match-team away"><strong>${esc(b.team)}</strong><small>${esc(b.manager)}</small></div></a>`}).join('')
}

function renderMiniTable(target,block,throughGw,compact=false){const table=typeof target==='string'?qs(target):target;if(!table)return;const body=qs('tbody',table);body.innerHTML=miniRows(block,throughGw).map(r=>`<tr class="${r.rank===1?'leader':''}"><td class="rank">${r.rank}</td><td><a class="team-name team-link" href="/team.html?id=${encodeURIComponent(r.id)}">${esc(r.team)}</a><span class="manager-name">${esc(r.manager)}</span></td>${compact?'':`<td class="num">${r.played}</td>`}<td class="num emph">${r.total}</td><td class="num">${r.max}</td></tr>`).join('')}
function renderLeagueTable(target,compact=false){const table=typeof target==='string'?qs(target):target;if(!table)return;qs('tbody',table).innerHTML=standingsRows().map(r=>`<tr class="${r.rank===1?'leader':''}"><td class="rank">${r.rank}</td><td><a class="team-name team-link" href="/team.html?id=${encodeURIComponent(r.id)}">${esc(r.team)}</a><span class="manager-name">${esc(r.manager)}</span></td>${compact?'':`<td class="num">${r.played}</td><td class="num">${r.won}</td><td class="num">${r.drawn}</td><td class="num">${r.lost}</td>`}<td class="num emph">${r.h2h}</td><td class="num">${r.for}</td>${compact?'':`<td class="num">${r.against}</td><td class="num">${r.for-r.against}</td>`}</tr>`).join('')}
function renderLatestNews(target,count=3){const host=typeof target==='string'?qs(target):target;if(!host)return;const a=asArray(state.articles?.articles).slice(0,count);host.innerHTML=a.map(x=>{const url=x.url||'/redakcija.html',ext=Boolean(x.external||/^https?:/.test(url));return`<a class="news-card" href="${esc(url)}" ${ext?'target="_blank" rel="noopener noreferrer"':''}><span class="news-type">${esc(x.type||'Redakcija')}</span><h3>${esc(x.title)}</h3><p>${esc(x.excerpt||'')}</p><div class="news-meta"><span>${esc(x.author||'D. Olivari')}</span><span>${esc(x.date||'')}</span></div></a>`}).join('')||'<div class="empty">Redakcija priprema novi tekst.</div>'}

function fplShirtUrl(player){
  if(!player.teamCode)return'';
  const goalkeeper=player.type===1?'_1':'';
  return`https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.teamCode}${goalkeeper}-66.png`
}

const POINT_STAT_LABELS={
  minutes:'Odigrane minute',
  goals_scored:'Golovi',
  assists:'Asistencije',
  clean_sheets:'Clean sheet',
  goals_conceded:'Primljeni golovi',
  own_goals:'Autogolovi',
  penalties_saved:'Obranjeni penali',
  penalties_missed:'Promašeni penali',
  yellow_cards:'Žuti kartoni',
  red_cards:'Crveni kartoni',
  saves:'Obrane',
  bonus:'Bonus',
  defensive_contribution:'Defenzivni doprinos',
  starts:'Start u početnoj postavi'
};
function pointStatLabel(id=''){return POINT_STAT_LABELS[id]||String(id).replaceAll('_',' ').replace(/^./,c=>c.toUpperCase())}
function pointStatValue(id,value){if(value===undefined||value===null||value==='')return'';return id==='minutes'?`${value} min`:`× ${value}`}
function playerBreakdownRows(player){
  const groups=new Map();
  const addStat=stat=>{
    const identifier=String(stat?.identifier??stat?.stat??'').trim(),points=num(stat?.points,0),value=num(stat?.value,0);
    if(!identifier||points===0)return;
    if(!groups.has(identifier))groups.set(identifier,{identifier,points:0,value:0});
    const row=groups.get(identifier);row.points+=points;row.value+=value
  };
  for(const block of asArray(player?.liveEl?.explain)){
    if(Array.isArray(block)&&Array.isArray(block[0])){
      for(const stat of block[0])addStat(stat);
      continue
    }
    for(const stat of asArray(block?.stats))addStat(stat)
  }
  return[...groups.values()]
}
function ensurePlayerPointsModal(){
  let modal=qs('#playerPointsModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='playerPointsModal';
    modal.className='player-points-modal';
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML='<div class="player-points-backdrop" data-player-modal-close></div><section class="player-points-dialog" role="dialog" aria-modal="true" aria-labelledby="playerPointsTitle"><button class="player-points-close" type="button" aria-label="Zatvori" data-player-modal-close>×</button><div id="playerPointsContent"></div></section>';
    document.body.appendChild(modal)
  }
  if(!playerPointsModalBound){
    playerPointsModalBound=true;
    document.addEventListener('click',e=>{
      const chip=e.target.closest('.player-chip[data-player-id]');
      if(chip){e.preventDefault();openPlayerPointsModal(chip.dataset.playerId);return}
      if(e.target.closest('[data-player-modal-close]'))closePlayerPointsModal()
    });
    document.addEventListener('keydown',e=>{
      const chip=e.target.closest?.('.player-chip[data-player-id]');
      if(chip&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openPlayerPointsModal(chip.dataset.playerId)}
      if(e.key==='Escape')closePlayerPointsModal()
    })
  }
  return modal
}
function closePlayerPointsModal(){const modal=qs('#playerPointsModal');if(!modal)return;modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('player-modal-open')}
function openPlayerPointsModal(id){
  const player=playerPopupData.get(String(id));if(!player)return;
  const modal=ensurePlayerPointsModal(),content=qs('#playerPointsContent',modal),rows=playerBreakdownRows(player),score=player.pending?'—':String(player.points);
  const breakdown=player.pending
    ?'<div class="player-points-empty">Igrač još nije upisao minute. Bodovi će se pojaviti kad uđe u igru.</div>'
    :rows.length
      ?`<div class="player-points-list">${rows.map(r=>`<div class="player-points-row"><div><strong>${esc(pointStatLabel(r.identifier))}</strong><small>${esc(pointStatValue(r.identifier,r.value))}</small></div><b class="${r.points<0?'negative':'positive'}">${r.points>0?'+':''}${r.points}</b></div>`).join('')}</div>`
      :`<div class="player-points-empty">${player.points===0?'Nema bodovnih stavki za ovaj nastup.':'Detaljna razrada bodova trenutno nije dostupna iz Draft API-ja.'}</div>`;
  content.innerHTML=`<div class="player-points-head"><div><span>${esc(player.club||'Premier League')}</span><h2 id="playerPointsTitle">${esc(player.name)}</h2><p>GW ${num(player.gw)} · razrada bodova</p></div><div class="player-points-total"><strong>${esc(score)}</strong><small>${player.pending?'čeka nastup':'bodova'}</small></div></div>${breakdown}`;
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('player-modal-open');qs('.player-points-close',modal)?.focus()
}
function squadPlayerCard(p){
  const shirt=fplShirtUrl(p),club=p.club?` · ${p.club}`:'';
  playerPopupData.set(String(p.id),p);
  return`<div class="player-chip ${p.type===1?'gk':''}" data-player-id="${p.id}" role="button" tabindex="0" aria-label="Otvori bodove za ${esc(p.name)}" title="${esc(p.name+club)} · klikni za bodove"><div class="player-shirt${shirt?'':' is-fallback'}">${shirt?`<img src="${shirt}" loading="lazy" decoding="async" alt="${esc(p.club||'Klupski dres')}" onerror="this.parentElement.classList.add('is-fallback');this.remove()">`:''}</div><strong>${esc(p.name)}</strong><span>${p.displayPoints==='—'?'—':`${p.displayPoints} pts`}</span></div>`
}

async function renderSquad(host,entry,gw,live,snapshot=null){
  if(!lineupsAvailableForGw(gw)){host.innerHTML='<div class="empty">Postave trenutno nisu dostupne.</div>';return null}
  host.innerHTML='<div class="loading">Dohvaćam postavu…</div>';
  try{const snap=snapshot||await getSquadSnapshot(entry,gw,live),{start,bench}=snap;if(!start.length)throw new Error('No lineup');ensurePlayerPointsModal();const rows=[1,2,3,4].map(t=>start.filter(p=>p.type===t)).filter(r=>r.length);host.innerHTML=`<div class="squad-head"><div><h2>${esc(entry.team)}</h2><p>${esc(entry.manager)}</p></div><span class="badge live">${snap.total} pts</span></div><div class="pitch">${rows.map(r=>`<div class="pitch-row">${r.map(squadPlayerCard).join('')}</div>`).join('')}</div><div class="bench"><div class="bench-title">Klupa</div><div class="bench-grid">${bench.map(squadPlayerCard).join('')||'<span class="manager-name">Nema podataka o klupi.</span>'}</div></div>`;return snap}catch(e){console.error(e);host.innerHTML='<div class="empty">Postava za ovo kolo trenutno nije dostupna iz Draft API-ja.</div>';return null}
}

function renderShame(target){const host=typeof target==='string'?qs(target):target;if(!host)return;const m=shameMetrics();host.innerHTML=m.map(x=>`<article class="shame-card"><div class="shame-icon">${x.icon}</div><div class="shame-label">${esc(x.label)}</div><div class="shame-value">${esc(x.value)}</div><div class="shame-sub">${esc(x.sub)}</div></article>`).join('')||'<div class="empty">Hall of Shame čeka prve završene rezultate.</div>'}
function renderHallOfFame(){
  const host=qs('#hofGrid');if(!host)return;
  const champs=asArray(state.champions?.champions).slice().reverse(),counts={};
  champs.forEach(c=>counts[c.winner]=(counts[c.winner]||0)+1);
  const images=window.HOF_IMAGES||{};
  host.innerHTML=champs.map(c=>{
    const key=`${c.winner}|${c.season}`;
    const img=images[key];
    const initials=c.winner.split(/\s+/).map(x=>x[0]).join('').slice(0,2);
    return`<article class="hof-card ${img?'featured':''}">${counts[c.winner]>1?`<span class="hof-count">${counts[c.winner]}× prvak</span>`:''}<div class="hof-photo">${img?`<img src="${img}" loading="lazy" decoding="async" alt="${esc(c.winner)} sa SkyLux trofejem">`:`<div class="hof-placeholder">${esc(initials)}</div>`}</div><div class="hof-info"><span class="hof-season">${esc(c.season)}</span><h3>${esc(c.winner)}</h3><p>${esc(c.team||'')}</p></div></article>`
  }).join('')
}