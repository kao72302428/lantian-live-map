'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {randomBytes}=require('node:crypto');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,10));
const member={memberId:'MEM-UAT-ONLY',memberType:'individual',name:'SYSTEM UAT TEST',displayName:'SYSTEM-UAT',email:'ui@example.invalid',mobile:'TEST',memberStatus:'pending',emailVerified:false,mobileVerified:false,registeredAt:'2026-10-28T00:00:00Z',lastLoginAt:'2026-10-28T00:00:01Z'};
async function page(callback,setup){
 const dom=new JSDOM(readFileSync('vision.html','utf8'),{url:'https://lantian-live-map.vercel.app/vision.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 const nativeAdd=w.document.addEventListener.bind(w.document);w.activityHandlers={};
 w.document.addEventListener=(type,fn,options)=>{if(['pointerdown','keydown','wheel','touchstart','touchmove','input'].includes(type))w.activityHandlers[type]=fn;nativeAdd(type,fn,options);};
 if(setup)setup(w);
 w.fetch=async(path,options)=>callback(path,options);
 w.eval(readFileSync('member-schema.js','utf8'));w.eval(readFileSync('member-area.js','utf8'));await tick();return dom;
}
const response=(ok,data)=>({ok,json:async()=>data.member?{idleExpiresAt:Date.now()+1800000,sessionExpiresAt:Date.now()+604800000,...data}:data});
const anon=()=>response(false,{ok:false,code:'UNAUTHENTICATED',message:'請重新登入'});
function fill(w){
 w.document.querySelector('[data-member-type=individual]').click();
 for(const f of w.LantianMembers.registrationFieldsFor('individual')){
  const i=w.document.getElementById('member-'+f.key);if(!i||i.disabled||i.readOnly)continue;
  if(f.type==='checkbox')i.checked=true;
  else if(f.required)i.value=f.type==='email'?'ui@example.invalid':'SYSTEM UAT TEST';
 }
 w.document.getElementById('member-password').value=randomBytes(18).toString('base64url');
}
test('accepted two category cards remain and password field enabled',async()=>{
 const d=await page(anon),w=d.window;assert.equal(w.document.querySelectorAll('[data-member-type]').length,2);fill(w);
 assert.equal(w.document.getElementById('member-password').type,'password');assert.equal(w.document.getElementById('member-password').disabled,false);d.window.close();
});
test('registration waits for backend success and blocks duplicate submit',async()=>{
 let release,calls=0;const d=await page(async(path)=>path.endsWith('/me')?anon():new Promise(r=>{calls++;release=r;})),w=d.window;fill(w);
 const form=w.document.getElementById('memberForm');form.dispatchEvent(new w.Event('submit',{cancelable:true}));form.dispatchEvent(new w.Event('submit',{cancelable:true}));
 assert.equal(calls,1);assert.ok(!w.document.getElementById('loginMessage').textContent.includes('註冊成功'));
 release(response(true,{ok:true,member}));await tick();assert.match(w.document.getElementById('loginMessage').textContent,/註冊成功/);d.window.close();
});
test('backend failure never shows registration success and clears password',async()=>{
 const d=await page(async(path)=>path.endsWith('/me')?anon():response(false,{ok:false,message:'註冊失敗'})),w=d.window;fill(w);
 w.document.getElementById('memberForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.match(w.document.getElementById('formMessage').textContent,/註冊失敗/);assert.equal(w.document.getElementById('member-password').value,'');assert.ok(!w.document.getElementById('loginMessage').textContent.includes('註冊成功'));d.window.close();
});
test('login center uses me response and logout calls backend',async()=>{
 let authenticated=false,loggedOut=false;
 const d=await page(async(path)=>{
  if(path.endsWith('/login')){authenticated=true;return response(true,{ok:true});}
  if(path.endsWith('/logout')){loggedOut=true;return response(true,{ok:true});}
  return authenticated?response(true,{ok:true,member}):anon();
 }),w=d.window;
 w.document.getElementById('loginEmail').value=member.email;w.document.getElementById('loginPassword').value=randomBytes(18).toString('base64url');
 w.document.getElementById('loginForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(w.document.getElementById('memberPreview').hidden,false);assert.match(w.document.getElementById('previewContent').textContent,/MEM-UAT-ONLY/);assert.match(w.document.getElementById('previewContent').textContent,/一般會員/);
 assert.equal(w.document.getElementById('loginPassword').value,'');w.document.getElementById('logoutButton').click();await tick();assert.equal(loggedOut,true);assert.equal(w.document.getElementById('memberPreview').hidden,true);d.window.close();
});
test('business center visibly shows type shop review and binding state',async()=>{
 const d=await page(async()=>response(true,{ok:true,member:{...member,memberType:'business',shopName:'UAT SHOP',shopReviewStatus:'pending',shopBound:false}}));
 const text=d.window.document.getElementById('previewContent').textContent;
 for(const label of ['免費店家會員','UAT SHOP','免費會員','未綁定'])assert.ok(text.includes(label));assert.doesNotMatch(text,/待審核|店家審核狀態/);d.window.close();
});
test('UI never uses browser token/password persistence',()=>{
 const script=readFileSync('member-area.js','utf8');assert.doesNotMatch(script,/localStorage|sessionStorage|indexedDB/);assert.match(script,/credentials:'same-origin'/);
});


for(const type of ['individual','business'])test(`${type} first registration contains only authorized minimal fields`,async()=>{
 const d=await page(anon),w=d.window;w.document.querySelector(`[data-member-type=${type}]`).click();
 const expected=['name','mobile','email','password','termsAccepted','privacyAccepted',...(type==='business'?['shopName','shopCategory']:[])];
 assert.deepEqual([...w.document.querySelectorAll('#formSections input')].map(i=>i.name).sort(),expected.sort());
 for(const i of w.document.querySelectorAll('#formSections input'))assert.equal(i.required,true);
 assert.equal(w.document.getElementById('member-displayName'),null);assert.equal(w.document.getElementById('member-residenceArea'),null);
 if(type==='business'){
  assert.equal(w.document.getElementById('member-existingShopName'),null);assert.equal(w.document.querySelectorAll('input[name=shopIdentity]').length,0);
 }
 assert.doesNotMatch(w.document.getElementById('formSections').textContent,/無須資格審核|尚未開放補填/);assert.equal(w.document.querySelectorAll('#formSections fieldset').length,1);assert.doesNotMatch(w.document.getElementById('formSections').textContent,/A\. |B\. /);if(type==='business')assert.match(w.document.getElementById('formSections').textContent,/店家會員申請/);w.close();
});
test('minimal business form sends only required profile and identity',async()=>{
 let sent;const d=await page(async(path,options)=>{if(path.endsWith('/me'))return anon();sent=JSON.parse(options.body);return response(true,{ok:true,member:{...member,memberType:'business'}});}),w=d.window;
 w.document.querySelector('[data-member-type=business]').click();
 for(const i of w.document.querySelectorAll('#formSections input')){if(i.type==='checkbox')i.checked=true;else if(i.name==='shopCategory')i.value='美食餐飲';else i.value=i.type==='email'?'ui@example.invalid':'SYSTEM UAT TEST';}
 w.document.getElementById('memberForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(sent.shopIdentity,undefined);assert.equal(sent.shopName,'SYSTEM UAT TEST');assert.equal(sent.shopCategory,'美食餐飲');assert.ok(!Object.hasOwn(sent,'shopAddress'));assert.match(w.document.getElementById('loginMessage').textContent,/註冊成功/);w.close();
});

function clock(w){
 let current=Date.now(),n=0;const jobs=new Map();w.Date.now=()=>current;
 w.setTimeout=(fn,ms)=>{jobs.set(++n,{fn,at:current+ms});return n;};w.clearTimeout=id=>jobs.delete(id);
 return {now:()=>current,async advance(ms){current+=ms;for(let k=0;k<20;k++){const due=[...jobs].filter(([,j])=>j.at<=current);if(!due.length)break;for(const [id,j] of due){jobs.delete(id);j.fn();}await tick();}}};
}
test('idle timeout clears profile and sends server logout at 30 minutes',async()=>{
 let c,outs=0;const d=await page(async(path)=>{if(path.endsWith('/logout')){outs++;return response(true,{ok:true});}return response(true,{ok:true,member});},w=>{c=clock(w);});
 await c.advance(1800000);assert.equal(outs,1);assert.equal(d.window.document.getElementById('memberPreview').hidden,true);assert.match(d.window.document.getElementById('loginMessage').textContent,/30 分鐘/);d.window.close();
});
test('real page activity syncs server deadline and postpones logout; background sends no heartbeat',async()=>{
 let c,activity=0,outs=0;const d=await page(async(path)=>{
 if(path.endsWith('/activity')){activity++;return response(true,{ok:true,idleExpiresAt:c.now()+1800000,sessionExpiresAt:c.now()+604800000});}
 if(path.endsWith('/logout')){outs++;return response(true,{ok:true});}return response(true,{ok:true,member});},w=>{c=clock(w);});
 await c.advance(900000);assert.equal(activity,0);d.window.activityHandlers.keydown({isTrusted:true});await tick();assert.equal(activity,1);
 await c.advance(900001);assert.equal(outs,0);await c.advance(900000);assert.equal(outs,1);d.window.close();
});
test('return after a suspended tab passes deadline cannot renew session',async()=>{
 let c,activity=0;const d=await page(async(path)=>{if(path.endsWith('/activity'))activity++;return response(true,{ok:true,member});},w=>{c=clock(w);});
 await c.advance(1800001);d.window.document.dispatchEvent(new d.window.Event('pointerdown'));await tick();assert.equal(activity,0);assert.equal(d.window.document.getElementById('memberPreview').hidden,true);d.window.close();
});

test('mouse movement and synthetic input do not keep an idle account alive',async()=>{
 let c,activity=0,outs=0;const d=await page(async(path)=>{
 if(path.endsWith('/activity')){activity++;return response(true,{ok:true,idleExpiresAt:c.now()+1800000,sessionExpiresAt:c.now()+604800000});}
 if(path.endsWith('/logout')){outs++;return response(true,{ok:true});}return response(true,{ok:true,member});},w=>{c=clock(w);});
 try{for(let i=0;i<3;i++){await c.advance(500000);d.window.document.dispatchEvent(new d.window.Event('pointermove'));d.window.document.dispatchEvent(new d.window.Event('keydown'));await tick();}assert.equal(activity,0);await c.advance(300001);assert.equal(outs,1);}finally{d.window.close();}
});
test('background status check removes a stale member display without renewing activity',async()=>{
 let c,reads=0,activity=0;const d=await page(async(path)=>{
 if(path.endsWith('/activity'))activity++;
 if(++reads===1)return response(true,{ok:true,member});return response(false,{ok:false,code:'UNAUTHENTICATED'});
 },w=>{c=clock(w);});
 try{await c.advance(60000);assert.equal(d.window.document.getElementById('memberPreview').hidden,true);assert.equal(activity,0);}finally{d.window.close();}
});

test('registration page uses concise notice and published policy text',async()=>{
 const d=await page(anon),w=d.window;
 assert.equal(w.document.getElementById('authNotice').textContent.trim(),'免費開放註冊，填寫基本資料即可加入');
 const body=w.document.body.textContent;
 for(const removed of ['註冊通知信尚未啟用','Email 與手機驗證尚未啟用','待正式核定','資料同步尚未啟用'])assert.equal(body.includes(removed),false,removed);
 for(const required of ['會員服務條款','隱私權與個人資料告知','查詢或閱覽','停止蒐集／處理／利用'])assert.ok(body.includes(required),required);
 assert.equal(w.document.querySelector('a[href*="docs.google.com/spreadsheets"]'),null);
 d.window.close();
});
test('business registration shows six required categories',async()=>{
 const d=await page(anon),w=d.window;w.document.querySelector('[data-member-type=business]').click();
 const select=w.document.getElementById('member-shopCategory');
 assert.ok(select);assert.equal(select.required,true);
 assert.deepEqual([...select.options].slice(1).map(o=>o.value),['美食餐飲','購物零售','居家服務','醫療保健','生活服務','教育休閒']);
 d.window.close();
});
