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
    if(t.includes('oko osijekovo'))return'Oko Osijekovo';
    if(t.includes('preview'))return'Preview';
    if(t.includes('recap'))return'Recap';
    if(t.includes('waiver'))return'Waiver';
    if(t.includes('intervju'))return'Intervju';
    return'Redakcija';
  }

  function wpId(post){return post?.id??post?.ID}
  function wpTitle(post){return post?.title?.rendered??post?.title??'Bez naslova'}
  function wpExcerpt(post){return post?.excerpt?.rendered??post?.excerpt??''}
  function wpContent(post){return post?.content?.rendered??post?.content??''}
  function articleAuthor(post){
    const id=String(wpId(post));
    const title=htmlText(wpTitle(post)).toLowerCase();
    if(title.includes('oko osijekovo'))return'Mateo B.';
    if(id==='79'||id==='81'||id==='83'||id==='85'||id==='86')return'Robert M.';
    return'Davorin O.';
  }
  function normalizePosts(value){
    if(Array.isArray(value))return value;
    if(Array.isArray(value?.posts))return value.posts;
    return [];
  }

  async function fetchPosts(){
    if(!postsPromise){
      postsPromise=fetch('/api/articles',{cache:'no-store',headers:{Accept:'application/json'}})
        .then(async r=>{
          if(!r.ok){const text=await r.text().catch(()=>'');throw new Error(`WordPress ${r.status}${text?` · ${text.slice(0,120)}`:''}`)}
          return r.json();
        })
        .then(normalizePosts)
        .catch(e=>{postsPromise=null;throw e});
    }
    return postsPromise;
  }

  async function commentCount(id){
    try{
      const r=await fetch(`/api/comments/${encodeURIComponent(id)}`,{cache:'no-store',headers:{Accept:'application/json'}});
      if(!r.ok)return 0;
      const data=await r.json();
      return Array.isArray(data?.comments)?data.comments.length:0;
    }catch{return 0}
  }

  function removeLegacyBlogLinks(){
    document.querySelectorAll(WP_LINK_SELECTOR).forEach(a=>a.remove());
  }

  window.renderLatestNews=async function(target,count=3){
    const host=typeof target==='string'?document.querySelector(target):target;
    if(!host)return;
    const editorial=host.id==='editorialNews';
    const home=host.id==='latestNews';
    const limit=home?3:count;
    const staticCards=editorial
      ?[...document.querySelectorAll('.editorial-static-article')]
      :[...host.querySelectorAll('[data-gw9-recap-featured],[data-gw9-featured],[data-gw8-recap-featured],[data-gw8-featured],[data-gw7-featured],[data-gw6-featured]')];
    const staticDates={
      'gw9-recap.html':'2026-11-03',
      'gw9-preview.html':'2026-10-30',
      'gw8-recap.html':'2026-10-26',
      'gw8-preview.html':'2026-10-23',
      'gw7-preview.html':'2026-10-17',
      'gw6-recap.html':'2026-10-01'
    };
    const staticItems=staticCards.map(el=>{
      const href=el.getAttribute('href')||'';
      const file=href.split('/').pop();
      const date=el.dataset.published||staticDates[file]||'1970-01-01';
      return {date:Date.parse(date)||0,html:el.outerHTML};
    });
    const renderItems=items=>items.sort((a,b)=>b.date-a.date).slice(0,limit).map(x=>x.html).join('');
    host.innerHTML=renderItems(staticItems)+'<div class="loading">Dohvaćam tekstove…</div>';
    try{
      const posts=await fetchPosts();
      const candidates=editorial?posts:posts.slice(0,Math.max(limit,10));
      const counts=await Promise.all(candidates.map(post=>commentCount(wpId(post))));
      const postItems=candidates.map((post,index)=>{
        const id=wpId(post);
        const title=htmlText(wpTitle(post));
        let excerpt=htmlText(wpExcerpt(post));
        excerpt=excerpt.replace(/\\s*\\[…\\]\\s*$/,'').replace(/\\s*\\[&hellip;\\]\\s*$/,'');
        const html=`<a class="news-card" href="/article.html?id=${encodeURIComponent(id)}"><span class="news-type">${escapeHtml(articleType(title))}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(excerpt)}</p><div class="news-meta"><span>${escapeHtml(articleAuthor(post))}</span><span>${escapeHtml(formatDate(post.date))}</span><span>💬 ${counts[index]}</span></div></a>`;
        return {date:Date.parse(post.date||'1970-01-01')||0,html};
      });
      host.innerHTML=renderItems([...staticItems,...postItems])||'<div class="empty">Redakcija priprema novi tekst.</div>';
      if(editorial)staticCards.forEach(el=>el.remove());
      for(const [gw,id] of [[6,600006],[7,600007],[8,600008]]){
        const node=host.querySelector('[data-gw'+gw+'-comment-count]');
        if(!node)continue;
        commentCount(id).then(n=>{const live=host.querySelector('[data-gw'+gw+'-comment-count]');if(live)live.textContent=String(n)}).catch(()=>{});
      }
    }catch(e){
      console.error('WordPress posts error',e);
      host.innerHTML=renderItems(staticItems)||'<div class="empty">Članci trenutno nisu dostupni. Pokušaj ponovno za minutu.</div>';
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
      const [r,count]=await Promise.all([
        fetch(`/api/article/${id}`,{cache:'no-store',headers:{Accept:'application/json'}}),
        commentCount(id)
      ]);
      if(!r.ok){const text=await r.text().catch(()=>'');throw new Error(`WordPress ${r.status}${text?` · ${text.slice(0,120)}`:''}`)}
      const post=await r.json();
      const title=htmlText(wpTitle(post));
      document.title=`${title} · SkyLux FPL`;
      if(titleEl)titleEl.textContent=title;
      if(metaEl)metaEl.innerHTML=`<span>${escapeHtml(articleAuthor(post))}</span><span>${escapeHtml(formatDate(post.date))}</span><a href="#commentsTitle" aria-label="Idi na komentare" style="color:inherit;text-decoration:none;cursor:pointer">💬 ${count}</a>`;
      if(host)host.innerHTML=sanitizeArticleHtml(wpContent(post));
    }catch(e){
      console.error('WordPress article error',e);
      if(host)host.innerHTML='<div class="notice">Članak trenutno nije dostupan.</div>';
    }
  }

  removeLegacyBlogLinks();
  initArticlePage();
})();