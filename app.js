(function(){
  if(!document.querySelector('link[href="/responsive.css"]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='/responsive.css';document.head.appendChild(l);
  }
  const s=document.createElement('script');s.src='/page.js';s.defer=true;s.onerror=()=>{console.error('page.js se nije učitao');const t=document.querySelector('#toast');if(t){t.textContent='Aplikacija se nije učitala.';t.className='toast show error'}};document.head.appendChild(s);
})();