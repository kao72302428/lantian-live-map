/* 商圈店家互動程式。資料由 merchants.js 提供 window.MERCHANTS。 */
(() => {
  const data = Array.isArray(window.MERCHANTS) ? window.MERCHANTS : [];
  const list = document.getElementById('list');
  const hint = document.getElementById('hint');
  const mapbox = document.getElementById('mapbox');
  const search = document.getElementById('search');
  const subfilters = document.getElementById('subfilters');
  let group = '全部';
  let sub = '全部';

  function resetMap(){
    document.querySelectorAll('.card').forEach(c=>c.classList.remove('sel'));
    hint.textContent='商圈店家地圖｜點選左側商家查看位置';
    mapbox.className='';
    mapbox.innerHTML='<iframe id="map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q='+encodeURIComponent('藍田高大特區 高雄 楠梓')+'&output=embed"></iframe>';
  }

  function renderSubs(){
    if(group==='全部'){subfilters.innerHTML='';sub='全部';return;}
    const subs=[...new Set(data.filter(x=>x.group===group).map(x=>x.sub).filter(Boolean))].sort();
    subfilters.innerHTML='<button data-sub="全部" class="active">全部</button>'+subs.map(x=>'<button data-sub="'+x+'">'+x+'</button>').join('');
    subfilters.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{
      sub=btn.dataset.sub;
      subfilters.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn));
      resetMap();render();
    });
  }

  function filtered(){
    const q=(search?.value||'').trim().toLowerCase();
    return data.filter(x=>(group==='全部'||x.group===group)&&(sub==='全部'||x.sub===sub)&&(!q||`${x.name} ${x.address} ${x.sub} ${x.area}`.toLowerCase().includes(q)));
  }

  function render(){
    const rows=filtered();
    list.innerHTML=rows.map(x=>`<article class="card" data-id="${x.id}"><div class="name">${x.name}</div><div><span class="tag">${x.sub||''}</span></div><div class="meta">${x.address||''}</div></article>`).join('') || '<div class="card">目前沒有符合的店家</div>';
    list.querySelectorAll('.card[data-id]').forEach(card=>card.onclick=()=>{
      const x=data.find(v=>v.id===card.dataset.id); if(!x)return;
      document.querySelectorAll('.card').forEach(c=>c.classList.toggle('sel',c===card));
      hint.textContent=x.name+'｜'+x.address;
      mapbox.className='';
      mapbox.innerHTML='<iframe id="map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q='+encodeURIComponent(x.name+' '+x.address+' 高雄')+'&output=embed"></iframe>';
    });
  }

  document.querySelectorAll('button[data-g]').forEach(btn=>btn.onclick=()=>{
    group=btn.dataset.g; sub='全部';
    document.querySelectorAll('button[data-g]').forEach(b=>b.classList.toggle('active',b===btn));
    renderSubs();resetMap();render();
  });
  if(search) search.oninput=()=>{resetMap();render();};
  document.querySelector('button[data-g="全部"]')?.classList.add('active');
  renderSubs();resetMap();render();
})();