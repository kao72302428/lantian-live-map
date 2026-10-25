const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const M=require('../member-schema');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const person={name:'測試一般會員',displayName:'測試暱稱',mobile:'0912345678',email:'preview@example.invalid',residenceArea:'高雄市楠梓區',termsAccepted:true,privacyAccepted:true};
const shop={name:'測試聯絡人',mobile:'0912345678',email:'shop@example.invalid',jobTitle:'負責人',termsAccepted:true,privacyAccepted:true,shopName:'測試店家',shopDisplayName:'測試品牌',shopCategory:'美食餐飲',shopSubcategory:'咖啡',shopPhone:'07-1234567',shopAddress:'測試路1號',businessArea:'楠梓區',shopDescription:'合成測試資料',shopIdentity:'new'};
test('individual registration has exact requested field inventory',()=>{
 assert.deepEqual(M.fieldsFor('individual').map(x=>x.key),['name','displayName','mobile','email','residenceArea','loginMethod','password','birthMonth','gender','preferredContact','notificationsAccepted','termsAccepted','privacyAccepted']);
 assert.equal(M.schemas.individual.entryLabel,'非店家會員');assert.equal(M.schemas.individual.memberLabel,'一般會員');
});
test('business has separate contact and shop sections and all requested fields',()=>{
 assert.equal(M.schemas.business.sections.length,2);
 for(const key of ['name','mobile','email','jobTitle','loginMethod','password','lineContact','shopName','shopDisplayName','shopCategory','shopSubcategory','shopPhone','shopAddress','businessArea','shopDescription','mapsUrl','website','facebook','instagram','officialLine','businessHours','logo','cover','businessNotificationsAccepted','termsAccepted','privacyAccepted'])assert.ok(M.fieldsFor('business').some(f=>f.key===key),key);
});
test('authentication fields are required placeholders, not active credentials',()=>{
 for(const type of ['individual','business'])for(const key of ['loginMethod','password']){const f=M.fieldsFor(type).find(x=>x.key===key);assert.equal(f.required,true);assert.ok(f.type.includes('reserved'));}
 assert.match(source('member-area.js'),/input\.disabled=true/);
});
test('individual minimum valid data creates only an in-memory unverified preview',()=>{
 const r=M.previewMember('individual',person);assert.equal(r.ok,true);assert.equal(r.member.memberStatus,'待驗證');assert.equal(r.member.memberId,null);assert.equal(r.member.memberLabel,'一般會員');assert.equal(r.member.emailVerified,false);assert.equal(r.member.mobileVerified,false);assert.equal(r.member.registeredAt,null);assert.equal(r.member.lastLoginAt,null);
});
test('every active required individual field is checked independently',()=>{
 for(const key of ['name','displayName','mobile','email','residenceArea','termsAccepted','privacyAccepted'])assert.equal(M.previewMember('individual',{...person,[key]:''}).ok,false,key);
});
test('optional personal fields do not become mandatory',()=>{assert.equal(M.previewMember('individual',person).ok,true);assert.equal(M.fieldsFor('individual').find(x=>x.key==='birthMonth').type,'month');});
test('birth input accepts year-month and rejects full date or future month',()=>{
 assert.equal(M.validatePreview('individual',{...person,birthMonth:'2000-02'}).length,0);
 for(const birthMonth of ['2000-02-03','2000-13','2999-01'])assert.ok(M.validatePreview('individual',{...person,birthMonth}).length);
});
test('email and unsafe optional URL formats are rejected',()=>{
 assert.equal(M.previewMember('individual',{...person,email:'invalid'}).ok,false);
 assert.equal(M.previewMember('business',{...shop,website:'javascript:alert(1)'}).ok,false);
 assert.equal(M.previewMember('business',{...shop,website:'https://example.invalid/'}).ok,true);
});
test('new shop remains pending application with no public ID or binding',()=>{
 const r=M.previewMember('business',shop);assert.equal(r.ok,true);assert.equal(r.member.applicationKind,'待審核店家申請');assert.equal(r.member.shopId,null);assert.equal(r.member.shopBound,false);assert.equal(r.member.shopReviewStatus,'待審核');assert.equal(r.member.memberStatus,'待驗證');
});
test('existing shop must enter binding workflow and cannot be silently created',()=>{
 assert.equal(M.previewMember('business',{...shop,shopIdentity:'existing'}).ok,false);
 const r=M.previewMember('business',{...shop,shopIdentity:'existing',existingShopName:'合成既有店家',existingShopId:'TEST-001'});
 assert.equal(r.ok,true);assert.equal(r.member.applicationKind,'既有店家綁定申請');assert.equal(r.member.shopBound,false);assert.equal(r.member.shopId,null);assert.equal(r.member.existingShopId,'TEST-001');
});
test('switching to new shop discards stale existing binding target',()=>{
 const r=M.previewMember('business',{...shop,existingShopId:'TEST-001',existingShopName:'stale'});assert.equal(r.member.existingShopId,'');assert.equal(r.member.existingShopName,'');
});
test('unknown member and shop identity types cannot produce a valid preview',()=>{
 assert.equal(M.previewMember('administrator',person).ok,false);
 assert.equal(M.previewMember('business',{...shop,shopIdentity:'verified'}).ok,false);
});
test('submitted flags cannot forge activation, shop approval or account IDs',()=>{
 const r=M.previewMember('business',{...shop,memberStatus:'正常',shopReviewStatus:'已通過',shopBound:true,shopId:'A001',memberId:'forged',emailVerified:true,mobileVerified:true});
 assert.equal(r.member.memberStatus,'待驗證');assert.equal(r.member.shopReviewStatus,'待審核');assert.equal(r.member.shopBound,false);assert.equal(r.member.shopId,null);assert.equal(r.member.memberId,null);assert.equal(r.member.emailVerified,false);
});
test('passwords and unrequested identity fields never enter preview data',()=>{
 const r=M.previewMember('individual',{...person,password:'do-not-collect',identityNumber:'do-not-collect',creditCard:'do-not-collect'});
 for(const key of ['password','identityNumber','creditCard'])assert.equal(Object.hasOwn(r.member,key),false);
});
test('member statuses and shop review statuses are distinct',()=>{
 assert.deepEqual(M.states.member,['待驗證','正常','停權','停用']);
 assert.deepEqual(M.states.shopReview,['待審核','已通過','退回補件','停用']);
 assert.equal(M.commonAdmin.length,14);assert.equal(M.businessAdmin.length,6);
 assert.ok(M.businessAdmin.some(x=>x[0]==='shopChangeReviewStatus'));
});
test('required shop fields and both consents reject missing data',()=>{
 for(const key of ['jobTitle','shopName','shopDisplayName','shopCategory','shopSubcategory','shopPhone','shopAddress','businessArea','shopDescription','termsAccepted','privacyAccepted'])assert.equal(M.previewMember('business',{...shop,[key]:''}).ok,false,key);
});
test('photos support only nonempty size-limited local image previews',()=>{
 assert.equal(M.fileError(null),'');
 assert.equal(M.fileError({type:'image/png',size:2500000}),'');
 for(const f of [{type:'image/png',size:0},{type:'image/gif',size:10},{type:'image/jpeg',size:2500001}])assert.notEqual(M.fileError(f),'');
});
test('UI separates initial cards, registration, preview and admin skeleton',()=>{
 const html=source('vision.html');assert.match(html,/data-member-type="business"/);assert.match(html,/data-member-type="individual"/);
 assert.match(html,/id="registration"[^>]*hidden/);assert.match(html,/id="memberPreview"[^>]*hidden/);
 const js=source('member-area.js');assert.match(js,/typeBadge/);assert.match(js,/profile-shop/);
 assert.match(source('admin-members.html'),/固定示意卡/);assert.match(source('admin-members.js'),/M\.commonAdmin/);assert.match(source('admin-members.js'),/M\.businessAdmin/);
});
test('member code does not call backend, storage, login SDK or existing merchant data',()=>{
 const code=['member-schema.js','member-area.js','admin-members.js'].map(source).join('\n');
 assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|liff\.|firebase|supabase|GITHUB_CONTENT_TOKEN|MERCHANTS/);
 assert.doesNotMatch(source('vision.html'),/<form[^>]*\baction=/);
});
test('preview rendering uses text nodes rather than untrusted innerHTML',()=>{
 for(const file of ['member-area.js','admin-members.js']){assert.doesNotMatch(source(file),/\.innerHTML\s*=/);assert.match(source(file),/textContent=text/);}
});
test('responsive styles and keyboard focus rules cover the new module only',()=>{
 const css=source('member-area.css');assert.match(css,/@media\(max-width:700px\)/);assert.match(css,/:focus-visible/);assert.match(css,/\[hidden\]\{display:none!important\}/);
 assert.match(source('member-area.js'),/input\.required=f\.required/);assert.match(source('vision.html'),/aria-live="polite"/);
});

