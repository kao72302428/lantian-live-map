/* 商圈店家互動程式。原始157筆資料保持不動；第二層分類在顯示層合併，方便長期維護。 */
(() => {
  const data = Array.isArray(window.MERCHANTS) ? window.MERCHANTS : [];
  const list = document.getElementById('list');
  const hint = document.getElementById('hint');
  const mapbox = document.getElementById('mapbox');
  const search = document.getElementById('search');
  const subfilters = document.getElementById('subfilters');
  let group = '全部';
  let sub = '全部';

  const SUB_RULES = {
    '美食餐飲': [
      ['正餐料理', /日式|韓式|義式|俄式|港式|台日西式|台式|餐廳|餐飲|複合餐飲|鐵板料理|自助餐|快餐|丼飯|日式豬排|牛排/],
      ['鍋物燒烤', /火鍋|鍋物|燒肉|串燒|居酒屋|熱炒|海鮮|牛排\/鍋物/],
      ['小吃麵食', /小吃|麵食|鍋燒|海鮮鍋燒|鍋貼|水餃|熟食|便當/],
      ['早餐輕食', /早餐|咖啡\/輕食/],
      ['飲品咖啡', /飲料|咖啡|麵食\/飲料/],
      ['甜點冰品', /冰品|點心/]
    ],
    '購物零售': [
      ['超商量販', /便利商店|超市|量販/],
      ['3C通訊', /3C通訊/],
      ['服飾配件', /服飾|服飾配件|帽類|珠寶/],
      ['生活百貨', /生活百貨|文具|雜貨|零售/]
    ],
    '居家服務': [
      ['居家修繕', /五金|裝潢五金|建材|窗簾/],
      ['家具家居', /家具/],
      ['房屋服務', /房仲/]
    ],
    '醫療保健': [
      ['診所醫療', /內科|兒科|過敏|親子診所|耳鼻喉科|牙醫/],
      ['藥局中藥', /藥局|中藥行/],
      ['寵物醫療', /動物醫院/]
    ],
    '生活服務': [
      ['美容美髮', /美髮|理髮|美容|養生/],
      ['汽機車服務', /汽車|汽車美容|洗車|鍍膜|機車|機車維修/],
      ['寵物服務', /寵物店|寵物美容|寵物店\/美容/],
      ['洗衣修鞋', /洗衣|修鞋/],
      ['停車物流', /停車|停車場|物流取件/],
      ['其他服務', /公司辦公室/]
    ],
    '教育休閒': [
      ['公園休閒', /公園/],
      ['親子遊樂', /娃娃機|遊樂/],
      ['教育補習', /補習班/]
    ]
  };

  function displaySub(x){
    const rules=SUB_RULES[x.group]||[];
    const hit=rules.find(([,pattern])=>pattern.test(x.sub||''));
    return hit ? hit[0] : (x.sub||'其他');
  }

  function resetMap(){
    document.querySelectorAll('.card').forEach(c=>c.classList.remove('sel'));
    hint.textContent='商圈店家地圖｜點選左側商家查看位置';
    mapbox.innerHTML='<iframe id="map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q='+encodeURIComponent('藍田高大特區 高雄 楠梓')+'&output=embed"></iframe>';
  }

  function renderSubs(){
    if(group==='全部'){subfilters.innerHTML='';sub='全部';return;}
    const configured=(SUB_RULES[group]||[]).map(([label])=>label);
    const actual=[...new Set(data.filter(x=>x.group===group).map(displaySub))];
    const subs=[...configured.filter(x=>actual.includes(x)), ...actual.filter(x=>!configured.includes(x)).sort()];
    subfilters.innerHTML='<button data-sub="全部" class="active">全部</button>'+subs.map(x=>'<button data-sub="'+x+'">'+x+'</button>').join('');
    subfilters.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{
      sub=btn.dataset.sub;
      subfilters.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn));
      resetMap();render();
    });
  }

  function filtered(){
    const q=(search?.value||'').trim().toLowerCase();
    return data.filter(x=>(group==='全部'||x.group===group)&&(sub==='全部'||displaySub(x)===sub)&&(!q||`${x.name} ${x.address} ${x.sub} ${displaySub(x)} ${x.area}`.toLowerCase().includes(q)));
  }

  function render(){
    const rows=filtered();
    list.innerHTML=rows.map(x=>`<article class="card" data-id="${x.id}"><div class="name">${x.name}</div><div><span class="tag">${displaySub(x)}</span></div><div class="meta">${x.address||''}</div></article>`).join('') || '<div class="card">目前沒有符合的店家</div>';
    list.querySelectorAll('.card[data-id]').forEach(card=>card.onclick=()=>{
      const x=data.find(v=>v.id===card.dataset.id); if(!x)return;
      document.querySelectorAll('.card').forEach(c=>c.classList.toggle('sel',c===card));
      hint.textContent=x.name+'｜'+x.address;
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