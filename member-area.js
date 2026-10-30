(function(){
'use strict';
if(location.origin==='https://kao72302428.github.io'){
 location.replace('https://lantian-live-map.vercel.app/vision.html');return;
}
let busy=false;
async function request(action,data){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch('/api/members/'+action,{method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:controller.signal});
  let result;try{result=await response.json();}catch{throw Error('後端未回傳有效結果，請稍後確認。');}
  if(!response.ok||result.ok!==true)throw Object.assign(Error(result.message||'操作未完成，請稍後再試。'),{code:result.code});
  return result;
 }catch(e){if(e.name==='AbortError')throw Error('連線逾時，結果尚未確認；請先嘗試登入確認，勿重複送出註冊。');if(e instanceof TypeError)throw Error('網路連線失敗，請稍後確認或重試。');throw e;}
 finally{clearTimeout(timeout);}
}
function lock(value){busy=value;for(const b of document.querySelectorAll('button'))b.disabled=value;}

const M=window.LantianMembers;
const $=id=>document.getElementById(id);
const IDLE=30*60*1000;
let verifyTimer,verifying=false,idleTimer,activitySyncTimer,sessionLimits=null,lastInputAt=0,lastSyncAt=0,syncing=false,authEpoch=0;
const idleChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('lantian-member-activity'):null;
function publish(data){idleChannel?.postMessage(data);}
function stopIdle(){clearTimeout(verifyTimer);clearTimeout(idleTimer);clearTimeout(activitySyncTimer);sessionLimits=null;authEpoch++;}
function limitAt(){return Math.min(lastInputAt+IDLE,sessionLimits.idleExpiresAt,sessionLimits.sessionExpiresAt);}
function armIdle(){
 clearTimeout(idleTimer);if(!sessionLimits)return;
 idleTimer=setTimeout(checkIdle,Math.max(0,limitAt()-Date.now()));
}
function returnToLogin(message){stopIdle();goChoices();$('loginPanel').hidden=false;$('loginMessage').textContent=message;}
function expireIdle(){
 if(!sessionLimits)return;
 returnToLogin('閒置已達 30 分鐘或登入期限已到，請重新登入。');publish({type:'logout'});
 // The server enforces its own deadline even if this request cannot reach it.
 request('logout',{}).catch(()=>{});
}
function checkIdle(){if(sessionLimits){if(Date.now()>=limitAt())expireIdle();else armIdle();}}
function startIdle(result){
 if(!Number.isFinite(result.idleExpiresAt)||!Number.isFinite(result.sessionExpiresAt))throw Error('登入期限未確認，請重新登入。');
 sessionLimits={idleExpiresAt:result.idleExpiresAt,sessionExpiresAt:result.sessionExpiresAt};lastInputAt=Date.now();lastSyncAt=0;armIdle();armVerify();
}
async function recordActivity(event){
 if(!sessionLimits||!event?.isTrusted||document.visibilityState!=='visible')return;
 if(Date.now()>=limitAt()){expireIdle();return;}
 lastInputAt=Date.now();publish({type:'activity',at:lastInputAt});armIdle();
 syncActivity();
}
async function syncActivity(){
 if(!sessionLimits)return;
 if(Date.now()>=limitAt()){expireIdle();return;}
 const wait=15000-(Date.now()-lastSyncAt);
 if(syncing||wait>0){clearTimeout(activitySyncTimer);activitySyncTimer=setTimeout(syncActivity,Math.max(1000,wait));return;}
 syncing=true;lastSyncAt=Date.now();const epoch=authEpoch;
 try{
  const result=await request('activity',{});
  if(epoch!==authEpoch||!sessionLimits)return;
  if(!Number.isFinite(result.idleExpiresAt)||!Number.isFinite(result.sessionExpiresAt))return;
  sessionLimits={idleExpiresAt:result.idleExpiresAt,sessionExpiresAt:result.sessionExpiresAt};publish({type:'limits',...sessionLimits});armIdle();
 }catch(e){if(epoch===authEpoch&&['SESSION_EXPIRED','UNAUTHENTICATED'].includes(e.code))returnToLogin('登入已逾時，請重新登入。');}
 finally{syncing=false;}
}
for(const type of ['pointerdown','keydown','wheel','touchstart','touchmove','input'])document.addEventListener(type,recordActivity,{passive:true});
function armVerify(){clearTimeout(verifyTimer);if(sessionLimits)verifyTimer=setTimeout(verifyServer,60000);}
async function verifyServer(){
 if(!sessionLimits||verifying)return;checkIdle();if(!sessionLimits)return;
 verifying=true;const epoch=authEpoch;
 try{
  const result=await request('me');if(epoch!==authEpoch||!sessionLimits)return;
  if(Number.isFinite(result.idleExpiresAt)&&Number.isFinite(result.sessionExpiresAt)){
   sessionLimits={idleExpiresAt:result.idleExpiresAt,sessionExpiresAt:result.sessionExpiresAt};checkIdle();
  }
 }catch(e){if(epoch===authEpoch&&['SESSION_EXPIRED','UNAUTHENTICATED'].includes(e.code)){returnToLogin('登入已逾時，請重新登入。');publish({type:'logout'});}}
 finally{verifying=false;armVerify();}
}
function resumeSession(){checkIdle();if(document.visibilityState==='visible')verifyServer();}
document.addEventListener('visibilitychange',resumeSession);window.addEventListener('pageshow',resumeSession);
if(idleChannel)idleChannel.onmessage=event=>{
 const m=event.data;if(!sessionLimits||!m)return;
 if(m.type==='logout'){returnToLogin('登入已結束，請重新登入。');return;}
 if(m.type==='activity'&&Number.isFinite(m.at)&&m.at<=Date.now()&&m.at>lastInputAt)lastInputAt=m.at;
 if(m.type==='limits'&&Number.isFinite(m.idleExpiresAt)&&Number.isFinite(m.sessionExpiresAt))sessionLimits={idleExpiresAt:m.idleExpiresAt,sessionExpiresAt:m.sessionExpiresAt};
 armIdle();
};

let memberType='';
const imageUrls=new Map();
function el(tag,text,className){
 const node=document.createElement(tag);
 if(text!==undefined)node.textContent=text;
 if(className)node.className=className;
 return node;
}
function clearImages(){for(const url of imageUrls.values())URL.revokeObjectURL(url);imageUrls.clear();}
function clearCurrent(){
 clearImages();$('memberForm').reset();$('formSections').replaceChildren();$('identitySection').replaceChildren();$('previewContent').replaceChildren();$('formMessage').textContent='';
}
function goChoices(){
 clearCurrent();memberType='';$('registration').hidden=true;$('memberPreview').hidden=true;$('memberChoices').hidden=false;
 document.querySelector('h1').textContent='選擇您的會員類別';
 document.querySelector('[data-member-type]').focus();
}
function drawField(f){
 const credential=f.type;
 if(credential==='reserved')f={...f,type:'text',note:'本階段只提供 Email＋密碼。'};
 if(credential==='password-reserved')f={...f,type:'password',note:'至少 8 碼，最多 72 bytes；請勿使用證號或生日。'};
 const wrap=el('div',undefined,'field'+(['checkbox','textarea'].includes(f.type)?' wide':''));
 const id='member-'+f.key;
 const label=el('label',undefined,f.type==='checkbox'?'check-label':'');
 label.htmlFor=id;
 const text=el('span',f.label,'field-title');
 if(f.required)text.append(el('span',f.type.includes('reserved')?'必填預留':'必填','required'));
 let input;
 if(f.type==='select'){
  input=el('select');input.append(new Option('請選擇',''));
  for(const option of f.options)input.append(new Option(option,option));
 }else if(f.type==='textarea'){input=el('textarea');input.rows=4;}
 else{input=el('input');input.type=f.type==='reserved'?'text':f.type==='password-reserved'?'password':f.type;}
 input.id=id;input.name=f.key;
 if(credential==='reserved'){input.value='Email＋密碼';input.readOnly=true;}
 if(credential==='password-reserved'){input.minLength=8;input.maxLength=72;input.autocomplete='new-password';}
 if(f.type.includes('reserved')){input.disabled=true;input.placeholder=f.type==='reserved'?'尚未啟用':'密碼欄位尚未啟用';}
 else input.required=f.required;
 if(f.placeholder)input.placeholder=f.placeholder;
 if(f.chineseOnly){input.maxLength=20;input.autocomplete='name';input.title='僅限中文姓名';}
 if(f.type==='month')input.max=new Date().toISOString().slice(0,7);
 if(f.type==='tel')input.inputMode='tel';
 if(f.type==='text')input.maxLength=f.key==='shopDescription'?1000:200;
 if(f.type==='textarea')input.maxLength=2000;
 if(f.type==='checkbox'){
  label.append(input,text);wrap.append(label);
  if(['termsAccepted','privacyAccepted'].includes(f.key)){
   const btn=el('button','查看內容','policy-link');
   btn.type='button';
   const target=f.key==='termsAccepted'?'termsPolicy':'privacyPolicy';
   btn.addEventListener('click',()=>{
    const details=$(target);if(!details)return;details.open=true;details.scrollIntoView({behavior:'smooth',block:'center'});
   });
   wrap.append(btn);
  }
 }
 else{label.append(text);wrap.append(label,input);}
 if(f.note){const hint=el('small',f.note,'help');hint.id=id+'-help';input.setAttribute('aria-describedby',hint.id);wrap.append(hint);}
 if(f.type==='file'){
  input.accept='image/jpeg,image/png,image/webp';
  const hint=el('small','僅本頁圖片預覽，2.5 MB 內 JPG／PNG／WebP；不會上傳。','help');
  hint.id=id+'-help';input.setAttribute('aria-describedby',hint.id);
  const preview=el('img',undefined,'photo-preview');preview.hidden=true;preview.alt=f.label+'預覽';
  input.addEventListener('change',()=>{
   if(imageUrls.has(f.key)){URL.revokeObjectURL(imageUrls.get(f.key));imageUrls.delete(f.key);}
   preview.hidden=true;preview.removeAttribute('src');
   const file=input.files[0],error=M.fileError(file);
   $('formMessage').textContent=error;
   if(error){input.value='';return;}
   if(file){const url=URL.createObjectURL(file);imageUrls.set(f.key,url);preview.src=url;preview.hidden=false;}
  });
  wrap.append(hint,preview);
 }
 return wrap;
}
function selectType(type){
 if(!M.schemas[type])return;
 clearCurrent();memberType=type;
 $('memberChoices').hidden=true;$('memberPreview').hidden=true;$('registration').hidden=false;
 $('typeBadge').className='badge '+type;$('typeBadge').textContent=M.schemas[type].icon+' '+M.schemas[type].entryLabel;
 $('formTitle').textContent=M.schemas[type].entryLabel+'註冊欄位';
 document.querySelector('h1').textContent='會員註冊';
 const set=el('fieldset'),grid=el('div',undefined,'form-grid');
 set.append(el('legend',type==='business'?'店家會員申請':'一般會員註冊'));
 for(const f of M.registrationFieldsFor(type))grid.append(drawField(f));
 set.append(grid);$('formSections').append(set);
  $('formTitle').focus();
}
function readFields(){
 const data={};
 for(const f of M.registrationFieldsFor(memberType)){
  if(['reserved','password-reserved','file'].includes(f.type))continue;
  const input=$('member-'+f.key);data[f.key]=f.type==='checkbox'?input.checked:input.value;
 }
 return data;
}
function addPair(list,label,value){list.append(el('dt',label),el('dd',value));}
function showMember(member){
 const host=$('previewContent');host.replaceChildren();
 const heading=el('h2','會員中心');heading.id='previewTitle';heading.tabIndex=-1;
 host.append(heading,el('h3',member.name,'profile-name'),el('span',M.schemas[member.memberType].icon+' '+(member.memberType==='business'?'免費店家會員':M.schemas[member.memberType].memberLabel),'badge '+member.memberType));
 if(member.memberType==='business')host.append(el('p','免費店家會員｜'+member.shopName,'profile-shop'));
 const list=el('dl');addPair(list,'會員方案','免費會員');
 const status={pending:'待處理',active:'正常',suspended:'停權',disabled:'停用'};
 for(const [label,value] of [[member.memberType==='business'?'聯絡人姓名':'姓名',member.name],['Email',member.email],['手機',member.mobile],['會員編號',member.memberId],['會員狀態',status[member.memberStatus]||member.memberStatus],['註冊時間',member.registeredAt?new Date(member.registeredAt).toLocaleString('zh-TW'):'—'],['最後登入時間',member.lastLoginAt?new Date(member.lastLoginAt).toLocaleString('zh-TW'):'—'],])addPair(list,label,value);
 if(member.memberType==='business'){
  addPair(list,'店家綁定狀態',member.shopBound?'已綁定':'未綁定');
 }
 host.append(list);clearImages();$('memberForm').reset();$('loginForm').reset();
 $('memberPreview').hidden=false;$('registration').hidden=true;$('memberChoices').hidden=true;$('loginPanel').hidden=true;heading.focus();
}
async function refreshMember(){const epoch=authEpoch,result=await request('me');if(epoch!==authEpoch)return;startIdle(result);showMember(result.member);}
for(const button of document.querySelectorAll('[data-member-type]'))button.addEventListener('click',()=>selectType(button.dataset.memberType));
$('changeType').addEventListener('click',goChoices);
$('clearForm').addEventListener('click',()=>selectType(memberType));


$('memberForm').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!$('memberForm').reportValidity())return;
 const data=readFields(),errors=M.validateRegistration(memberType,data);
 if(errors.length){$('formMessage').textContent=errors.join('\n');return;}
 data.memberType=memberType;data.password=$('member-password').value;
 lock(true);$('formMessage').textContent='註冊送出中…';
 try{
  const response=await request('register',data);
  if(!response.member?.memberId)throw Error('註冊結果不完整，請先嘗試登入確認。');
  const email=data.email;goChoices();$('loginPanel').hidden=false;$('loginEmail').value=email;
  $('loginMessage').textContent='註冊成功，已加入免費會員，請使用 Email 與密碼登入。';$('loginEmail').focus();
 }catch(e){$('formMessage').textContent=e.message;}
 finally{data.password='';if($('member-password'))$('member-password').value='';lock(false);}
});
$('loginForm').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!$('loginForm').reportValidity())return;lock(true);$('loginMessage').textContent='登入中…';
 try{await request('login',{email:$('loginEmail').value,password:$('loginPassword').value});await refreshMember();$('loginMessage').textContent='';}
 catch(e){$('loginMessage').textContent=e.message;}finally{$('loginPassword').value='';lock(false);}
});
$('logoutButton').addEventListener('click',async()=>{
 if(busy)return;lock(true);
 try{await request('logout',{});returnToLogin('已登出');publish({type:'logout'});}
 catch(e){$('authNotice').textContent='登出未確認：'+e.message;}finally{lock(false);}
});
refreshMember().catch(()=>{});
$('memberForm').addEventListener('invalid',()=>{$('formMessage').textContent='請確認必填欄位、Email 格式及條款／隱私權勾選。';},true);
window.addEventListener('pagehide',clearImages);
})();


