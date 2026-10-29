const form=document.getElementById('gen'),out=document.getElementById('preview');
form.addEventListener('submit',e=>{
  e.preventDefault();
  const t=document.getElementById('idea').value.trim();
  if(!t)return;
  out.innerHTML='<p>Generating…</p>';
  setTimeout(()=>{
    out.textContent='';
    const c=document.createElement('div');
    c.className='clip';c.textContent=t;
    const p=document.createElement('p');
    p.textContent='Demo preview only — no real video is generated.';
    p.style.marginTop='12px';
    out.append(c,p);
  },900);
});
