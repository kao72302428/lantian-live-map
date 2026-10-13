const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
function node(){return {value:'',files:[],disabled:false,hidden:true,textContent:'',innerHTML:'',style:{},events:{},classList:{toggle(){}},addEventListener(k,f){this.events[k]=f;},removeAttribute(){},scrollIntoView(){}};}
function contact(){
 const ids=['caseType','selected','contactForm','contactFormSection','formMsg','contactReceiver','contentText','contentLabelText','contentGuide','contactTypes','photoInput','photoPreview','photoPreviewImage','removePhotoBtn','photoBase64','photoName','photoMime'];
 const els=Object.fromEntries(ids.map(id=>[id,node()])),submit=node(),win={events:{},addEventListener(k,f){this.events[k]=f;}};
 let submitted=0,readError=false;
 els.caseType.value='合作提案';els.contactForm.querySelector=()=>submit;els.contactForm.reportValidity=()=>true;els.contactForm.reset=()=>{};
 const context={document:{getElementById:id=>els[id],querySelectorAll:()=>[]},window:win,history:{},requestAnimationFrame:f=>f(),setTimeout:()=>1,clearTimeout(){},sessionStorage:{removeItem(){}},localStorage:{removeItem(){}},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},HTMLFormElement:{prototype:{submit(){submitted++;}}},FileReader:class{readAsDataURL(file){if(readError)this.onerror();else{this.result='data:'+file.type+';base64,YWJj';this.onload();}}}};
 vm.runInNewContext(read('contact-app.js'),context);
 return {els,submit,win,count:()=>submitted,failRead:()=>readError=true,send:()=>els.contactForm.events.submit({preventDefault(){}})};
}
test('photo input is optional and retains existing POST service',()=>{
 const html=read('contact.html');const input=html.match(/<input id="photoInput"[^>]*>/)[0];assert.ok(!input.includes('required'));assert.match(input,/image\/jpeg,image\/png,image\/webp/);assert.match(html,/#photoPreview\[hidden\]\{display:none\}/);
});
test('no photo submits with empty photo fields',async()=>{const c=contact();await c.send();assert.equal(c.count(),1);assert.equal(c.els.photoBase64.value,'');});
for(const mime of ['image/jpeg','image/png','image/webp'])test(mime+' is encoded into native form fields',async()=>{
 const c=contact();c.els.photoInput.files=[{type:mime,size:3,name:'現場照片'}];await c.send();assert.equal(c.count(),1);assert.equal(c.els.photoBase64.value,'YWJj');assert.equal(c.els.photoMime.value,mime);assert.equal(c.els.photoName.value,'現場照片');
});
for(const [name,file] of [['unsupported',{type:'image/gif',size:3}],['oversize',{type:'image/png',size:2500001}],['empty',{type:'image/png',size:0}]])test(name+' photo prevents submission',async()=>{const c=contact();c.els.photoInput.files=[file];await c.send();assert.equal(c.count(),0);assert.notEqual(c.els.formMsg.textContent,'');});
test('read failure permits retry without claiming success',async()=>{const c=contact();c.els.photoInput.files=[{type:'image/png',size:3}];c.failRead();await c.send();assert.equal(c.count(),0);assert.equal(c.submit.disabled,false);assert.match(c.els.formMsg.textContent,/讀取失敗/);});
test('preview and remove clear attachment fields',()=>{const c=contact();c.els.photoInput.files=[{type:'image/png',size:3}];c.els.photoInput.events.change();assert.equal(c.els.photoPreview.hidden,false);c.els.photoBase64.value='old';c.els.removePhotoBtn.events.click();assert.equal(c.els.photoPreview.hidden,true);assert.equal(c.els.photoBase64.value,'');assert.equal(c.els.photoInput.value,'');});
test('double submission is ignored while waiting',async()=>{const c=contact();await c.send();await c.send();assert.equal(c.count(),1);});
function cases(){
 const ids=['loadBtn','caseMessage','searchInput','statusFilter','caseCount','caseList','authStatus','authTitle'];const els=Object.fromEntries(ids.map(id=>[id,node()]));
 let confirm=true,fail=false,calls=[],verified=false;els.authStatus.classList.contains=()=>verified;
 const card={dataset:{id:'LT-1'}},button={closest:()=>card};
 const context={document:{getElementById:id=>els[id],querySelectorAll:()=>[]},window:{confirm:()=>confirm},MutationObserver:class{observe(){}},sessionStorage:{getItem:()=> 'valid-token'},setInterval:()=>1,clearInterval(){},fetch:async(url,options)=>{calls.push(JSON.parse(options.body));if(fail)return {ok:false,json:async()=>({ok:false,code:'SERVICE_FAILURE'})};return {ok:true,json:async()=>({ok:true,items:[]})};}};
 const source=read('admin-cases.js').replace(/\}\)\(\);\s*$/,"globalThis.hooks={deleteCase,render,setItems:x=>items=x};})();");vm.runInNewContext(source,context);verified=true;
 return {els,button,hooks:context.hooks,calls,cancel:()=>confirm=false,fail:()=>fail=true};
}
test('cancel delete sends no request',async()=>{const c=cases();c.cancel();await c.hooks.deleteCase(c.button);assert.equal(c.calls.length,0);});
test('successful delete sends authenticated ID and removes card',async()=>{const c=cases();c.hooks.setItems([{id:'LT-1'}]);await c.hooks.deleteCase(c.button);assert.equal(c.calls[0].action,'delete');assert.equal(c.calls[0].id,'LT-1');assert.equal(c.calls[0].idToken,'valid-token');assert.match(c.els.caseMessage.textContent,/已刪除/);assert.ok(!c.els.caseList.innerHTML.includes('data-id="LT-1"'));});
test('failed delete does not remove case or show success',async()=>{const c=cases();c.hooks.setItems([{id:'LT-1'}]);c.hooks.render();c.fail();await c.hooks.deleteCase(c.button);assert.match(c.els.caseMessage.textContent,/刪除失敗/);assert.ok(c.els.caseList.innerHTML.includes('data-id="LT-1"'));});
function gas(){
 const rows=[Array(14).fill(''),['LT-1','time','合作提案','姓名','電話','email','content','未處理','note','time','source','photo-url','photo-name','image/png'],['LT-2','time','合作提案','姓名','電話','email','content','已完成','note','time','source','','','']];
 const sheet={getLastRow:()=>rows.length,getRange:(r,c,n=1,m=1)=>({getDisplayValues:()=>rows.slice(r-1,r-1+n).map(a=>a.slice(c-1,c-1+m)),getValue:()=>rows[r-1][c-1],setValue:v=>rows[r-1][c-1]=v})};let mails=0;
 const context={PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'secret'})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet})},Utilities:{formatDate:()=> 'updated'},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},MailApp:{sendEmail(){mails++;}},ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})}};
 vm.runInNewContext(read('contact-google-apps-script.gs'),context);return {rows,run:p=>context.handleAdmin_(p),mails:()=>mails};
}
test('gateway rejects unauthorized deletion without changing rows',()=>{const g=gas();const r=g.run({adminAction:'delete',id:'LT-1',gatewaySecret:'bad'});assert.equal(r.code,'NOT_AUTHORIZED');assert.equal(g.rows[1][7],'未處理');});
test('delete hides only target while preserving original record and photo',()=>{const g=gas();const r=g.run({adminAction:'delete',id:'LT-1',gatewaySecret:'secret'});assert.equal(r.ok,true);assert.equal(r.items.length,1);assert.equal(r.items[0].id,'LT-2');assert.equal(g.rows.length,3);assert.equal(g.rows[1][7],'已刪除');assert.equal(g.rows[1][6],'content');assert.equal(g.rows[1][11],'photo-url');assert.equal(g.mails(),0);assert.equal(g.run({adminAction:'list',gatewaySecret:'secret'}).items.length,1);});
test('missing and already deleted cases cannot be changed',()=>{const g=gas();assert.equal(g.run({adminAction:'delete',id:'missing',gatewaySecret:'secret'}).code,'CASE_NOT_FOUND');g.run({adminAction:'delete',id:'LT-1',gatewaySecret:'secret'});assert.equal(g.run({adminAction:'setStatus',id:'LT-1',status:'未處理',gatewaySecret:'secret'}).code,'CASE_DELETED');});
test('existing status update and reply still persist and notify',()=>{const g=gas();assert.equal(g.run({adminAction:'setStatus',id:'LT-2',status:'處理中',gatewaySecret:'secret'}).ok,true);assert.equal(g.rows[2][7],'處理中');assert.equal(g.run({adminAction:'reply',id:'LT-2',status:'已完成',reply:'回覆內容',gatewaySecret:'secret'}).ok,true);assert.match(g.rows[2][8],/回覆內容/);assert.equal(g.mails(),1);});
function submitService(){
 let saved=[],appended=[],mails=[];
 const context={Utilities:{formatDate:()=> 'time',getUuid:()=> 'abcde-uuid',base64Decode:s=>Array.from(Buffer.from(s,'base64')),newBlob:(bytes,mime,name)=>({bytes,mime,name,copyBlob(){return this;}})},DriveApp:{getFolderById:()=>({createFile:blob=>{saved.push(blob);return {getUrl:()=> 'https://drive.google.com/file/photo'};}})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>({appendRow:row=>appended.push(row)})})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},MailApp:{sendEmail:mail=>mails.push(mail)},HtmlService:{createHtmlOutput:s=>s},console};
 vm.runInNewContext(read('contact-google-apps-script.gs'),context);
 const run=extra=>context.doPost({parameter:{'聯絡類型':'合作提案','姓名':'測試','電話':'123','email':'test@example.invalid','事實內容':'測試內容',...extra}});
 return {saved,appended,mails,run};
}
test('service accepts a case without a photo',()=>{const g=submitService();assert.match(g.run({}),/"ok":true/);assert.equal(g.saved.length,0);assert.equal(g.appended.length,1);assert.equal(g.appended[0][11],'');assert.equal(g.mails[0].attachments,undefined);});
test('service stores photo, URL and attachment with the case',()=>{const g=submitService();assert.match(g.run({'照片Base64':'YWJj','照片檔名':'現場.png','照片格式':'image/png'}),/"ok":true/);assert.equal(g.saved.length,1);assert.equal(g.saved[0].mime,'image/png');assert.equal(g.appended[0][11],'https://drive.google.com/file/photo');assert.equal(g.appended[0][13],'image/png');assert.equal(g.mails[0].attachments.length,1);});
test('service rejects unsupported or oversized photos before saving a case',()=>{for(const extra of [{'照片Base64':'YWJj','照片格式':'image/gif'},{'照片Base64':Buffer.alloc(2500001).toString('base64'),'照片格式':'image/png'}]){const g=submitService();assert.match(g.run(extra),/"ok":false/);assert.equal(g.appended.length,0);assert.equal(g.saved.length,0);}});
for(const authorized of [true,false])test('Vercel to Apps Script deletion '+(authorized?'preserves verified identity and gateway':'rejects non-admin before upstream'),async()=>{
 const g=gas();let upstreamCalls=0,result,status;
 const context={module:{exports:{}},require:()=>({verifyAdminToken:async()=>({status:authorized?200:403,body:{ok:authorized,code:'NOT_AUTHORIZED'}})}),process:{env:{CASES_ADMIN_GATEWAY_SECRET:'secret'}},URLSearchParams,console,fetch:async(url,options)=>{upstreamCalls++;assert.equal(options.body.get('idToken'),'valid-token');const data=g.run(Object.fromEntries(options.body));return {text:async()=>JSON.stringify(data)};}};
 vm.runInNewContext(read('api/cases-admin.js'),context);
 const res={setHeader(){},status(code){status=code;return this;},json(data){result=data;return this;}};
 await context.module.exports({method:'POST',headers:{origin:'https://kao72302428.github.io'},body:{idToken:'valid-token',action:'delete',id:'LT-1'}},res);
 assert.equal(status,authorized?200:403);assert.equal(result.ok,authorized);assert.equal(upstreamCalls,authorized?1:0);assert.equal(g.rows[1][7],authorized?'已刪除':'未處理');
});
