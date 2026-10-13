const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.join(__dirname,'..');
const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));};
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function setup(source,oldToken='old-token'){
 let saved=oldToken,intervalFn,observerFn;const requests=[],pendingAuth=deferred(),pendingCase=deferred(),reverifyButton={style:{},addEventListener(){}};
 const ids=['authStatus','authTitle','loadBtn','caseMessage','caseCount','caseList','searchInput','statusFilter'];
 const els=Object.fromEntries(ids.map(id=>[id,{value:'',disabled:false,textContent:'',innerHTML:'',events:{},style:{},addEventListener(k,f){this.events[k]=f;}}]));
 const parent={appendChild(){},querySelector:()=>reverifyButton};els.authStatus.parentElement=parent;
 for(const el of Object.values(els)){const classes=new Set();el.classList={contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c);if(el===els.authStatus&&observerFn)queueMicrotask(observerFn);},remove(c){classes.delete(c);if(el===els.authStatus&&observerFn)queueMicrotask(observerFn);}};}
 const context={document:{getElementById:id=>els[id],createElement:()=>reverifyButton,querySelector:()=>parent,querySelectorAll:()=>[]},window:{liff:null,location:{href:'https://example.invalid/admin-cases.html'},confirm:()=>true},location:{},URL,console,queueMicrotask,MutationObserver:class{constructor(f){observerFn=f;}observe(){}},sessionStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v,removeItem:()=>saved=''},setInterval:f=>{intervalFn=f;return 1;},clearInterval(){intervalFn=null;},fetch:async(url,options)=>{
  const body=JSON.parse(options.body);requests.push({url,body});
  if(url.endsWith('/admin-auth')){if(body.idToken===oldToken&&oldToken)return pendingAuth.promise;return {ok:true,json:async()=>({ok:true,user:{name:'Admin'}})};}
  if(body.idToken===oldToken&&oldToken)return pendingCase.promise;
  return {ok:true,json:async()=>({ok:true,items:[]})};
 }};
 context.liff={init:async()=>{},isLoggedIn:()=>true,getIDToken:()=> 'fresh-token'};context.window.liff=context.liff;
 vm.runInNewContext(fs.readFileSync(path.join(root,'admin-module.js'),'utf8'),context);
 vm.runInNewContext(source,context);
 return {els,requests,reverifyButton,pendingAuth,pendingCase,tick:()=>intervalFn?.(),saved:()=>saved,context,notify:()=>observerFn?.()};
}
const current=()=>fs.readFileSync(path.join(root,'admin-cases.js'),'utf8');
test('baseline reproduces old-token load before verification and stale red error after fresh green verification',async()=>{
 const old=cp.execFileSync('git',['show','9a5b2e308c2ef31026bb1ca965879f9e3aeb0bf2:admin-cases.js'],{cwd:root,encoding:'utf8'});
 const h=setup(old);h.tick();assert.equal(h.requests.filter(r=>r.url.endsWith('/cases-admin')).length,1);
 h.pendingAuth.resolve({ok:false,json:async()=>({ok:false,code:'INVALID_LINE_ID_TOKEN'})});
 h.pendingCase.resolve({ok:false,json:async()=>({ok:false,code:'INVALID_LINE_ID_TOKEN'})});await settle();
 assert.equal(h.saved(),'fresh-token');assert.equal(h.els.authStatus.classList.contains('ok'),true);assert.match(h.els.caseMessage.textContent,/INVALID_LINE_ID_TOKEN/);
});
test('case loading waits for verification and uses refreshed token once',async()=>{
 const h=setup(current());h.tick();assert.equal(h.requests.filter(r=>r.url.endsWith('/cases-admin')).length,0);
 h.pendingAuth.resolve({ok:false,json:async()=>({ok:false,code:'INVALID_LINE_ID_TOKEN'})});await settle();h.tick();await settle();
 const calls=h.requests.filter(r=>r.url.endsWith('/cases-admin'));assert.equal(calls.length,1);assert.equal(calls[0].body.idToken,'fresh-token');assert.equal(h.els.caseMessage.textContent,'案件已載入。');assert.equal(h.els.loadBtn.disabled,false);
 h.notify();h.tick();await settle();assert.equal(h.requests.filter(r=>r.url.endsWith('/cases-admin')).length,1);
});
test('failed initial verification never sends a case request',async()=>{
 const h=setup(current());h.context.liff.getIDToken=()=>'';h.pendingAuth.resolve({ok:false,json:async()=>({ok:false})});await settle();h.tick();await settle();assert.equal(h.requests.filter(r=>r.url.endsWith('/cases-admin')).length,0);assert.equal(h.els.loadBtn.disabled,true);
});
test('delayed verification can still trigger case loading after the former polling window',async()=>{
 const h=setup(current());for(let i=0;i<40;i++)h.tick();assert.equal(h.requests.filter(r=>r.url.endsWith('/cases-admin')).length,0);
 h.pendingAuth.resolve({ok:false,json:async()=>({ok:false,code:'INVALID_LINE_ID_TOKEN'})});await settle();
 assert.equal(h.requests.filter(r=>r.url.endsWith('/cases-admin')).length,1);assert.equal(h.els.caseMessage.textContent,'案件已載入。');
});
test('API token rejection removes misleading green state and enables reverify',async()=>{
 const h=setup(current(),'');await settle();h.tick();await settle();
 h.context.fetch=async()=>({ok:false,json:async()=>({ok:false,code:'INVALID_LINE_ID_TOKEN'})});await h.els.loadBtn.events.click();await settle();
 assert.equal(h.saved(),'');assert.equal(h.els.authStatus.classList.contains('ok'),false);assert.equal(h.els.authTitle.textContent,'管理權限尚未啟用');assert.equal(h.reverifyButton.style.display,'inline-block');assert.equal(h.els.loadBtn.disabled,true);assert.match(h.els.caseMessage.textContent,/重新驗證/);
});
test('service failure retains verified identity and permits load retry',async()=>{
 const h=setup(current(),'');await settle();h.tick();await settle();h.context.fetch=async()=>({ok:false,json:async()=>({ok:false,code:'CASE_SERVICE_BAD_RESPONSE'})});await h.els.loadBtn.events.click();await settle();assert.equal(h.saved(),'fresh-token');assert.equal(h.els.authStatus.classList.contains('ok'),true);assert.equal(h.els.loadBtn.disabled,false);assert.match(h.els.caseMessage.textContent,/CASE_SERVICE_BAD_RESPONSE/);
});
