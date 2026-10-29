'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac,randomBytes}=require('node:crypto');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {basicMember,syncMemberToSheet}=require('../lib/member-sheet-sync.cjs');
const member={memberId:'MEM-20261030-'+randomBytes(16).toString('hex').toUpperCase(),memberType:'business',name:'SYSTEM UAT TEST',shopName:'UAT SHOP',mobile:'0900000000',email:'sheet@example.invalid',registeredAt:new Date().toISOString()};
const secret=randomBytes(48).toString('base64url');
const env={MEMBER_SHEET_URL:'https://script.google.com/macros/s/TEST_ONLY/exec',MEMBER_SHEET_SECRET:secret};
function application(){
 const rows=[['會員編號','會員類別','姓名／聯絡人','店家名稱','手機','Email','會員方案','註冊時間（台灣）']];let opens=0;
 const sheet={getLastRow:()=>rows.length,getRange:(row,col,count=1,width=1)=>({
  getValues:()=>Array.from({length:count},(_,i)=>Array.from({length:width},(_,j)=>rows[row-1+i]?.[col-1+j]??'')),
  setNumberFormat(){return this;},
  setValues(values){values.forEach((r,i)=>{rows[row-1+i] ||= [];r.forEach((v,j)=>rows[row-1+i][col-1+j]=v);});return this;},
  setValue(v){return this.setValues([[v]]);},
  createTextFinder:value=>({matchEntireCell:()=>({findNext:()=>rows.slice(1).some(r=>r[0]===value)?{}:null})})
 })};
 const ctx={Date,PropertiesService:{getScriptProperties:()=>({getProperty:()=>secret})},Utilities:{computeHmacSha256Signature:(p,s)=>[...createHmac('sha256',s).update(p).digest()]},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},SpreadsheetApp:{openById:()=>{opens++;return {getSheetByName:()=>sheet};},flush(){}},ContentService:{MimeType:{JSON:'json'},createTextOutput:t=>({setMimeType:()=>JSON.parse(t)})}};
 vm.createContext(ctx);vm.runInContext(readFileSync('member-sheet-google-apps-script.gs','utf8'),ctx);
 return {ctx,rows,sheet,opens:()=>opens};
}
const signed=m=>{const payload=JSON.stringify({purpose:'member-basic-sheet',...basicMember(m),timestamp:Date.now()});return {payload,signature:createHmac('sha256',secret).update(payload).digest('hex')};};
test('missing configuration never claims sync or makes request',async()=>assert.deepEqual(await syncMemberToSheet(member,{env:{},fetchImpl:()=>assert.fail()}),{status:'not_configured'}));
test('destination restricted to Apps Script and secret length checked',async()=>{for(const config of [{...env,MEMBER_SHEET_URL:'https://evil.invalid'},{...env,MEMBER_SHEET_SECRET:'short'}])assert.equal((await syncMemberToSheet(member,{env:config,fetchImpl:()=>assert.fail()})).status,'failed');});
test('only basic fields sent; no password hash admin notes session or internal ID',async()=>{
 let payload;
 const result=await syncMemberToSheet({...member,password:'PRIVATE',password_hash:'PRIVATE',adminNotes:'PRIVATE',id:'PRIVATE',session:'PRIVATE'},{env,fetchImpl:async(_,opts)=>{payload=opts.body.get('payload');return {ok:true,json:async()=>({ok:true,memberId:member.memberId})};}});
 assert.equal(result.status,'synced');assert.doesNotMatch(payload,/PRIVATE|password|adminNotes|session/);assert.equal(JSON.parse(payload).mobile,member.mobile);
});
test('signed member write readback and replay create exactly one row',async()=>{
 const a=application();const fetchImpl=async(_,opts)=>({ok:true,json:async()=>a.ctx.doPost({parameter:Object.fromEntries(opts.body)})});
 assert.equal((await syncMemberToSheet(member,{env,fetchImpl})).status,'synced');
 assert.equal((await syncMemberToSheet(member,{env,fetchImpl})).status,'synced');
 assert.equal(a.rows.length,2);assert.deepEqual(a.rows[1].slice(0,7),[member.memberId,'店家會員',member.name,member.shopName,member.mobile,member.email,'免費會員']);assert.equal(a.rows[1][7].toISOString(),member.registeredAt);
});
test('general member shop name is empty and type visible',()=>{const a=application();assert.equal(a.ctx.doPost({parameter:signed({...member,memberType:'individual'})}).ok,true);assert.equal(a.rows[1][1],'一般會員');assert.equal(a.rows[1][3],'');});
test('forged signature cannot open sheet',()=>{const a=application();assert.equal(a.ctx.doPost({parameter:{...signed(member),signature:'0'.repeat(64)}}).ok,false);assert.equal(a.opens(),0);});
test('expired signed payload rejected',()=>{const a=application(),wire=signed(member);wire.payload=JSON.stringify({...JSON.parse(wire.payload),timestamp:Date.now()-600000});wire.signature=createHmac('sha256',secret).update(wire.payload).digest('hex');assert.equal(a.ctx.doPost({parameter:wire}).ok,false);assert.equal(a.rows.length,1);});
test('GET cannot read or write member records',()=>{const a=application();assert.equal(a.ctx.doGet().ok,false);assert.equal(a.opens(),0);});
test('invalid type or missing shop name rejected',()=>{for(const fields of [{memberType:'admin'},{shopName:''},{name:''},{mobile:''},{email:'bad'}]){const a=application();assert.equal(a.ctx.doPost({parameter:signed({...member,...fields})}).ok,false);assert.equal(a.rows.length,1);}});
test('formula-like user values written as literal text',()=>{const a=application();a.ctx.doPost({parameter:signed({...member,name:'=IMPORTDATA("https://evil.invalid")',shopName:'+SUM(1,1)',mobile:'+886900000000'})});for(const i of [2,3,4])assert.ok(a.rows[1][i].startsWith("'"));});
test('unexpected sheet headers fail without overwriting sheet',()=>{const a=application();a.rows[0][0]='unexpected';assert.equal(a.ctx.doPost({parameter:signed(member)}).ok,false);assert.equal(a.rows.length,1);});
test('incorrect acknowledgment never claims success',async()=>assert.equal((await syncMemberToSheet(member,{env,fetchImpl:async()=>({ok:true,json:async()=>({ok:true,memberId:'other'})})})).status,'failed'));
test('network error isolated and reported as uncertain',async()=>assert.equal((await syncMemberToSheet(member,{env,fetchImpl:async()=>{throw Error();}})).status,'uncertain'));
test('backend response failure never claims synced',async()=>assert.equal((await syncMemberToSheet(member,{env,fetchImpl:async()=>({ok:false})})).status,'failed'));
test('committed account remains successful when secondary sheet sync fails',async()=>{
 const module=require('../lib/member-sheet-sync.cjs'),original=module.syncMemberToSheet;let committed=false,body,status;
 module.syncMemberToSheet=async received=>{assert.equal(committed,true);assert.equal(received.memberId,member.memberId);return {status:'failed'};};
 try{
  const rt={secret,pool:{query:async()=>({rows:[{hits:1}]})},auth:{register:async()=>{committed=true;return member;}}};
  const req={method:'POST',headers:{origin:'https://lantian-live-map.vercel.app','content-type':'application/json'},body:{},socket:{}};
  const res={setHeader(){},status(n){status=n;return this;},json(value){body=value;}};
  await require('../lib/member-auth-handler.cjs').handler('register',rt)(req,res);
  assert.equal(status,201);assert.equal(body.ok,true);assert.equal(body.memberSheet.status,'failed');
 }finally{module.syncMemberToSheet=original;}
});
test('failed account creation never exports member data to Sheets',async()=>{
 const module=require('../lib/member-sheet-sync.cjs'),original=module.syncMemberToSheet;let calls=0,status;
 module.syncMemberToSheet=async()=>{calls++;return {status:'synced'};};
 try{
  const rt={secret,pool:{query:async()=>({rows:[{hits:1}]})},auth:{register:async()=>{throw Error('failed');}}};
  await require('../lib/member-auth-handler.cjs').handler('register',rt)({method:'POST',headers:{origin:'https://lantian-live-map.vercel.app','content-type':'application/json'},body:{},socket:{}},{setHeader(){},status(n){status=n;return this;},json(){}});
  assert.equal(status,503);assert.equal(calls,0);
 }finally{module.syncMemberToSheet=original;}
});
