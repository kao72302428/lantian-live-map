'use strict';
const {createHmac}=require('node:crypto');
// Server only. A fixed allowlist prevents credentials/internal fields reaching Sheets.
function basicMember(member){
 return {memberId:member.memberId,memberType:member.memberType,name:member.name,
  shopName:member.memberType==='business'?member.shopName||'':'',mobile:member.mobile,
  email:member.email,membershipPlan:'free',registeredAt:new Date(member.registeredAt).toISOString()};
}
async function syncMemberToSheet(member,{env=process.env,fetchImpl=fetch}={}){
 const url=env.MEMBER_SHEET_URL,secret=env.MEMBER_SHEET_SECRET;
 if(!url||!secret)return {status:'not_configured'};
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)||secret.length<32)return {status:'failed'};
 try{
  const payload=JSON.stringify({purpose:'member-basic-sheet',...basicMember(member),timestamp:Date.now()});
  const signature=createHmac('sha256',secret).update(payload).digest('hex');
  const response=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:new URLSearchParams({payload,signature}),redirect:'follow',signal:AbortSignal.timeout(8000)});
  if(!response.ok)return {status:'failed'};
  const result=await response.json();
  return result.ok===true&&result.memberId===member.memberId?{status:'synced'}:{status:'failed'};
 }catch{return {status:'uncertain'};}
}
module.exports={basicMember,syncMemberToSheet};
