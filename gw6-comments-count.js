(function(){
  const nodes=document.querySelectorAll('[data-gw6-comment-count]');
  if(!nodes.length)return;
  fetch('/api/comments/600006',{cache:'no-store',headers:{Accept:'application/json'}})
    .then(r=>{if(!r.ok)throw new Error('Comments '+r.status);return r.json()})
    .then(data=>{const count=Array.isArray(data.comments)?data.comments.length:0;nodes.forEach(el=>el.textContent=String(count))})
    .catch(err=>console.warn('GW6 comment count unavailable:',err));
})();
