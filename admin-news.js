(()=>{
const LIFF_ID='2011802000-aDp14e0D';
const API='https://lantian-live-map.vercel.app/api/news-admin';
let idToken='';
let items=[];
const SESSION_TOKEN='lantianAdminIdToken';
let reverifyBtn=null;

const $=id=>document.getElementById(id);
const fields=['date','title','summary','content','image','map','link','linkText','published'];
const E=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function setEnabled(enabled){
 fields.forEach(id=>{const el=$(id); if(el) el.disabled=!enabled;});
 $('newBtn').disabled=!enabled;
 $('saveDraftBtn').disabled=!enabled;
 $('publishBtn').disabled=!enabled;
}

function ensureReverifyButton(){
 if(reverifyBtn)return reverifyBtn;
 reverifyBtn=document.createElement('button');
 reverifyBtn.type='button';
 reverifyBtn.textContent='重新驗證';
 reverifyBtn.style.cssText='display:none;margin-top:12px;border:1px solid #b9cfdd;background:#fff;color:#0f5d9d;border-radius:999px;padding:9px 14px;font:inherit;font-weight:800;cursor:pointer';
 const host=$('authStatus')?.parentElement||document.querySelector('.gate');
 host?.appendChild(reverifyBtn);
 reverifyBtn.addEventListener('click',reverify);
 return reverifyBtn;
}
function showReverify(show){const b=ensureReverifyButton();if(b)b.style.display=show?'inline-block':'none';}
function cacheToken(token){try{if(token)sessionStorage.setItem(SESSION_TOKEN,token);}catch(e){console.warn(e);}}
function cachedToken(){try{return sessionStorage.getItem(SESSION_TOKEN)||'';}catch(e){return '';}}
function clearToken(){try{sessionStorage.removeItem(SESSION_TOKEN);}catch(e){console.warn(e);}}

function setAuth(ok,msg){
 $('authStatus').textContent=msg;
 $('authTitle').textContent=ok?'管理員驗證成功':'管理權限尚未啟用';
 $('authText').textContent=ok?'已通過 LINE 管理員白名單驗證，可進行消息新增、修改、下架、重新發布與刪除。':'驗證未完成前，本頁所有寫入操作維持鎖定。';
 setEnabled(ok);
 showReverify(!ok);
}

function resetForm(){
 $('newsForm').reset();
 $('id').value='';
 $('published').checked=true;
 $('formTitle').textContent='新增消息';
 $('formMessage').hidden=true;
}

function getFormItem(publishedOverride){
 return {
   id:$('id').value.trim()||undefined,
   date:$('date').value,
   title:$('title').value.trim(),
   summary:$('summary').value.trim(),
   content:$('content').value.trim(),
   image:$('image').value.trim(),
   map:$('map').value.trim(),
   link:$('link').value.trim(),
   linkText:$('linkText').value.trim(),
   published:typeof publishedOverride==='boolean'?publishedOverride:$('published').checked
 };
}

async function api(action,extra={}){
 const r=await fetch(API,{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({idToken,action,...extra})
 });
 const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.ok){
   const err=new Error(data.code||'REQUEST_FAILED');
   err.code=data.code||'REQUEST_FAILED';
   throw err;
 }
 return data;
}

function render(){
 const rows=[...items].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 $('count').textContent=`${rows.length} 則消息`;
 $('list').innerHTML=rows.length?rows.map(x=>`
  <article class="news-item ${x.published===false?'is-unpublished':''}" data-id="${E(x.id)}">
   <div class="news-meta"><span class="news-date">${E(x.date)}</span><span class="state ${x.published===false?'off':'on'}">${x.published===false?'未公開':'公開中'}</span></div>
   <div class="news-title">${E(x.title)}</div>
   <div class="news-summary">${E(x.summary)}</div>
   <div class="item-actions">
    <button type="button" data-action="edit">修改</button>
    <button type="button" data-action="toggle">${x.published===false?'重新發布':'下架'}</button>
    <button type="button" data-action="delete" class="danger">刪除</button>
   </div>
  </article>`).join(''):'<div class="empty">目前沒有消息</div>';
}

function editItem(item){
 $('id').value=item.id||'';
 $('date').value=item.date||'';
 $('title').value=item.title||'';
 $('summary').value=item.summary||'';
 $('content').value=item.content||'';
 $('image').value=item.image||'';
 $('map').value=item.map||'';
 $('link').value=item.link||'';
 $('linkText').value=item.linkText||'';
 $('published').checked=item.published!==false;
 $('formTitle').textContent='修改消息';
 window.scrollTo({top:0,behavior:'smooth'});
}

async function refresh(){
 $('count').textContent='載入中';
 const data=await api('list');
 items=data.items||[];
 render();
}

async function saveItem(published){
 const item=getFormItem(published);
 if(!item.date||!item.title||!item.summary||!item.content){
   $('formMessage').hidden=false;
   $('formMessage').textContent='日期、標題、摘要、完整內容為必填。';
   return;
 }
 setEnabled(false);
 $('formMessage').hidden=false;
 $('formMessage').textContent='儲存中…';
 try{
   const data=await api('upsert',{item});
   items=data.items||[];
   render();
   resetForm();
   $('formMessage').hidden=false;
   $('formMessage').textContent=published?'已儲存並發布。':'已儲存為未公開。';
 }catch(e){
   $('formMessage').hidden=false;
   $('formMessage').textContent=e.code==='STORAGE_NOT_CONFIGURED'?'後端儲存尚未設定。':'儲存失敗，請稍後再試。';
 }finally{setEnabled(true);}
}

$('newsForm').addEventListener('submit',e=>{e.preventDefault();saveItem(true);});
$('saveDraftBtn').addEventListener('click',()=>saveItem(false));
$('newBtn').addEventListener('click',resetForm);
$('list').addEventListener('click',async e=>{
 const btn=e.target.closest('button[data-action]');
 if(!btn)return;
 const card=btn.closest('.news-item');
 const item=items.find(x=>String(x.id)===card.dataset.id);
 if(!item)return;
 const action=btn.dataset.action;
 if(action==='edit'){editItem(item);return;}
 if(action==='delete'&&!confirm(`確定刪除「${item.title}」？刪除後前台也會移除。`))return;
 setEnabled(false);
 try{
   if(action==='toggle'){
     const data=await api('setPublished',{id:item.id,published:item.published===false});
     items=data.items||[];
   }else if(action==='delete'){
     const data=await api('delete',{id:item.id});
     items=data.items||[];
   }
   render();
 }catch(e){alert('操作失敗：'+(e.code||'請稍後再試'));}
 finally{setEnabled(true);}
});

async function loadWithToken(token){
 idToken=token;
 await refresh();
 cacheToken(token);
 setAuth(true,'管理員驗證成功');
}
async function reverify(){
 clearToken();
 setEnabled(false);
 try{
  await liff.init({liffId:LIFF_ID});
  if(liff.isLoggedIn())liff.logout();
  liff.login({redirectUri:window.location.href.split('#')[0]});
 }catch(e){
  console.error(e);
  setAuth(false,'無法啟動重新驗證，請返回管理中心登入。');
 }
}
async function init(){
 setEnabled(false);
 showReverify(false);
 const saved=cachedToken();
 if(saved){
  try{await loadWithToken(saved);return;}
  catch(e){console.warn(e);clearToken();}
 }
 try{
   await liff.init({liffId:LIFF_ID});
   if(!liff.isLoggedIn()){setAuth(false,'管理員驗證已失效，請按「重新驗證」');return;}
   const token=liff.getIDToken()||'';
   if(!token){setAuth(false,'管理員驗證已失效，請按「重新驗證」');return;}
   await loadWithToken(token);
 }catch(e){
   console.error(e);
   setAuth(false,e.code==='STORAGE_NOT_CONFIGURED'?'管理員已驗證，但後端儲存尚未設定':'管理員驗證已失效，請按「重新驗證」');
 }
}
if(window.liff)init(); else setAuth(false,'LINE LIFF SDK 載入失敗');
})();