(function(){
  for(const href of ['/responsive.css','/mobile-v2.css']){
    if(!document.querySelector(`link[href="${href}"]`)){
      const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);
    }
  }

  const brandStyle=document.createElement('style');
  brandStyle.textContent='.brand-mark.has-logo{padding:0;background:transparent;box-shadow:none;overflow:hidden}.brand-mark.has-logo img{display:block;width:100%;height:100%;object-fit:contain;border-radius:8px}';
  document.head.appendChild(brandStyle);

  function brandImageUrl(node){
    if(typeof node==='string'&&/^https?:\/\//i.test(node))return node;
    if(Array.isArray(node)){
      for(let i=node.length-1;i>=0;i--){const found=brandImageUrl(node[i]);if(found)return found}
      return'';
    }
    if(node&&typeof node==='object'){
      for(const key of ['img','url','URL','src']){
        const v=node[key];if(typeof v==='string'&&/^https?:\/\//i.test(v))return v;
      }
      for(const v of Object.values(node)){const found=brandImageUrl(v);if(found)return found}
    }
    return'';
  }

  async function applySkyLuxBrand(){
    try{
      const r=await fetch('/api/site-brand',{cache:'no-store',headers:{Accept:'application/json'}});
      if(!r.ok)return;
      const site=await r.json();
      const src=brandImageUrl(site.logo)||brandImageUrl(site.icon);
      if(!src)return;
      document.querySelectorAll('.brand-mark').forEach(mark=>{
        mark.classList.add('has-logo');
        mark.innerHTML=`<img src="${src.replaceAll('&','&amp;').replaceAll('"','&quot;')}" alt="SkyLux">`;
      });
    }catch(e){console.warn('SkyLux logo nije dohvaćen',e)}
  }
  applySkyLuxBrand();

  const nav=document.querySelector('#mainNav');
  if(nav&&!nav.querySelector('a[href="/about.html"]')){
    const link=document.createElement('a');
    link.href='/about.html';link.dataset.nav='about';link.textContent='O nama';
    const blog=[...nav.querySelectorAll('a')].find(a=>a.textContent.trim().startsWith('Blog'));
    nav.insertBefore(link,blog||null);
  }

  if(document.body.dataset.page==='about'){
    document.querySelectorAll('.archive-copy > span').forEach(x=>x.textContent='IZ ARHIVE');
    const tokic=document.querySelector('#robert-tokic');
    if(tokic){
      const role=tokic.querySelector('.manager-role');
      if(role)role.textContent='The Special One · novinar · prvak 2020/21 i 2023/24';
      const copy=tokic.querySelector('.manager-copy');
      if(copy&&!copy.querySelector('.tokic-journalist')){
        const p=document.createElement('p');
        p.className='tokic-journalist';
        p.textContent='Uz sve to je i novinar, što Special Oneu daje rijetku prednost: ne mora samo pobijediti utakmicu nego može unaprijed pripremiti i naslov priče. Kad Tekstilac dobije, ekskluziva je praktički već napisana; kad izgubi, urednički kut brzo pronađe nesretan splet okolnosti, ozljede i sumnjive odluke protivnika. Malo je managera koji istovremeno vode klub i vlastiti PR odjel.';
        copy.appendChild(p);
      }
    }
  }

  const loadPage=()=>{
    const s=document.createElement('script');
    s.src='/page.js';
    s.onerror=()=>{console.error('page.js se nije učitao');const t=document.querySelector('#toast');if(t){t.textContent='Aplikacija se nije učitala.';t.className='toast show error'}};
    document.head.appendChild(s);
  };

  const wp=document.createElement('script');
  wp.src='/wordpress.js';
  wp.onload=loadPage;
  wp.onerror=()=>{console.warn('WordPress integracija se nije učitala');loadPage()};
  document.head.appendChild(wp);
})();