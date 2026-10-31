(()=>{
const LIFF_ID='2011802000-aDp14e0D';
const API='https://lantian-live-map.vercel.app/api/news-admin';
const MEDIA_UPLOAD_API='https://lantian-live-map.vercel.app/api/news-media-upload';
const BLOB_CLIENT='https://esm.sh/@vercel/blob@2.8.2/client?bundle';
const IMAGE_SOURCE_MAX=15*1024*1024;
const IMAGE_UPLOAD_MAX=5*1024*1024;
const VIDEO_UPLOAD_MAX=20*1024*1024;
let idToken='';
let items=[];
const ADMIN_PAGE_SIZE=20;
let adminPage=1;
let versionSha='',busy=false;
const SESSION_TOKEN='lantianAdminIdToken';
let reverifyBtn=null;

const $=id=>document.getElementById(id);
const fields=['date','title','summary','content','imageFile','image','videoFile','video','map','link','linkText','published'];
const E=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function setEnabled(enabled){
 busy=!enabled;
 document.querySelectorAll('#list button').forEach(el=>el.disabled=!enabled);
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
 if(busy)return;
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
   video:$('video').value.trim(),
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
   body:JSON.stringify({idToken,action,expectedSha:versionSha,...extra})
 });
 const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.ok){
   const err=new Error(data.code||'REQUEST_FAILED');
   err.code=data.code||'REQUEST_FAILED';
   throw err;
 }
 return data;
}

function renderAdminPagination(total){
 const pages=Math.max(1,Math.ceil(total/ADMIN_PAGE_SIZE));
 adminPage=Math.min(Math.max(1,adminPage),pages);
 const el=$('adminPagination');
 if(!el)return;
 if(total<=ADMIN_PAGE_SIZE){el.innerHTML='';return;}
 let html='<button type="button" data-page="'+(adminPage-1)+'" '+(adminPage===1?'disabled':'')+'>上一頁</button>';
 for(let p=1;p<=pages;p++)html+='<button type="button" data-page="'+p+'" class="'+(p===adminPage?'active':'')+'">'+p+'</button>';
 html+='<button type="button" data-page="'+(adminPage+1)+'" '+(adminPage===pages?'disabled':'')+'>下一頁</button><span class="page-info">第 '+adminPage+' / '+pages+' 頁，共 '+total+' 則</span>';
 el.innerHTML=html;
}
function render(){
 const rows=[...items].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 $('count').textContent=`${rows.length} 則消息`;
 const pages=Math.max(1,Math.ceil(rows.length/ADMIN_PAGE_SIZE));
 adminPage=Math.min(adminPage,pages);
 const start=(adminPage-1)*ADMIN_PAGE_SIZE;
 const visible=rows.slice(start,start+ADMIN_PAGE_SIZE);
 $('list').innerHTML=visible.length?visible.map(x=>`
  <article class="news-item ${x.published===false?'is-unpublished':''}" data-id="${E(x.id)}">
   <div class="news-meta"><span class="news-date">${E(x.date)}</span><span class="state ${x.published===false?'off':'on'}">${x.published===false?'未公開':'公開中'}</span></div>
   <div class="news-title">${E(x.title)}</div>
   <div class="news-summary">${E(x.summary)}</div>
   <div class="item-actions">
    ${x.published!==false?`<a href="./news-detail.html?id=${encodeURIComponent(String(x.id))}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 14px;border-radius:12px;background:#eaf3f8;color:#526a7c;font-weight:800;text-decoration:none">查看內頁</a>`:'<span style="align-self:center;color:#718493">未公開：發布後可查看內頁</span>'}
    <button type="button" data-action="edit">修改</button>
    <button type="button" data-action="toggle">${x.published===false?'重新發布':'下架'}</button>
    <button type="button" data-action="delete" class="danger">刪除</button>
   </div>
  </article>`).join(''):'<div class="empty">目前沒有消息</div>';
 renderAdminPagination(rows.length);
}

