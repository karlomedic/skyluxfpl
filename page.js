function showToast(message,isError=false){const el=qs('#toast');if(!el)return;el.textContent=message;el.className=`toast show${isError?' error':''}`;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.className='toast',3200)}
function setGlobalGw(){const e=qs('#globalGw');if(!e)return;const shown=homeGwDisplay(),chip=e.closest('.gw-chip');if(chip)chip.innerHTML=`${shown.future?'Sljedeće':'Trenutno'} <strong id="globalGw">GW${shown.gw}</strong>`;else e.textContent=`GW${shown.gw}`}
function setActiveNav(){const p=document.body.dataset.page;qsa('.nav a[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===p))}
function initNav(){const b=qs('#mobileMenu'),n=qs('#mainNav');b?.addEventListener('click',()=>n?.classList.toggle('open'));qsa('#mainNav a').forEach(a=>a.addEventListener('click',()=>n?.classList.remove('open')))}
function normalizeLabels(){qsa('.nav a[href="/league.html"]').forEach(a=>a.textContent='H2H Tablica');qsa('.league-chip').forEach(x=>x.remove());qsa('.footer span').forEach(x=>{x.textContent=x.textContent.replace(' · League 13174','')});qsa('.archive-copy span').forEach(x=>x.textContent='IZ ARHIVE');if(document.body.dataset.page==='league'){const h=qs('.page-title');if(h)h.textContent='H2H Tablica.';document.title='H2H Tablica · SkyLux FPL'}}
function homeGwDisplay(){const events=asArray(state.bootstrap?.events),gw=num(state.currentGw,1),event=currentEventInfo(gw),matches=matchesForGw(gw),roundDone=Boolean(event.finished)||(matches.length>0&&matches.every(m=>m.finished));const next=events.find(e=>e.is_next&&num(e.id)>gw)||events.find(e=>num(e.id)>gw&&!e.finished);if(roundDone&&next)return{gw:num(next.id,gw+1),event:next,future:true};return{gw,event,future:Boolean(event.is_next&&!event.is_current)}}
async function initHome(){const shown=homeGwDisplay(),block=blockForGw(state.currentGw),event=shown.event;qs('#homeGw').textContent=`GW${shown.gw}`;qs('#homeGwDates').textContent=event.deadline_time?`Deadline ${dateHr(event.deadline_time)} · ${timeHr(event.deadline_time)}`:(shown.future?'Sljedeći deadline uskoro':'Aktualno kolo');const statusLabel=qs('.hero-status-label');if(statusLabel)statusLabel.innerHTML=`<span class="status-dot"></span>${shown.future?'Iduće kolo':'Trenutno kolo'}`;const matchTitle=qs('#homeMatches')?.closest('.section')?.querySelector('.section-head h2');if(matchTitle)matchTitle.textContent=shown.future?'Iduće kolo':'Trenutno kolo';qs('#homeMiniRange').textContent=block.label;renderLeagueTable('#homeLeagueTable',true);renderMiniTable('#homeMiniTable',block,Math.min(state.currentGw,block.end),true);await renderMatchCards('#homeMatches',shown.gw);renderLatestNews('#latestNews',3)}
async function initLeague(){renderLeagueTable('#leagueTable',false)}
async function initTeam(){
  const id=num(new URLSearchParams(location.search).get('id'),-1),entry=entryMap().get(id);
  if(!entry){qs('#teamView').innerHTML='<div class="notice">Ekipa nije pronađena.</div>';return}
  document.title=`${entry.team} · SkyLux FPL`;
  qs('#teamName').textContent=entry.team;qs('#teamManager').textContent=entry.manager;
  const photo=qs('#teamManagerPhoto');if(photo){const slug={'Petar Medić':'petar%20medic.jpg','Marko Mihaljević':'marko%20mihaljevic.jpg','Ante Babić':'ante%20babic.jpg','Ivan Vrdoljak':'ivan%20vrdoljak.jpg','Karlo Medić':'karlo%20medic.jpg','Jakov Vrdoljak':'jakov%20vrdoljak.jpg','Robert Tokić':'robert%20tokic.jpg','Kristian Radoš':'kristian%20rado%C5%A1.jpg'}[entry.manager];if(slug){photo.src='/assets/about/'+slug;photo.alt=entry.manager;photo.hidden=false}const titleSeasons={'Robert Tokić':['2020/21','2023/24'],'Petar Medić':['2017/18'],'Marko Mihaljević':['2024/25'],'Karlo Medić':['2025/26'],'Kristian Radoš':['2019/20','2021/22']}[entry.manager]||[],badge=qs('#teamTitleBadge');if(badge&&titleSeasons.length){badge.hidden=false;badge.innerHTML=`<span class="title-trophy">♛</span><span><strong>PRVAK SKYLUX</strong><small><span class="title-years">${titleSeasons.map(s=>`<b>${s}</b>`).join('')}</span></small></span>`}}
  const standing=standingsRows().find(r=>r.id===id);
  if(standing)qs('#teamStats').innerHTML=`<div><small>Pozicija</small><strong>#${standing.rank}</strong></div><div><small>H2H bodovi</small><strong>${standing.h2h}</strong></div><div><small>Omjer</small><strong>${standing.won}-${standing.drawn}-${standing.lost}</strong></div><div><small>Fantasy bodovi</small><strong>${standing.for}</strong></div>`;
  const entries=entryMap(),matches=asArray(state.league?.matches).filter(m=>num(m.league_entry_1)===id||num(m.league_entry_2)===id).sort((a,b)=>num(a.event)-num(b.event));
  const past=matches.filter(m=>m.finished||num(m.event)<state.currentGw),future=matches.filter(m=>!m.finished&&num(m.event)>=state.currentGw);
  const row=m=>{const home=num(m.league_entry_1)===id,opp=entries.get(num(home?m.league_entry_2:m.league_entry_1))||{team:'—'},done=Boolean(m.finished)||num(m.event)<state.currentGw,a=num(home?m.league_entry_1_points:m.league_entry_2_points),b=num(home?m.league_entry_2_points:m.league_entry_1_points),result=done?(a>b?'P':a<b?'I':'N'):'—';return `<a class="team-fixture-row" href="${matchUrl(m)}"><span class="team-gw">GW${num(m.event)}</span><span class="team-venue">${home?'DOMA':'GOSTI'}</span><strong>${esc(opp.team)}</strong><span class="team-result ${result==='P'?'win':result==='I'?'loss':''}">${done?`${a} : ${b}`:'vs'}</span><b>${result}</b></a>`};
  qs('#teamResults').innerHTML=past.length?past.slice().reverse().map(row).join(''):'<div class="empty">Još nema završenih utakmica.</div>';
  qs('#teamUpcoming').innerHTML=future.length?future.map(row).join(''):'<div class="empty">Nema dostupnih nadolazećih parova.</div>';
}


function predictorStrengthRows(){
  const rows=standingsRows(),maxPlayed=Math.max(1,...rows.map(r=>r.played||0));
  return rows.map(r=>{const p=Math.max(1,r.played||maxPlayed),avg=r.for/p,form=(r.won*3+r.drawn)/p;return{...r,strength:avg+form*5}}).sort((a,b)=>b.strength-a.strength);
}
function predictorMatchValues(a,b){
  const s=predictorStrengthRows(),ra=s.find(x=>x.id===a),rb=s.find(x=>x.id===b),sa=ra?.strength||50,sb=rb?.strength||50,d=sa-sb;
  const pa=Math.max(.22,Math.min(.67,.44+d/150)),pb=Math.max(.18,Math.min(.62,.39-d/150)),px=Math.max(.12,1-pa-pb),sum=pa+pb+px;
  const v=p=>Math.max(1.25,Math.min(6,Math.round((1/(p/sum))*100)/100));
  return{a:v(pa),x:v(px),b:v(pb)};
}
function predictorTeamValues(){
  const rows=predictorStrengthRows(),n=rows.length||1,weights=rows.map((r,i)=>({id:r.id,team:r.team,best:1.6+i*.24,worst:1.6+(n-1-i)*.24}));
  return weights;
}
function predictorPickKey(gw,market){return `skylux-predictor:${gw}:${market}`}
function predictorChoice(market,value,label,mult){
  localStorage.setItem(predictorPickKey(state.currentGw,market),JSON.stringify({value,label,mult}));
  qsa(`[data-market="${market}"] .predictor-option`).forEach(x=>x.classList.toggle('selected',x.dataset.value===String(value)));
  const out=qs('#predictorSummary');if(out)drawPredictorSummary();
}
function drawPredictorSummary(){
  const host=qs('#predictorSummary');if(!host)return;const picks=[];
  qsa('[data-market]').forEach(box=>{const market=box.dataset.market,raw=localStorage.getItem(predictorPickKey(state.currentGw,market));if(raw)try{picks.push(JSON.parse(raw))}catch{}});
  const total=picks.reduce((s,p)=>s+num(p.mult),0);
  host.innerHTML=picks.length?`<strong>${picks.length} / 6 odabira</strong><span>Maksimalno iz ovog kola: <b>${total.toFixed(2)} pts</b></span>`:'<strong>Još nema odabira</strong><span>Odaberi 1 / X / 2 za svaki par te najbolju i najgoru ekipu kola.</span>';
}
async function predictorAuth(key){
  const r=await fetch('/api/predictor/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});
  const raw=await r.text();let data=null;try{data=JSON.parse(raw)}catch{}
  if(!r.ok||!data?.ok||!data?.user)throw new Error(`AUTH_${r.status}:${raw.slice(0,120)}`);return data;
}
async function predictorGate(){
  const gate=qs('#predictorGate'),form=qs('#predictorLoginForm'),input=qs('#predictorKey'),err=qs('#predictorLoginError'),identity=qs('#predictorIdentity');
  const unlock=user=>{gate.classList.add('unlocked');gate.style.display='none';gate.setAttribute('aria-hidden','true');identity.hidden=false;identity.innerHTML=`<span>Igraš kao</span><strong>${esc(user.manager)}</strong><small>${esc(user.team)}</small><button type="button" id="predictorLogout">Odjava</button>`;qs('#predictorLogout').onclick=()=>{localStorage.removeItem('skylux-predictor-key');location.reload()}};
  const saved=localStorage.getItem('skylux-predictor-key');if(saved){try{const x=await predictorAuth(saved);unlock(x.user);return x.user}catch{localStorage.removeItem('skylux-predictor-key')}}
  gate.classList.remove('unlocked');input.focus();
  return new Promise(resolve=>{form.addEventListener('submit',async e=>{e.preventDefault();err.textContent='';const key=input.value.trim();if(!key)return;const btn=form.querySelector('button');btn.disabled=true;btn.textContent='PROVJERAVAM…';try{const x=await predictorAuth(key);localStorage.setItem('skylux-predictor-key',key);unlock(x.user);resolve(x.user)}catch(ex){console.error('Predictor auth:',ex);err.textContent=ex.message.startsWith('AUTH_401')?'Ključ nije ispravan.':`Greška prijave: ${ex.message}`}finally{btn.disabled=false;btn.textContent='ULAZ'}},{once:false})});
}
async function initPredictor(){
  const predictorUser=await predictorGate();
  const shown=homeGwDisplay(),gw=shown.gw,entries=entryMap(),matches=matchesForGw(gw),host=qs('#predictorMatches'),teams=qs('#predictorTeams');
  state.currentGw=gw;qs('#predictorGw').textContent=`GW${gw}`;
  const ev=currentEventInfo(gw),deadline=qs('#predictorDeadline');if(deadline)deadline.textContent=ev.deadline_time?`Zaključavanje: ${dateHr(ev.deadline_time)} · ${timeHr(ev.deadline_time)}`:'Odabiri se zaključavaju prije početka kola.';
  if(!matches.length){host.innerHTML='<div class="empty">Parovi za ovo kolo još nisu dostupni.</div>'}else{
    host.innerHTML=matches.map((m,i)=>{const a=entries.get(num(m.league_entry_1)),b=entries.get(num(m.league_entry_2)),v=predictorMatchValues(num(m.league_entry_1),num(m.league_entry_2)),market=`match-${i}`;return `<article class="predictor-card" data-market="${market}"><div class="predictor-match-head"><span>MEČ ${i+1}</span><strong>${esc(a?.team||'—')} <i>vs</i> ${esc(b?.team||'—')}</strong></div><div class="predictor-options"><button class="predictor-option" data-value="${num(m.league_entry_1)}" data-label="${esc(a?.team||'1')}" data-mult="${v.a}"><b>1</b><span>${esc(a?.team||'—')}</span><em>${v.a.toFixed(2)}x</em></button><button class="predictor-option draw" data-value="X" data-label="X" data-mult="${v.x}"><b>X</b><span>Neriješeno</span><em>${v.x.toFixed(2)}x</em></button><button class="predictor-option" data-value="${num(m.league_entry_2)}" data-label="${esc(b?.team||'2')}" data-mult="${v.b}"><b>2</b><span>${esc(b?.team||'—')}</span><em>${v.b.toFixed(2)}x</em></button></div></article>`}).join('');
  }
  const tv=predictorTeamValues(),teamOptions=(kind)=>tv.map(t=>`<button class="predictor-team-option" data-value="${t.id}" data-label="${esc(t.team)}" data-mult="${t[kind].toFixed(2)}"><span>${esc(t.team)}</span><em>${t[kind].toFixed(2)}x</em></button>`).join('');
  teams.innerHTML=`<article class="predictor-card predictor-special" data-market="best"><div class="predictor-match-head"><span>BONUS</span><strong>Najbolja ekipa kola</strong></div><div class="predictor-team-grid">${teamOptions('best')}</div></article><article class="predictor-card predictor-special" data-market="worst"><div class="predictor-match-head"><span>BONUS</span><strong>Najgora ekipa kola</strong></div><div class="predictor-team-grid">${teamOptions('worst')}</div></article>`;
  qsa('.predictor-option,.predictor-team-option').forEach(btn=>btn.addEventListener('click',()=>{const box=btn.closest('[data-market]');predictorChoice(box.dataset.market,btn.dataset.value,btn.dataset.label,num(btn.dataset.mult));qsa('.predictor-team-option',box).forEach(x=>x.classList.toggle('selected',x===btn))}));
  qsa('[data-market]').forEach(box=>{const raw=localStorage.getItem(predictorPickKey(gw,box.dataset.market));if(raw)try{const p=JSON.parse(raw);qsa('.predictor-option,.predictor-team-option',box).forEach(x=>x.classList.toggle('selected',x.dataset.value===String(p.value)))}catch{}});
  drawPredictorSummary();
  const locked=Boolean(ev.deadline_time&&Date.now()>=Date.parse(ev.deadline_time)) && !(gw===6 && predictorUser?.team==='Oranje');
  if(locked){
    qsa('.predictor-option,.predictor-team-option').forEach(btn=>{btn.disabled=true;btn.setAttribute('aria-disabled','true');btn.style.cursor='not-allowed';});
  }
  const submit=qs('#predictorSubmit'),slip=qs('#predictorSlip');
  if(locked){submit.hidden=true;submit.disabled=true;}
  const marketTitle=m=>m.startsWith('match-')?`Meč ${num(m.split('-')[1])+1}`:m==='best'?'Najbolja ekipa kola':'Najgora ekipa kola';
  const drawSlip=async()=>{
    const rows=[];
    qsa('[data-market]').forEach(box=>{const raw=localStorage.getItem(predictorPickKey(gw,box.dataset.market));if(raw)try{rows.push({market:box.dataset.market,...JSON.parse(raw)})}catch{}});
    if(rows.length!==6){slip.hidden=false;slip.innerHTML='<strong>Prognoza nije potpuna</strong><span>Odaberi svih 6 prognoza prije potvrde.</span>';return}
    const key=localStorage.getItem('skylux-predictor-key')||'';
    submit.disabled=true;submit.textContent='SPREMANJE...';
    try {
      const response=await fetch('/api/predictor/picks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,gw,picks:rows})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'Spremanje nije uspjelo.');
      localStorage.setItem(`skylux-predictor-submitted:${gw}`,'1');
    } catch(error) {
      slip.hidden=false;slip.innerHTML=`<strong>Prognoza nije spremljena</strong><span>${esc(error.message)}</span>`;
      submit.disabled=false;submit.textContent='POTVRDI PROGNOZE';return;
    }
    submit.disabled=false;
    slip.hidden=false;slip.innerHTML=`<div class="predictor-slip-head"><div><span>TVOJE PROGNOZE</span><strong>GW${gw} · 6/6 potvrđeno</strong></div><small>Možeš mijenjati odabire do zaključavanja kola.</small></div><div class="predictor-slip-list">${rows.map(p=>`<button type="button" data-edit-market="${esc(p.market)}"><span>${marketTitle(p.market)}</span><strong>${esc(p.label)}</strong><em>${num(p.mult).toFixed(2)}x</em></button>`).join('')}</div>`;
    qsa('[data-edit-market]',slip).forEach(btn=>btn.onclick=()=>{const box=qs(`[data-market="${btn.dataset.editMarket}"]`);if(box){box.scrollIntoView({behavior:'smooth',block:'center'});box.classList.add('predictor-editing');setTimeout(()=>box.classList.remove('predictor-editing'),1200)}});
    if(!locked)submit.textContent='AŽURIRAJ PROGNOZE';
  };
  submit.onclick=locked?null:drawSlip;
  const key=localStorage.getItem('skylux-predictor-key')||'';
  if(key)fetch('/api/predictor/mine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,gw})}).then(r=>r.ok?r.json():null).then(data=>{
    if(!data?.picks?.picks?.length)return;
    data.picks.picks.forEach(p=>{localStorage.setItem(predictorPickKey(gw,p.market),JSON.stringify(p));const box=qs(`[data-market="${p.market}"]`);if(box)qsa('.predictor-option,.predictor-team-option',box).forEach(x=>x.classList.toggle('selected',x.dataset.value===String(p.value)))});
    drawPredictorSummary();
    slip.hidden=false;slip.innerHTML='<strong>Prognoze su spremljene na serveru.</strong><span>Možeš ih pregledati i ažurirati do deadlinea.</span>';
    if(!locked)submit.textContent='AŽURIRAJ PROGNOZE';
  }).catch(()=>{});

  const reveal=qs('#predictorReveal');
  if(reveal)fetch(`/api/predictor/reveal?gw=${gw}`).then(async r=>{if(r.status===403)return null;if(!r.ok)throw new Error();return r.json()}).then(data=>{if(!data)return;const entries=data.entries||[];reveal.innerHTML=entries.length?entries.map(e=>`<details class="predictor-manager"><summary><strong>${esc(e.team)}</strong><span>${esc(e.manager)}</span><em>${e.picks.length}/6</em></summary><div class="predictor-manager-picks">${e.picks.map(p=>`<div><span>${marketTitle(p.market)}</span><strong>${esc(p.label)}</strong><em>${num(p.mult).toFixed(2)}x</em></div>`).join('')||'<span>Nema predanih prognoza.</span>'}</div></details>`).join(''):'<div class="empty">Nitko nije predao prognoze za ovo kolo.</div>'}).catch(()=>{});
}

async function initMini(){const s=qs('#miniSelect'),blocks=[{id:1,start:1,end:7,label:'GW 1–7'},{id:2,start:8,end:14,label:'GW 8–14'},{id:3,start:15,end:21,label:'GW 15–21'},{id:4,start:22,end:28,label:'GW 22–28'},{id:5,start:29,end:35,label:'GW 29–35'}],available=blocks.filter(b=>b.start<=state.currentGw),shown=available.length?available:[blocks[0]],cur=blockForGw(state.currentGw);s.innerHTML=shown.map(b=>`<option value="${b.id}">Mini ${b.id} · ${b.label}</option>`).join('');s.value=String(shown.some(b=>b.id===cur.id)?cur.id:shown[shown.length-1].id);const draw=()=>{const id=num(s.value,1),b=blocks.find(x=>x.id===id)||shown[0],through=Math.min(state.currentGw,b.end);qs('#miniPageTitle').textContent=`Mini-prvenstvo ${b.id}`;qs('#miniPageRange').textContent=b.label;qs('#miniProgress').textContent=state.currentGw>b.end?'Završeno':`Trenutno GW${state.currentGw}`;renderMiniTable('#miniPageTable',b,through,false)};s.addEventListener('change',draw);draw()}
async function drawFixtures(gw){const host=qs('#fixtureGrid'),entries=entryMap(),ms=matchesForGw(gw);qs('#fixturesTitle').textContent=`GW ${gw}`;if(!ms.length){host.innerHTML='<div class="empty">Nema H2H parova za odabrano kolo.</div>';return}const live=lineupsAvailableForGw(gw)&&num(gw)===num(state.currentGw)?await getLive(gw):null;const rows=await Promise.all(ms.map(async m=>({m,scores:await getDisplayedMatchScores(m,gw,live,entries)})));host.innerHTML=rows.map(({m,scores})=>{const a=entries.get(num(m.league_entry_1))||{team:'—',manager:'—'},b=entries.get(num(m.league_entry_2))||{team:'—',manager:'—'},st=liveStatusForGw(gw,m);return`<a class="fixture-card" href="${matchUrl(m)}"><div class="fixture-row"><div class="fixture-team"><strong>${esc(a.team)}</strong><small>${esc(a.manager)}</small></div><div class="fixture-score">${scores.a} : ${scores.b}</div><div class="fixture-team"><strong>${esc(b.team)}</strong><small>${esc(b.manager)}</small></div></div><div class="fixture-meta"><span class="badge ${st.cls}">${st.label}</span><span>Otvori postave →</span></div></a>`}).join('')}
async function initFixtures(){const s=qs('#gwSelect');s.innerHTML=Array.from({length:38},(_,i)=>`<option value="${i+1}">GW ${i+1}</option>`).join('');s.value=String(state.currentGw);s.addEventListener('change',()=>drawFixtures(num(s.value,state.currentGw)));await drawFixtures(state.currentGw)}
async function initMatch(){const p=new URLSearchParams(location.search),gw=num(p.get('gw'),state.currentGw),aId=num(p.get('a'),-1),bId=num(p.get('b'),-1),entries=entryMap(),a=entries.get(aId),b=entries.get(bId);if(!a||!b){qs('#matchPage').innerHTML='<div class="notice">Meč nije pronađen. Vrati se na Fixtures & Results.</div>';return}const m=matchesForGw(gw).find(x=>(num(x.league_entry_1)===aId&&num(x.league_entry_2)===bId)||(num(x.league_entry_1)===bId&&num(x.league_entry_2)===aId));qs('#matchGw').textContent=`GW ${gw}`;qs('#matchTeamA').innerHTML=`<a class="team-link" href="/team.html?id=${encodeURIComponent(aId)}"><strong>${esc(a.team)}</strong></a><span>${esc(a.manager)}</span>`;qs('#matchTeamB').innerHTML=`<a class="team-link" href="/team.html?id=${encodeURIComponent(bId)}"><strong>${esc(b.team)}</strong></a><span>${esc(b.manager)}</span>`;const st=liveStatusForGw(gw,m);qs('#matchStatus').textContent=st.label;qs('#matchStatus').className=`badge ${st.cls}`;if(!lineupsAvailableForGw(gw)){qs('#matchScore').textContent='— : —';const message='<div class="empty">Postave trenutno nisu dostupne.</div>';qs('#squadA').innerHTML=message;qs('#squadB').innerHTML=message;return}const live=await getLive(gw),[sa,sb]=await Promise.all([getSquadSnapshot(a,gw,live),getSquadSnapshot(b,gw,live)]);const isFinal=Boolean(m?.finished)||gw<state.currentGw;if(isFinal&&m){const ah=num(m.league_entry_1)===aId;qs('#matchScore').textContent=`${ah?num(m.league_entry_1_points):num(m.league_entry_2_points)} : ${ah?num(m.league_entry_2_points):num(m.league_entry_1_points)}`}else qs('#matchScore').textContent=`${sa.total} : ${sb.total}`;await Promise.all([renderSquad(qs('#squadA'),a,gw,live,sa),renderSquad(qs('#squadB'),b,gw,live,sb)])}
function startLiveRefresh(page){if(!['home','fixtures','match'].includes(page))return;setInterval(async()=>{try{if(page==='home'){const shown=homeGwDisplay();state.liveCache.delete(shown.gw);setGlobalGw();await renderMatchCards('#homeMatches',shown.gw)}if(page==='fixtures'){state.liveCache.delete(state.currentGw);const s=qs('#gwSelect');if(num(s?.value,state.currentGw)===state.currentGw)await drawFixtures(state.currentGw)}if(page==='match'){state.liveCache.delete(state.currentGw);const p=new URLSearchParams(location.search);if(num(p.get('gw'),state.currentGw)===state.currentGw)await initMatch()}}catch(e){console.warn('Live refresh failed',e)}},45000)}
async function boot(){normalizeLabels();initNav();setActiveNav();try{await loadCore();setGlobalGw();const p=document.body.dataset.page;if(p==='home')await initHome();if(p==='league')await initLeague();if(p==='team')await initTeam();if(p==='predictor')await initPredictor();if(p==='mini')await initMini();if(p==='fixtures')await initFixtures();if(p==='match')await initMatch();if(p==='editorial')renderLatestNews('#editorialNews',99);if(p==='fame')renderHallOfFame();if(p==='shame')renderShame('#shameGrid');startLiveRefresh(p)}catch(e){console.error(e);showToast('FPL Draft API trenutno nije dostupan.',true);qsa('[data-loading]').forEach(x=>x.textContent='Podaci trenutno nisu dostupni.')}}
boot();