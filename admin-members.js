(()=>{
'use strict';
const CANONICAL_MEMBER_ADMIN_URL='https://kao72302428.github.io/lantian-live-map/admin-members.html';
if(location.hostname.endsWith('.vercel.app')){
  location.replace(CANONICAL_MEMBER_ADMIN_URL);
  return;
}
const API='https://lantian-live-map.vercel.app/api/members-admin';
const SESSION_TOKEN='lantianAdminIdToken';
const $=id=>document.getElementById(id);
let items=[];

function token(){try{return sessionStorage.getItem(SESSION_TOKEN)||'';}catch{return '';}}
function text(value){return String(value??'');}
function fmtTime(value){
 if(!value)return '—';
 const d=new Date(value);
 return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Taipei'}).format(d):'—';
}
function stateLabel(value){
 return ({active:'正常',pending:'待驗證',suspended:'停權',disabled:'停用'})[value]||text(value)||'—';
}
function identityLabel(value){
 return ({existing:'既有店家',new:'新申請店家',application:'待判別申請'})[value]||text(value)||'—';
}
function el(tag,value,className){
 const node=document.createElement(tag);
 if(value!==undefined)node.textContent=value;
 if(className)node.className=className;
 return node;
}
function meta(label,value){
 const box=el('div');box.append(el('b',label+'：'),document.createTextNode(value));return box;
}
function matches(item){
 const type=$('memberTypeFilter').value,status=$('memberStatusFilter').value,q=$('searchInput').value.trim().toLowerCase();
 if(type&&item.memberType!==type)return false;
 if(status&&item.memberStatus!==status)return false;
 if(!q)return true;
 return [item.memberId,item.name,item.displayName,item.mobile,item.email,item.shopName].some(v=>text(v).toLowerCase().includes(q));
}
function render(){
 const rows=items.filter(matches),host=$('memberList');host.replaceChildren();
 $('memberCount').textContent=`顯示 ${rows.length}／${items.length} 筆已載入會員`;
 if(!rows.length){host.append(el('p','沒有符合條件的會員。','notice'));return;}
 for(const item of rows){
  const card=el('article',undefined,'member-row');
  const head=el('div',undefined,'member-row-head');
  const title=el('div');title.append(el('span',item.memberType==='business'?'🏪 店家會員':'👤 一般會員','badge '+item.memberType),el('h2',item.name||'未命名會員'));
  head.append(title,el('span',stateLabel(item.memberStatus),'status-chip'));
  const grid=el('div',undefined,'member-meta');
  const fields=[
   ['會員編號',item.memberId||'—'],['Email',item.email||'—'],['手機',item.mobile||'—'],
   ['顯示名稱',item.displayName||'—'],['註冊時間',fmtTime(item.registeredAt)],['最後登入',fmtTime(item.lastLoginAt)],
   ['Email 驗證',item.emailVerified?'已驗證':'未驗證'],['手機驗證',item.mobileVerified?'已驗證':'未驗證']
  ];
  if(item.memberType==='business')fields.push(
   ['店家名稱',item.shopName||'—'],['店家申請類型',identityLabel(item.shopIdentity)],
   ['店家綁定',item.shopBound?'已綁定':'未綁定'],['店家審核',item.shopReviewStatus||'—']
  );
  for(const [label,value] of fields)grid.append(meta(label,text(value)));
  card.append(head,grid);host.append(card);
 }
}
async function load(){
 const idToken=token();
 if(!idToken){
  location.replace('./admin.html?return=admin-members.html');
  return;
 }
 $('authStatus').textContent='管理員驗證中，正在載入會員資料…';
 try{
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken,action:'list'}),cache:'no-store'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.ok!==true){
   if(['INVALID_LINE_ID_TOKEN','NOT_AUTHORIZED','MISSING_ID_TOKEN'].includes(data.code)){
    try{sessionStorage.removeItem(SESSION_TOKEN);}catch{}
    location.replace('./admin.html?return=admin-members.html');return;
   }
   throw Error('會員資料目前無法載入（'+text(data.code||'REQUEST_FAILED')+'）。');
  }
  items=Array.isArray(data.items)?data.items:[];
  $('authStatus').textContent='管理員驗證成功。會員資料已從 Neon 以唯讀方式載入。';
  $('memberAdmin').hidden=false;
  render();
 }catch(e){$('authStatus').textContent=e.message||'會員資料載入失敗。';}
}
for(const id of ['searchInput','memberTypeFilter','memberStatusFilter']){
 const node=$(id);node.addEventListener(id==='searchInput'?'input':'change',render);
}
load();
})();
