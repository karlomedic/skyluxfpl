(function(){
  for(const href of ['/responsive.css','/mobile-v2.css']){
    if(!document.querySelector(`link[href="${href}"]`)){
      const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);
    }
  }

  const nav=document.querySelector('#mainNav');
  if(nav&&!nav.querySelector('a[href="/about.html"]')){
    const link=document.createElement('a');
    link.href='/about.html';link.dataset.nav='about';link.textContent='O nama';
    const blog=[...nav.querySelectorAll('a')].find(a=>a.textContent.trim().startsWith('Blog'));
    nav.insertBefore(link,blog||null);
  }

  const s=document.createElement('script');s.src='/page.js';s.defer=true;s.onerror=()=>{console.error('page.js se nije učitao');const t=document.querySelector('#toast');if(t){t.textContent='Aplikacija se nije učitala.';t.className='toast show error'}};document.head.appendChild(s);
})();