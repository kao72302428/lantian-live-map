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
  if(!response.ok||result.ok!==true)throw Error(result.message||'操作未完成，請稍後再試。');
  return result;
 }catch(e){if(e.name==='AbortError')throw Error('連線逾時，結果尚未確認；請先嘗試登入確認，勿重複送出註冊。');if(e instanceof TypeError)throw Error('網路連線失敗，請稍後確認或重試。');throw e;}
 finally{clearTimeout(timeout);}
}
function lock(value){busy=value;for(const b of document.querySelectorAll('button'))b.disabled=value;}

const M=window.LantianMembers;
const $=id=>document.getElementById(id);
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
 if(f.type==='month')input.max=new Date().toISOString().slice(0,7);
 if(f.type==='tel')input.inputMode='tel';
 if(f.type==='text')input.maxLength=f.key==='shopDescription'?1000:200;
 if(f.type==='textarea')input.maxLength=2000;
 if(f.type==='checkbox'){label.append(input,text);wrap.append(label);}
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
function drawIdentity(){
 const set=el('fieldset'),legend=el('legend','店家身分類型（必填）'),grid=el('div',undefined,'form-grid');
 set.append(legend,el('p','請先選擇店家身分。註冊只建立待審核資料，不會自動取得店家管理權。'));
 for(const [value,title,note] of [
  ['existing','平台既有店家','進入既有店家綁定流程，待管理員核定；不新增或覆蓋店家。'],
  ['new','新申請店家','僅預留待審核店家申請，不會直接公開到高大好店家。']
 ]){
  const label=el('label',undefined,'radio-label'),radio=el('input'),text=el('span',undefined,'radio-text');
  radio.type='radio';radio.name='shopIdentity';radio.value=value;radio.required=true;
  text.append(el('strong',title),el('span',note,'help'));label.append(radio,text);grid.append(label);
 }
 set.append(grid);
 const binding=el('section',undefined,'binding');binding.id='existingBinding';binding.hidden=true;
 binding.append(el('h3','既有店家待綁定資料'),el('p','填寫欲綁定的店家識別資料，提交後等待後續管理員審核。店家 ID 仍以原平台資料為準，不會重編。'));
 const inputs=el('div',undefined,'form-grid');
 inputs.append(drawField({key:'existingShopId',label:'既有店家 ID（若已知）',type:'text',required:false}),drawField({key:'existingShopName',label:'待綁定的既有店家名稱',type:'text',required:true}));
 binding.append(inputs);set.append(binding);
 for(const radio of grid.querySelectorAll('input')){
  radio.addEventListener('change',()=>{
   const existing=radio.value==='existing'&&radio.checked;
   binding.hidden=!existing;
   for(const input of binding.querySelectorAll('input')){input.disabled=!existing;if(!existing)input.value='';}
  });
 }
 for(const input of binding.querySelectorAll('input'))input.disabled=true;
 $('identitySection').append(set);
}
function selectType(type){
 if(!M.schemas[type])return;
 clearCurrent();memberType=type;
 $('memberChoices').hidden=true;$('memberPreview').hidden=true;$('registration').hidden=false;
 $('typeBadge').className='badge '+type;$('typeBadge').textContent=M.schemas[type].icon+' '+M.schemas[type].entryLabel;
 $('formTitle').textContent=M.schemas[type].entryLabel+'註冊欄位';
 document.querySelector('h1').textContent='會員註冊';
 if(type==='business')drawIdentity();
 for(const section of M.schemas[type].sections){
  const set=el('fieldset'),grid=el('div',undefined,'form-grid');set.append(el('legend',section.title));
  for(const f of section.fields)grid.append(drawField(f));
  set.append(grid);$('formSections').append(set);
 }
 $('formTitle').focus();
}
function readFields(){
 const data={};
 for(const f of M.fieldsFor(memberType)){
  if(['reserved','password-reserved','file'].includes(f.type))continue;
  const input=$('member-'+f.key);data[f.key]=f.type==='checkbox'?input.checked:input.value;
 }
 if(memberType==='business'){
  data.shopIdentity=$('memberForm').querySelector('input[name=shopIdentity]:checked')?.value||'';
  data.existingShopId=$('member-existingShopId').value;
  data.existingShopName=$('member-existingShopName').value;
 }
 return data;
}
function addPair(list,label,value){list.append(el('dt',label),el('dd',value));}
function showMember(member){
 const host=$('previewContent');host.replaceChildren();
 const heading=el('h2','會員中心');heading.id='previewTitle';heading.tabIndex=-1;
 host.append(heading,el('h3',member.name,'profile-name'),el('span',M.schemas[member.memberType].icon+' '+M.schemas[member.memberType].memberLabel,'badge '+member.memberType));
 if(member.memberType==='business')host.append(el('p','店家會員｜'+member.shopName,'profile-shop'));
 const list=el('dl');
 const status={pending:'待驗證（可登入但尚未驗證）',active:'正常',suspended:'停權',disabled:'停用'};
 for(const [label,value] of [['Email',member.email],['手機',member.mobile],['會員編號',member.memberId],['會員狀態',status[member.memberStatus]||member.memberStatus],['註冊時間',member.registeredAt?new Date(member.registeredAt).toLocaleString('zh-TW'):'—'],['最後登入時間',member.lastLoginAt?new Date(member.lastLoginAt).toLocaleString('zh-TW'):'—'],['Email 驗證',member.emailVerified?'已驗證':'未驗證'],['手機驗證',member.mobileVerified?'已驗證':'未驗證']])addPair(list,label,value);
 if(member.memberType==='business'){
  addPair(list,'店家審核狀態',({pending:'待審核',approved:'已通過',returned:'退回補件',disabled:'停用'})[member.shopReviewStatus]||'待審核');
  addPair(list,'店家綁定狀態',member.shopBound?'已綁定':'未綁定');
 }
 host.append(list);clearImages();$('memberForm').reset();$('loginForm').reset();
 $('memberPreview').hidden=false;$('registration').hidden=true;$('memberChoices').hidden=true;$('loginPanel').hidden=true;heading.focus();
}
async function refreshMember(){const result=await request('me');showMember(result.member);}
for(const button of document.querySelectorAll('[data-member-type]'))button.addEventListener('click',()=>selectType(button.dataset.memberType));
$('changeType').addEventListener('click',goChoices);
$('clearForm').addEventListener('click',()=>selectType(memberType));


$('memberForm').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!$('memberForm').reportValidity())return;
 const data=readFields(),result=M.previewMember(memberType,data);
 if(!result.ok){$('formMessage').textContent=result.errors.join('\n');return;}
 data.memberType=memberType;data.password=$('member-password').value;
 lock(true);$('formMessage').textContent='註冊送出中…';
 try{
  const response=await request('register',data);
  if(!response.member?.memberId)throw Error('註冊結果不完整，請先嘗試登入確認。');
  const email=data.email;goChoices();$('loginPanel').hidden=false;$('loginEmail').value=email;
  $('loginMessage').textContent='註冊成功，請使用 Email 與密碼登入。帳號可登入但尚未驗證。';$('loginEmail').focus();
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
 try{await request('logout',{});goChoices();$('loginPanel').hidden=false;$('loginMessage').textContent='已登出';}
 catch(e){$('authNotice').textContent='登出未確認：'+e.message;}finally{lock(false);}
});
refreshMember().catch(()=>{});
$('memberForm').addEventListener('invalid',()=>{$('formMessage').textContent='請確認必填欄位、Email 格式及條款／隱私權勾選。';},true);
window.addEventListener('pagehide',clearImages);
})();

