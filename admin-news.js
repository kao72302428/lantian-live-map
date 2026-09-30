(()=>{
const list=document.getElementById('list');
const count=document.getElementById('count');
const E=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function render(items){
 const rows=[...items].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 count.textContent=`${rows.length} 則消息`;
 list.innerHTML=rows.length?rows.map(x=>`
  <article class="news-item">
   <div class="news-date">${E(x.date)}</div>
   <div class="news-title">${E(x.title)}</div>
   <div class="news-summary">${E(x.summary)}</div>
   <div class="item-actions">
    <button type="button" disabled>修改</button>
    <button type="button" disabled>下架</button>
    <button type="button" disabled>刪除</button>
   </div>
  </article>`).join(''):'<div class="empty">目前沒有消息</div>';
}
fetch('./news.json?v='+Date.now())
 .then(r=>{if(!r.ok)throw new Error('load failed');return r.json()})
 .then(render)
 .catch(()=>{count.textContent='載入失敗';list.innerHTML='<div class="empty">無法讀取 news.json，請稍後再試。</div>';});
})();