function editItem(item){
 if(busy)return;
 $('id').value=item.id||'';
 $('date').value=item.date||'';
 $('title').value=item.title||'';
 $('summary').value=item.summary||'';
 $('content').value=item.content||'';
 $('image').value=item.image||'';
 $('video').value=item.video||'';
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
 versionSha=data.sha||'';
 render();
}

function imageError(file){
 if(!file)return '';
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))return '圖片僅支援 JPG、PNG 或 WebP。';
 if(!file.size)return '圖片檔案為空。';
 if(file.size>IMAGE_SOURCE_MAX)return '圖片原檔超過 15 MB。';
 return '';
}
function videoError(file){
 if(!file)return '';
 if(!['video/mp4','video/webm'].includes(file.type))return '影片僅支援 MP4 或 WebM。';
 if(!file.size)return '影片檔案為空。';
 if(file.size>VIDEO_UPLOAD_MAX)return '影片超過 20 MB。';
 return '';
}
function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>{
 canvas.toBlob(blob=>blob?resolve(blob):reject(Object.assign(new Error('IMAGE_COMPRESS_FAILED'),{code:'IMAGE_COMPRESS_FAILED'})),type,quality);
});}
async function optimizeImage(file){
 if(file.size<=IMAGE_UPLOAD_MAX)return file;
 if(typeof createImageBitmap!=='function')throw Object.assign(new Error('IMAGE_COMPRESS_UNSUPPORTED'),{code:'IMAGE_COMPRESS_UNSUPPORTED'});
 const bitmap=await createImageBitmap(file);
 let scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
 let width=Math.max(1,Math.round(bitmap.width*scale));
 let height=Math.max(1,Math.round(bitmap.height*scale));
 const canvas=document.createElement('canvas');
 const ctx=canvas.getContext('2d');
 if(!ctx)throw Object.assign(new Error('IMAGE_COMPRESS_FAILED'),{code:'IMAGE_COMPRESS_FAILED'});
 const qualities=[.86,.78,.70,.62,.54];
 let blob=null;
 for(let round=0;round<4;round++){
   canvas.width=width;canvas.height=height;
   ctx.clearRect(0,0,width,height);
   ctx.drawImage(bitmap,0,0,width,height);
   for(const quality of qualities){
     blob=await canvasBlob(canvas,'image/webp',quality);
     if(blob.size<=IMAGE_UPLOAD_MAX)break;
   }
   if(blob&&blob.size<=IMAGE_UPLOAD_MAX)break;
   width=Math.max(1,Math.round(width*.8));
   height=Math.max(1,Math.round(height*.8));
 }
 bitmap.close?.();
 if(!blob||blob.size>IMAGE_UPLOAD_MAX)throw Object.assign(new Error('IMAGE_COMPRESS_FAILED'),{code:'IMAGE_COMPRESS_FAILED'});
 const base=String(file.name||'image').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._-]+/g,'-')||'image';
 return new File([blob],base+'.webp',{type:'image/webp',lastModified:Date.now()});
}
function safeFileName(name){
 return String(name||'file').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'file';
}
async function uploadMedia(file,kind,onProgress){
 const mod=await import(BLOB_CLIENT);
 const prefix=kind==='image'?'news-images':'news-videos';
 return mod.upload(prefix+'/'+Date.now()+'-'+safeFileName(file.name),file,{
   access:'public',
   handleUploadUrl:MEDIA_UPLOAD_API,
   clientPayload:JSON.stringify({idToken}),
   multipart:kind==='video'&&file.size>10*1024*1024,
   onUploadProgress:progress=>onProgress?.(Math.round(progress.percentage||0))
 });
}
if($('imageFile'))$('imageFile').addEventListener('change',()=>{
 const file=$('imageFile').files?.[0];
 const err=imageError(file);
 if(err){$('imageFile').value='';if($('imageFileStatus'))$('imageFileStatus').textContent=err;return;}
 if($('imageFileStatus'))$('imageFileStatus').textContent=file?`已選擇：${file.name}（${Math.ceil(file.size/1024)} KB）`:'';
});
if($('videoFile'))$('videoFile').addEventListener('change',()=>{
 const file=$('videoFile').files?.[0];
 const err=videoError(file);
 if(err){$('videoFile').value='';if($('videoFileStatus'))$('videoFileStatus').textContent=err;return;}
 if($('videoFileStatus'))$('videoFileStatus').textContent=file?`已選擇：${file.name}（${Math.ceil(file.size/1024)} KB）`:'';
});

