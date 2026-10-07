(()=>{
const API='https://lantian-live-map.vercel.app/api/cases-admin';
const SESSION_TOKEN='lantianAdminIdToken';
let items=[];
const $=id=>document.getElementById(id);
const E=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function token(){try{return sessionStorage.getItem(SESSION_TOKEN)||'';}catch(e){return '';}}
function setMessage(text,error=false){$('caseMessage').textContent=text;$('caseMessage').classList.toggle('error',error);}
function setBusy(busy){$('loadBtn').disabled=busy||!token();document.querySelectorAll('.case-action').forEach(b=>b.disabled=busy);}
async function api(action,extra={}){
 const idToken=token();
 if(!idToken)throw Object.assign(new Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED'});
 const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken,action,...extra})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.ok)throw Object.assign(new Error(data.code||'REQUEST_FAILED'),{code:data.code||'REQUEST_FAILED'});
 return data;
}
function filtered(){
 const q=$('searchInput').value.trim().toLowerCase(), status=$('statusFilter').value;
 return items.filter(x=>{
  if(status&&x.status!==status)return false;
  if(!q)return true;
  return [x.id,x.submittedAt,x.type,x.name,x.phone,x.email,x.content,x.status,x.note].some(v=>String(v||'').toLowerCase().includes(q));
 });
}
function render(){
 const rows=filtered();
 $('caseCount').textContent=`顯示 ${rows.length}／${items.length} 件`;
 $('caseList').innerHTML=rows.length?rows.map(x=>`
 <article class="case-card" data-id="${E(x.id)}">
  <h3>${E(x.id)}｜${E(x.type)}</h3>
  <div class="case-meta">
   <div><b>送出時間：</b>${E(x.submittedAt)}</div><div><b>最後更新：</b>${E(x.updatedAt)}</div>
   <div><b>姓名：</b>${E(x.name)}</div><div><b>電話：</b>${E(x.phone)}</div>
   <div><b>Email：</b>${E(x.email)}</div><div><b>來源：</b>${E(x.source)}</div>
  </div>
  <div class="case-content">${E(x.content)}</div>
  ${x.photoUrl?`<a class="photo-link" href="${E(x.photoUrl)}" target="_blank" rel="noopener">查看附件照片</a>`:''}
  <div class="case-tools">
   <label>處理狀態<select class="status-select"><option ${x.status==='未處理'?'selected':''}>未處理</option><option ${x.status==='處理中'?'selected':''}>處理中</option><option ${x.status==='已完成'?'selected':''}>已完成</option></select></label>
   <div><b>目前承辦紀錄</b><div class="case-content">${E(x.note||'尚無')}</div></div>
   <label class="reply">新增回覆／承辦紀錄<textarea class="reply-text" rows="4" placeholder="輸入本次回覆內容；按「回覆案件」後會寄送到案件 Email，並寫入承辦紀錄。"></textarea></label>
  </div>
  <div class="case-actions"><button class="case-action status-btn" type="button">更新狀態</button><button class="case-action reply-btn" type="button">回覆案件</button></div>
 </article>`).join(''):'<div class="empty">沒有符合條件的案件。</div>';
}
async function load(){
 setBusy(true);setMessage('案件載入中…');
 try{const d=await api('list');items=d.items||[];render();setMessage('案件已載入。');}
 catch(e){setMessage(e.code==='AUTH_REQUIRED'?'管理員驗證已失效，請使用上方「重新驗證」。':'案件載入失敗：'+e.code,true);}
 finally{setBusy(false);}
}
async function act(btn,action){
 const card=btn.closest('.case-card'),id=card.dataset.id,status=card.querySelector('.status-select').value,reply=card.querySelector('.reply-text').value.trim();
 if(action==='reply'&&!reply){setMessage('請先輸入回覆內容。',true);return;}
 setBusy(true);setMessage(action==='reply'?'回覆送出中…':'狀態更新中…');
 try{
  const d=await api(action,{id,status,reply});
  items=d.items||items;
  render();
  setMessage(action==='reply'?'回覆已寄出並寫入承辦紀錄。':'案件狀態已更新。');
 }catch(e){setMessage('操作失敗：'+e.code,true);}
 finally{setBusy(false);}
}
$('loadBtn').addEventListener('click',load);
$('searchInput').addEventListener('input',render);
$('statusFilter').addEventListener('change',render);
$('caseList').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.classList.contains('status-btn'))act(b,'setStatus');if(b.classList.contains('reply-btn'))act(b,'reply');});

let checks=0;
const wait=setInterval(()=>{checks++;if(token()){clearInterval(wait);$('loadBtn').disabled=false;load();}else if(checks>30){clearInterval(wait);setMessage('管理員驗證已失效，請使用上方「重新驗證」。',true);}},200);
})();