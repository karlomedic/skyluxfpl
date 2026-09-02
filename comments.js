(function(){
  if(document.body.dataset.articlePage!=='true')return;

  const postId=new URLSearchParams(location.search).get('id');
  if(!postId||!/^[0-9]+$/.test(postId))return;

  const form=document.querySelector('#commentForm');
  const author=document.querySelector('#commentAuthor');
  const body=document.querySelector('#commentBody');
  const website=document.querySelector('#commentWebsite');
  const submit=document.querySelector('#commentSubmit');
  const status=document.querySelector('#commentStatus');
  const count=document.querySelector('#commentCount');
  const list=document.querySelector('#commentsList');
  if(!form||!author||!body||!submit||!status||!count||!list)return;

  try{author.value=localStorage.getItem('skylux-comment-author')||''}catch{}

  function formatDate(value){
    const d=new Date(Number(value));
    if(Number.isNaN(d.getTime()))return'';
    return new Intl.DateTimeFormat('hr-HR',{
      day:'2-digit',month:'2-digit',year:'numeric'
    }).format(d);
  }

  function render(items){
    const comments=Array.isArray(items)?items:[];
    count.textContent=String(comments.length);
    list.replaceChildren();
    if(!comments.length){
      const empty=document.createElement('div');
      empty.className='comments-empty';
      empty.textContent='Još nema komentara. Otvori raspravu.';
      list.appendChild(empty);
      return;
    }
    comments.forEach(item=>{
      const card=document.createElement('article');
      card.className='comment-item';

      const head=document.createElement('div');
      head.className='comment-item-head';
      const name=document.createElement('strong');
      name.textContent=String(item.author||'Anonimno');
      const time=document.createElement('time');
      time.dateTime=new Date(Number(item.created_at)||Date.now()).toISOString();
      time.textContent=formatDate(item.created_at);
      head.append(name,time);

      const text=document.createElement('p');
      text.textContent=String(item.body||'');

      card.append(head,text);
      list.appendChild(card);
    });
  }

  async function loadComments(){
    try{
      const r=await fetch(`/api/comments/${postId}`,{cache:'no-store',headers:{Accept:'application/json'}});
      if(!r.ok)throw new Error(`Comments ${r.status}`);
      const data=await r.json();
      render(data.comments);
    }catch(e){
      console.error('Comments load error',e);
      list.innerHTML='<div class="comments-empty error">Komentari trenutno nisu dostupni.</div>';
    }
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const name=author.value.replace(/\s+/g,' ').trim();
    const text=body.value.trim();
    if(name.length<2){status.textContent='Upiši ime.';author.focus();return}
    if(!text){status.textContent='Napiši komentar.';body.focus();return}
    if(text.length>1000){status.textContent='Komentar je predugačak.';return}

    submit.disabled=true;
    submit.textContent='Objavljujem…';
    status.textContent='';
    try{
      const r=await fetch(`/api/comments/${postId}`,{
        method:'POST',
        headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({author:name,body:text,website:website?.value||''})
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||'Komentar nije spremljen.');
      try{localStorage.setItem('skylux-comment-author',name)}catch{}
      body.value='';
      status.textContent='Komentar je objavljen.';
      await loadComments();
    }catch(err){
      status.textContent=err.message||'Komentar nije spremljen.';
    }finally{
      submit.disabled=false;
      submit.textContent='Objavi komentar';
    }
  });

  loadComments();
})();
