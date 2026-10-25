(function(){
'use strict';
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
 set.append(legend,el('p','請先選擇店家身分。以下流程只供畫面預覽，不會送出申請。'));
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
 binding.append(el('h3','既有店家綁定流程（預覽）'),el('p','僅填寫欲綁定的店家識別資料，綁定尚未啟用。店家 ID 仍以原平台資料為準，不會重編。'));
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
 document.querySelector('h1').textContent='會員註冊欄位預覽';
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
function showPreview(member){
 const host=$('previewContent');host.replaceChildren();
 const heading=el('h2','會員中心（畫面預覽，尚未登入）');heading.id='previewTitle';heading.tabIndex=-1;
 host.append(heading,el('p','未建立會員帳號、未送出申請；以下僅呈現本頁暫存內容。','notice'));
 host.append(el('h3',member.name,'profile-name'),el('span',M.schemas[member.memberType].icon+' '+member.memberLabel,'badge '+member.memberType));
 if(member.memberType==='business')host.append(el('p','店家會員｜'+member.shopName,'profile-shop'));
 const statuses=el('div',undefined,'status-strip');
 for(const text of ['會員狀態：待驗證（欄位預留）','Email：未驗證','手機：未驗證'])statuses.append(el('p',text,'status-chip'));
 if(member.memberType==='business'){
  statuses.append(el('p',member.applicationKind+'（尚未送出）','status-chip'),el('p','店家審核：待審核（欄位預留）','status-chip'),el('p','既有店家綁定：未完成','status-chip'));
 }
 host.append(statuses);
 const details=el('dl');
 for(const f of M.fieldsFor(member.memberType)){
  if(['reserved','password-reserved'].includes(f.type))continue;
  if(f.type==='file'){const file=$('member-'+f.key).files[0];addPair(details,f.label,file?file.name+'（未上傳）':'未選擇');continue;}
  addPair(details,f.label,f.type==='checkbox'?(member[f.key]?'已勾選（僅預覽）':'未勾選'):member[f.key]||'未填');
 }
 if(member.memberType==='business'){
  addPair(details,'店家身分類型',member.shopIdentity==='existing'?'平台既有店家':'新申請店家');
  if(member.shopIdentity==='existing'){addPair(details,'待綁定店家 ID',member.existingShopId||'未填，待核定');addPair(details,'待綁定既有店家名稱',member.existingShopName);}
  addPair(details,'正式店家 ID','尚未綁定／未配置');
 }
 host.append(details);$('registration').hidden=true;$('memberPreview').hidden=false;heading.focus();
}
for(const button of document.querySelectorAll('[data-member-type]'))button.addEventListener('click',()=>selectType(button.dataset.memberType));
$('changeType').addEventListener('click',goChoices);
$('clearForm').addEventListener('click',()=>selectType(memberType));
$('finishPreview').addEventListener('click',goChoices);
$('editPreview').addEventListener('click',()=>{$('memberPreview').hidden=true;$('registration').hidden=false;$('formTitle').focus();});
$('memberForm').addEventListener('submit',event=>{
 event.preventDefault();
 if(!$('memberForm').reportValidity())return;
 const result=M.previewMember(memberType,readFields());
 if(!result.ok){$('formMessage').textContent=result.errors.join('\n');return;}
 $('formMessage').textContent='';showPreview(result.member);
});
$('memberForm').addEventListener('invalid',()=>{$('formMessage').textContent='請確認必填欄位、Email 格式及條款／隱私權勾選。';},true);
window.addEventListener('pagehide',clearImages);
})();
