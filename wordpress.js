(function(){
  const WP_LINK_SELECTOR='a[href*="fplskylux.wordpress.com"]';
  let postsPromise=null;

  function htmlText(value=''){
    const box=document.createElement('div');
    box.innerHTML=String(value||'');
    return (box.textContent||box.innerText||'').replace(/\s+/g,' ').trim();
  }

  function escapeHtml(value=''){
    return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }

  function formatDate(value){
    if(!value)return'';
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return String(value);
    return new Intl.DateTimeFormat('hr-HR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
  }

  function articleType(title){
    const t=title.toLowerCase();
    if(t.includes('preview'))return'Preview';
    if(t.includes('recap'))return'Recap';
    if(t.includes('waiver'))return'Waiver';
    if(t.includes('intervju'))return'Intervju';
    return'Redakcija';
  }

  async function fetchPosts(){
    if(!postsPromise){
      postsPromise=fetch('/api/articles',{cache:'no-store',headers:{Accept:'application/json'}})
        .then(r=>{if(!r.ok)throw new Error(`WordPress ${r.status}`);return r.json()})
        .then(v=>Array.isArray(v)?v:[])
        .catch(e=>{postsPromise=null;throw e});
    }
    return postsPromise;
  }

  function removeLegacyBlogLinks(){
    document.querySelectorAll(WP_LINK_SELECTOR).forEach(a=>a.remove());
  }

  // Replace the original static article renderer before page.js boots.
  window.renderLatestNews=async function(target,count=3){
    const host=typeof target==='string'?document.querySelector(target):target;
    if(!host)return;
    host.innerHTML='<div class="loading">Dohvaćam tekstove…</div>';
    try{
      const posts=(await fetchPosts()).slice(0,count);
      if(!posts.length){host.innerHTML='<div class="empty">Redakcija priprema novi tekst.</div>';return}
      host.innerHTML=posts.map(post=>{
        const title=htmlText(post?.title?.rendered||post?.title||'Bez naslova');
        let excerpt=htmlText(post?.excerpt?.rendered||post?.excerpt||'');
        excerpt=excerpt.replace(/\s*\[…\]\s*$/,'').replace(/\s*\[&hellip;\]\s*$/,'');
        return `<a class="news-card" href="/article.html?id=${encodeURIComponent(post.id)}"><span class="news-type">${escapeHtml(articleType(title))}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(excerpt)}</p><div class="news-meta"><span>D. Olivari</span><span>${escapeHtml(formatDate(post.date))}</span></div></a>`;
      }).join('');
    }catch(e){
      console.error('WordPress posts error',e);
      host.innerHTML='<div class="empty">Članci trenutno nisu dostupni. Pokušaj ponovno za minutu.</div>';
    }
  };

  function sanitizeArticleHtml(html=''){
    const template=document.createElement('template');
    template.innerHTML=String(html||'');
    template.content.querySelectorAll('script,iframe,object,embed,form,input,button').forEach(n=>n.remove());
    template.content.querySelectorAll('*').forEach(el=>{
      [...el.attributes].forEach(attr=>{
        if(/^on/i.test(attr.name))el.removeAttribute(attr.name);
        if((attr.name==='href'||attr.name==='src')&&/^javascript:/i.test(attr.value.trim()))el.removeAttribute(attr.name);
      });
      if(el.tagName==='A'){
        el.setAttribute('target','_blank');
        el.setAttribute('rel','noopener noreferrer');
      }
      if(el.tagName==='IMG')el.setAttribute('loading','lazy');
    });
    return template.innerHTML;
  }

  async function initArticlePage(){
    if(document.body.dataset.articlePage!=='true')return;
    const host=document.querySelector('#articleBody');
    const titleEl=document.querySelector('#articleTitle');
    const metaEl=document.querySelector('#articleMeta');
    const id=new URLSearchParams(location.search).get('id');
    if(!id||!/^[0-9]+$/.test(id)){
      if(host)host.innerHTML='<div class="notice">Članak nije pronađen.</div>';
      return;
    }
    try{
      const r=await fetch(`/api/article/${id}`,{cache:'no-store',headers:{Accept:'application/json'}});
      if(!r.ok)throw new Error(`WordPress ${r.status}`);
      const post=await r.json();
      const title=htmlText(post?.title?.rendered||'Članak');
      document.title=`${title} · SkyLux FPL`;
      if(titleEl)titleEl.textContent=title;
      if(metaEl)metaEl.innerHTML=`<span>D. Olivari</span><span>${escapeHtml(formatDate(post.date))}</span>`;
      if(host)host.innerHTML=sanitizeArticleHtml(post?.content?.rendered||'');
    }catch(e){
      console.error('WordPress article error',e);
      if(host)host.innerHTML='<div class="notice">Članak trenutno nije dostupan.</div>';
    }
  }

  removeLegacyBlogLinks();
  initArticlePage();
})();