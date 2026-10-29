'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac,randomBytes}=require('node:crypto');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {sendRegistrationMail}=require('../lib/member-registration-mail.cjs');
const member={memberId:'MEM-20261030-'+randomBytes(16).toString('hex').toUpperCase(),memberType:'business',name:'SYSTEM UAT TEST',email:'receipt@example.invalid',shopName:'UAT SHOP',registeredAt:new Date().toISOString()};
const secret=randomBytes(48).toString('base64url');
const env={MEMBER_RECEIPT_URL:'https://script.google.com/macros/s/TEST_ONLY/exec',MEMBER_RECEIPT_SECRET:secret};
function app(){
 const props=new Map([['MEMBER_RECEIPT_SECRET',secret]]),sent=[];
 const ctx={PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},Utilities:{computeHmacSha256Signature:(p,s)=>[...createHmac('sha256',s).update(p).digest()],formatDate:()=> 'TEST TIME'},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},MailApp:{sendEmail:m=>sent.push(m)},ContentService:{MimeType:{JSON:'json'},createTextOutput:t=>({setMimeType:()=>JSON.parse(t)})}};
 vm.createContext(ctx);vm.runInContext(readFileSync('member-receipt-google-apps-script.gs','utf8'),ctx);return {ctx,sent};
}
test('unconfigured email never claims sent and never sends a request',async()=>{assert.deepEqual(await sendRegistrationMail(member,{env:{},fetchImpl:()=>{throw Error();}}),{status:'not_configured'});});
test('only fixed Google Apps Script web app URL accepted',async()=>{assert.equal((await sendRegistrationMail(member,{env:{...env,MEMBER_RECEIPT_URL:'https://untrusted.invalid'}})).status,'failed');});
test('signed registration notification sends once with safe member fields',async()=>{
 const {ctx,sent}=app();let wire;
 const fetchImpl=async(url,opts)=>{wire=Object.fromEntries(opts.body);return {ok:true,json:async()=>ctx.doPost({parameter:wire})};};
 assert.equal((await sendRegistrationMail({...member,password:'DO-NOT-SEND',password_hash:'DO-NOT-SEND',mobile:'DO-NOT-SEND'},{env,fetchImpl})).status,'sent');
 assert.equal(sent.length,1);assert.match(sent[0].body,/免費店家會員/);assert.doesNotMatch(sent[0].body,/DO-NOT-SEND/);assert.doesNotMatch(wire.payload,/password|mobile|secret/i);
 assert.equal(ctx.doPost({parameter:wire}).ok,true);assert.equal(sent.length,1);
});
test('wrong signature cannot send a notification',()=>{const {ctx,sent}=app();const payload=JSON.stringify({...member,purpose:'member-registration-receipt',timestamp:Date.now()});assert.equal(ctx.doPost({parameter:{payload,signature:'0'.repeat(64)}}).ok,false);assert.equal(sent.length,0);});
test('expired signed request is rejected',()=>{const {ctx,sent}=app();const payload=JSON.stringify({...member,purpose:'member-registration-receipt',timestamp:Date.now()-600000}),signature=createHmac('sha256',secret).update(payload).digest('hex');assert.equal(ctx.doPost({parameter:{payload,signature}}).ok,false);assert.equal(sent.length,0);});
test('mail acceptance must match the committed member id',async()=>{assert.equal((await sendRegistrationMail(member,{env,fetchImpl:async()=>({ok:true,json:async()=>({ok:true,receiptId:'wrong'})})})).status,'failed');});
test('network uncertainty never claims mail delivered',async()=>{assert.equal((await sendRegistrationMail(member,{env,fetchImpl:async()=>{throw Error('network');}})).status,'uncertain');});
