(function(){
  const BRAND_REPLACEMENTS=[
    ['SkyLux FPL Draft League','FantasyDraft League'],
    ['FPL Skylux League','FantasyDraft League'],
    ['FPL SkyLux League','FantasyDraft League'],
    ['SkyLux FPL','FantasyDraft'],
    ['FPL Skylux','FantasyDraft'],
    ['FPL SkyLux','FantasyDraft'],
    ['SkyLux','FantasyDraft'],
    ['Skylux','FantasyDraft']
  ];

  const MANAGER_REPLACEMENTS=[
    ['Petar Medić','Luka Marinović'],
    ['Marko Mihaljević','Mateo Kovačić'],
    ['Ante Babić','Filip Božić'],
    ['Ivan Vrdoljak','Andrej Radić'],
    ['Karlo Medić','Niko Marinović'],
    ['Jakov Vrdoljak','Lovro Radić'],
    ['Robert Tokić','Viktor Kovač'],
    ['Kristian Radoš','Bruno Orlić'],
    ['Marin Buneta','Dario Lovrić'],
    ['Martin Vukadin','Nikola Savić'],
    ['Mihaljević','Kovačić'],
    ['Vrdoljak','Radić'],
    ['Tokić','Kovač'],
    ['Radoš','Orlić'],
    ['Babić','Božić'],
    ['Medić','Marinović'],
    ['Buneta','Lovrić'],
    ['Vukadin','Savić']
  ];

  const ABOUT_FIRST_NAMES=[
    ['Petar','Luka'],['Marko','Mateo'],['Ante','Filip'],['Ivan','Andrej'],
    ['Karlo','Niko'],['Jakov','Lovro'],['Robert','Viktor'],['Kristian','Bruno']
  ];

  const ABOUT_CARDS={
    'petar-medic':{slug:'luka-marinovic',portrait:'portrait-luka-marinovic',name:'Luka Marinović'},
    'marko-mihaljevic':{slug:'mateo-kovacic',portrait:'portrait-mateo-kovacic',name:'Mateo Kovačić'},
    'ante-babic':{slug:'filip-bozic',portrait:'portrait-filip-bozic',name:'Filip Božić'},
    'ivan-vrdoljak':{slug:'andrej-radic',portrait:'portrait-andrej-radic',name:'Andrej Radić'},
    'karlo-medic':{slug:'niko-marinovic',portrait:'portrait-niko-marinovic',name:'Niko Marinović'},
    'jakov-vrdoljak':{slug:'lovro-radic',portrait:'portrait-lovro-radic',name:'Lovro Radić'},
    'robert-tokic':{slug:'viktor-kovac',portrait:'portrait-viktor-kovac',name:'Viktor Kovač'},
    'kristian-rados':{slug:'bruno-orlic',portrait:'portrait-bruno-orlic',name:'Bruno Orlić'}
  };

  const HOF_PORTRAITS={
    'Luka Marinović':'portrait-luka-marinovic',
    'Dario Lovrić':'portrait-dario-lovric',
    'Bruno Orlić':'portrait-bruno-orlic',
    'Viktor Kovač':'portrait-viktor-kovac',
    'Nikola Savić':'portrait-nikola-savic',
    'Mateo Kovačić':'portrait-mateo-kovacic',
    'Niko Marinović':'portrait-niko-marinovic'
  };

  function replaceString(value,pairs){
    let out=String(value||'');
    pairs.forEach(([from,to])=>{out=out.split(from).join(to)});
    return out;
  }

  function rewriteText(root,pairs){
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){
      const next=replaceString(root.nodeValue,pairs);
      if(next!==root.nodeValue)root.nodeValue=next;
      return;
    }
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      const parent=node.parentElement;
      if(parent&&parent.closest('script,style,noscript,textarea'))continue;
      const next=replaceString(node.nodeValue,pairs);
      if(next!==node.nodeValue)node.nodeValue=next;
    }
  }

  function rewriteBrand(root=document){rewriteText(root,BRAND_REPLACEMENTS)}
  function rewriteManagers(root,includeFirstNames=false){
    rewriteText(root,includeFirstNames?MANAGER_REPLACEMENTS.concat(ABOUT_FIRST_NAMES):MANAGER_REPLACEMENTS);
  }

  function loadSprite(){
    document.documentElement.style.setProperty('--manager-sprite','url("/assets/portfolio/managers-sprite-sharp.avif?v=20260903-6")');
  }

  function escapeHtml(value=''){
    return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }

  rewriteBrand(document);
  document.title=replaceString(document.title,BRAND_REPLACEMENTS);
  const desc=document.querySelector('meta[name="description"]');
  if(desc)desc.content=replaceString(desc.content,BRAND_REPLACEMENTS);
  const mark=document.querySelector('.brand-mark');if(mark)mark.textContent='FD';
  const brand=document.querySelector('.brand-copy strong');if(brand)brand.textContent='FantasyDraft';
  const brandSmall=document.querySelector('.brand-copy small');if(brandSmall)brandSmall.textContent='Fantasy League';

  if(typeof entryRecords==='function'){
    const baseEntryRecords=entryRecords;
    entryRecords=function(){
      return baseEntryRecords().map(entry=>entry?.profile?.name?{...entry,manager:entry.profile.name}:entry);
    };
  }

  if(document.body.dataset.page==='about'){
    const root=document.querySelector('.about-page');
    rewriteManagers(root,true);
    Object.entries(ABOUT_CARDS).forEach(([oldId,meta])=>{
      const card=document.getElementById(oldId);if(!card)return;
      const number=card.querySelector('.manager-number');
      if(number){
        number.dataset.number=number.textContent.trim();
        number.textContent='';
        number.classList.add('has-portrait',meta.portrait);
        number.setAttribute('role','img');
        number.setAttribute('aria-label',`AI portret managera ${meta.name}`);
        number.closest('.manager-top')?.classList.add('has-manager-portrait');
      }
      card.id=meta.slug;
    });
  }

  if(document.body.dataset.page==='fame'){
    const lead=document.querySelector('.page-head .page-lead');
    if(lead)lead.textContent='Svi prvaci FantasyDraft lige od 2017/18.';
  }

  if(typeof renderHallOfFame==='function'){
    renderHallOfFame=function(){
      const host=document.querySelector('#hofGrid');if(!host)return;
      const champs=(typeof asArray==='function'?asArray(state?.champions?.champions):[]).slice().reverse(),counts={};
      champs.forEach(c=>counts[c.winner]=(counts[c.winner]||0)+1);
      host.innerHTML=champs.map(c=>{
        const cls=HOF_PORTRAITS[c.winner]||'';
        const initials=String(c.winner||'').split(/\s+/).map(x=>x[0]).join('').slice(0,2);
        return `<article class="hof-card ${cls?'featured':''}">${counts[c.winner]>1?`<span class="hof-count">${counts[c.winner]}× prvak</span>`:''}<div class="hof-photo">${cls?`<div class="hof-portrait ${cls}" role="img" aria-label="AI portret ${escapeHtml(c.winner)}"></div>`:`<div class="hof-placeholder">${escapeHtml(initials)}</div>`}</div><div class="hof-info"><span class="hof-season">${escapeHtml(c.season)}</span><h3>${escapeHtml(c.winner)}</h3><p>${escapeHtml(c.team||'')}</p></div></article>`;
      }).join('');
    };
  }

  const editorialSelector='.article-page,#latestNews,.news-list,#editorialFeed,.editorial-grid';
  const observer=new MutationObserver(records=>{
    records.forEach(record=>record.addedNodes.forEach(node=>{
      if(node.nodeType!==Node.ELEMENT_NODE&&node.nodeType!==Node.TEXT_NODE)return;
      rewriteBrand(node);
      const el=node.nodeType===Node.ELEMENT_NODE?node:node.parentElement;
      if(el&&(el.closest?.(editorialSelector)||el.matches?.(editorialSelector)||el.querySelector?.(editorialSelector))){
        rewriteManagers(node,true);
      }
    }));
  });
  observer.observe(document.body,{childList:true,subtree:true});

  loadSprite();
})();
