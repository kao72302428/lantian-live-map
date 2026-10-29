'use strict';
const {createHmac}=require('node:crypto');
async function sendRegistrationMail(member,{env=process.env,fetchImpl=fetch}={}){
 const url=env.MEMBER_RECEIPT_URL,secret=env.MEMBER_RECEIPT_SECRET;
 if(!url||!secret)return {status:'not_configured'};
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)||secret.length<32)return {status:'failed'};
 const payload=JSON.stringify({purpose:'member-registration-receipt',memberId:member.memberId,memberType:member.memberType,name:member.name,email:member.email,shopName:member.shopName||'',registeredAt:member.registeredAt,timestamp:Date.now()});
 const signature=createHmac('sha256',secret).update(payload).digest('hex');
 try{
  const r=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:new URLSearchParams({payload,signature}),redirect:'follow',signal:AbortSignal.timeout(8000)});
  if(!r.ok)return {status:'failed'};
  const data=await r.json();
  return data.ok===true&&data.receiptId===member.memberId?{status:'sent'}:{status:'failed'};
 }catch{return {status:'uncertain'};}
}
module.exports={sendRegistrationMail};