async function saveItem(published){
 if(busy)return;
 const item=getFormItem(published);
 const file=$('imageFile')?.files?.[0];
 const videoFile=$('videoFile')?.files?.[0];
 const fileError=imageError(file);
 const videoFileError=videoError(videoFile);
 if(fileError||videoFileError){$('formMessage').hidden=false;$('formMessage').textContent=fileError||videoFileError;return;}
 if(!item.date||!item.title||!item.summary||!item.content){
   $('formMessage').hidden=false;
   $('formMessage').textContent='日期、標題、摘要、完整內容為必填。';
   return;
 }
 setEnabled(false);
 $('formMessage').hidden=false;
 $('formMessage').textContent='儲存中…';
 try{
   if(file){
     $('formMessage').textContent=file.size>IMAGE_UPLOAD_MAX?'圖片壓縮中…':'圖片上傳中…';
     const optimized=await optimizeImage(file);
     if($('imageFileStatus'))$('imageFileStatus').textContent=optimized!==file?`已自動壓縮：${Math.ceil(optimized.size/1024)} KB`:'圖片準備上傳。';
     const uploaded=await uploadMedia(optimized,'image',pct=>{$('formMessage').textContent=`圖片上傳中… ${pct}%`;});
     item.image=uploaded.url;
     $('image').value=uploaded.url;
     if($('imageFileStatus'))$('imageFileStatus').textContent='圖片已上傳。';
   }
   if(videoFile){
     $('formMessage').textContent='影片上傳中…';
     const uploaded=await uploadMedia(videoFile,'video',pct=>{$('formMessage').textContent=`影片上傳中… ${pct}%`;});
     item.video=uploaded.url;
     $('video').value=uploaded.url;
     if($('videoFileStatus'))$('videoFileStatus').textContent='影片已上傳。';
   }
   $('formMessage').textContent='消息儲存中…';
   const data=await api('upsert',{item});
   items=data.items||[];
 versionSha=data.sha||'';
   render();
   setEnabled(true);
   resetForm();
   $('formMessage').hidden=false;
   $('formMessage').textContent=published?'已儲存並發布。':'已儲存為未公開。';
 }catch(e){
   $('formMessage').hidden=false;
   $('formMessage').textContent=e.code==='STALE_DATA'?'資料已被其他管理員更新，本次未儲存。請先保留編輯內容，再重新整理後確認最新資料。':e.code==='STORAGE_NOT_CONFIGURED'?'後端儲存尚未設定。':e.code==='IMAGE_COMPRESS_UNSUPPORTED'?'此瀏覽器無法自動壓縮圖片，請改用較小圖片。':e.code==='IMAGE_COMPRESS_FAILED'?'圖片自動壓縮失敗，請改用較小圖片。':'儲存失敗，請稍後再試。';
 }finally{setEnabled(true);}
}

$('newsForm').addEventListener('submit',e=>{e.preventDefault();saveItem(true);});
$('saveDraftBtn').addEventListener('click',()=>saveItem(false));
$('newBtn').addEventListener('click',resetForm);
$('adminPagination')?.addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(!b||b.disabled)return;adminPage=Number(b.dataset.page)||1;render();});
$('list').addEventListener('click',async e=>{
 const btn=e.target.closest('button[data-action]');
 if(!btn||busy)return;
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
 versionSha=data.sha||'';
   }else if(action==='delete'){
     const data=await api('delete',{id:item.id});
     items=data.items||[];
 versionSha=data.sha||'';
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
function reverify(){
 clearToken();
 setEnabled(false);
 location.href=new URL('./admin.html?reauth=1',window.location.href).href;
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