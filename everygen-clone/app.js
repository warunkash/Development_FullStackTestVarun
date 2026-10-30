const form=document.getElementById('gen'),out=document.getElementById('preview');
const FORMATS={
  'YouTube Shorts':{ratio:'9:16',len:'up to 60s',text:'Vertical, fast-paced clips built to loop.',pts:['Hook in the first 2 seconds','Auto captions','Music-ready cuts']},
  'AI ads':{ratio:'9:16 or 1:1',len:'15–30s',text:'Product-first spots with a clear call to action.',pts:['Product shots from a link or photo','Voiceover and CTA end card','Variants for A/B tests']},
  'UGC-style':{ratio:'9:16',len:'15–45s',text:'Creator-style talking videos that feel native to the feed.',pts:['Presenter-style delivery','Script + voice in one step','Casual, handheld look']},
  'Story':{ratio:'16:9 or 9:16',len:'30–90s',text:'Narrated scenes generated from a single idea.',pts:['Scene-by-scene storyboard','Consistent characters and style','Narration with captions']}
};
const state={model:'Model A',format:'YouTube Shorts'};
const detail=document.getElementById('format-detail');
function renderDetail(){
  const f=FORMATS[state.format];
  detail.textContent='';
  const h=document.createElement('h3');h.textContent=state.format;
  const p=document.createElement('p');p.textContent=f.text+' Aspect '+f.ratio+' · '+f.len+' · '+state.model;
  const ul=document.createElement('ul');
  f.pts.forEach(t=>{const li=document.createElement('li');li.textContent=t;ul.append(li)});
  detail.append(h,p,ul);
}
function pick(id,key,cls){
  const box=document.getElementById(id);
  box.addEventListener('click',e=>{
    const b=e.target.closest('.'+cls);if(!b)return;
    box.querySelectorAll('.'+cls).forEach(x=>x.classList.toggle('on',x===b));
    state[key]=b.dataset.v;renderDetail();
  });
}
pick('models','model','chip');pick('formats','format','tab');renderDetail();
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
    p.textContent=state.format+' · '+state.model+' — demo preview only, no real video is generated.';
    p.style.marginTop='12px';
    out.append(c,p);
  },900);
});
