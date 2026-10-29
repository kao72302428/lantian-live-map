'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {randomBytes}=require('node:crypto');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,10));
const member={memberId:'MEM-UAT-ONLY',memberType:'individual',name:'SYSTEM UAT TEST',displayName:'SYSTEM-UAT',email:'ui@example.invalid',mobile:'TEST',memberStatus:'pending',emailVerified:false,mobileVerified:false,registeredAt:'2026-10-28T00:00:00Z',lastLoginAt:'2026-10-28T00:00:01Z'};
async function page(callback){
 const dom=new JSDOM(readFileSync('vision.html','utf8'),{url:'https://lantian-live-map.vercel.app/vision.html',runScripts:'outside-only'});
 const w=dom.window;
 w.fetch=async(path,options)=>callback(path,options);
 w.eval(readFileSync('member-schema.js','utf8'));w.eval(readFileSync('member-area.js','utf8'));await tick();return dom;
}
const response=(ok,data)=>({ok,json:async()=>data});
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
 for(const label of ['店家會員','UAT SHOP','待審核','未綁定'])assert.ok(text.includes(label));d.window.close();
});
test('UI never uses browser token/password persistence',()=>{
 const script=readFileSync('member-area.js','utf8');assert.doesNotMatch(script,/localStorage|sessionStorage|indexedDB/);assert.match(script,/credentials:'same-origin'/);
});


for(const type of ['individual','business'])test(`${type} first registration contains only authorized minimal fields`,async()=>{
 const d=await page(anon),w=d.window;w.document.querySelector(`[data-member-type=${type}]`).click();
 const expected=['name','mobile','email','password','termsAccepted','privacyAccepted',...(type==='business'?['shopName']:[])];
 assert.deepEqual([...w.document.querySelectorAll('#formSections input')].map(i=>i.name).sort(),expected.sort());
 for(const i of w.document.querySelectorAll('#formSections input'))assert.equal(i.required,true);
 assert.equal(w.document.getElementById('member-displayName'),null);assert.equal(w.document.getElementById('member-residenceArea'),null);
 if(type==='business'){
  const radio=w.document.querySelector('input[value=existing]');radio.click();
  assert.equal(w.document.getElementById('member-existingShopName'),null);assert.equal(w.document.querySelectorAll('input[name=shopIdentity]').length,2);
 }
 assert.match(w.document.getElementById('formSections').textContent,/後續會員資料補充工作包/);w.close();
});
test('minimal business form sends only required profile and identity',async()=>{
 let sent;const d=await page(async(path,options)=>{if(path.endsWith('/me'))return anon();sent=JSON.parse(options.body);return response(true,{ok:true,member:{...member,memberType:'business'}});}),w=d.window;
 w.document.querySelector('[data-member-type=business]').click();
 for(const i of w.document.querySelectorAll('#formSections input')){if(i.type==='checkbox')i.checked=true;else i.value=i.type==='email'?'ui@example.invalid':'SYSTEM UAT TEST';}
 w.document.querySelector('input[value=existing]').click();w.document.getElementById('memberForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(sent.shopIdentity,'existing');assert.equal(sent.shopName,'SYSTEM UAT TEST');assert.ok(!Object.hasOwn(sent,'shopAddress'));assert.match(w.document.getElementById('loginMessage').textContent,/註冊成功/);w.close();
});
