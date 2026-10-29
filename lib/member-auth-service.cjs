'use strict';
const bcrypt=require('bcryptjs');
const {repository,normalizeEmail}=require('./members-repository.cjs');
const M=require('../member-schema.js');
function fail(code,status=400){return Object.assign(new Error(code),{code,status});}
function validPassword(value){return typeof value==='string'&&value.trim().length>0&&[...value].length>=8&&!bcrypt.truncates(value);}
function validateRegistration(input){
 if(!input||!['individual','business'].includes(input.memberType))throw fail('INVALID_MEMBER_TYPE');
 if(!validPassword(input.password))throw fail('WEAK_PASSWORD');
 let email;try{email=normalizeEmail(input.email);}catch{throw fail('INVALID_EMAIL');}
 const errors=M.validateRegistration(input.memberType,input);if(errors.length)throw fail('INVALID_FIELDS');
 const output={memberType:input.memberType,email};
 for(const f of M.fieldsFor(input.memberType)){
  if(['reserved','password-reserved','file'].includes(f.type))continue;
  const value=input[f.key];
  if(f.type==='checkbox'){if(value!==undefined&&typeof value!=='boolean')throw fail('INVALID_FIELDS');output[f.key]=value===true;}
  else{if(value!==undefined&&typeof value!=='string')throw fail('INVALID_FIELDS');if(String(value||'').length>2000)throw fail('INVALID_FIELDS');output[f.key]=String(value||'').trim();}
 }
 output.email=email;
 output.displayName=output.displayName||output.name;
 if(input.memberType==='business'){
  output.shopDisplayName=output.shopDisplayName||output.shopName;
  output.displayName=(output.shopDisplayName||output.name).slice(0,120);output.shopIdentity='application';
  output.existingShopId='';
  output.existingShopName='';
 }
 if(output.name.length>120||output.displayName.length>120)throw fail('INVALID_FIELDS');
 return output;
}
function publicMember(row,business){
 const r={memberId:row.member_id,memberType:row.member_type,name:row.name,displayName:row.display_name,mobile:row.mobile,email:row.email,
 memberStatus:row.member_status,registeredAt:row.registered_at,lastLoginAt:row.last_login_at,emailVerified:row.email_verified,mobileVerified:row.mobile_verified};
 if(business)Object.assign(r,{shopName:business.shop_name,shopIdentity:business.shop_identity,shopBound:business.shop_bound,shopReviewStatus:business.shop_review_status,shopChangeReviewStatus:business.shop_change_review_status});
 return r;
}
function unavailable(row){return row.suspended||!['pending','active'].includes(row.member_status);}
let dummy;
function service(pool){return {
 async register(input){
  const data=validateRegistration(input);
  const hash=await bcrypt.hash(input.password,12);
  const c=await pool.connect();
  try{
   const row=await repository(c).createMember(data,{passwordHash:hash});
   const business=row.member_type==='business'?(await c.query('SELECT * FROM lantian_members.business_member_profiles WHERE member_fk=$1',[row.id])).rows[0]:null;
   return publicMember(row,business);
  }catch(e){if(e.message==='MEMBER_CONFLICT')throw fail('EMAIL_REGISTERED',409);throw fail('REGISTER_FAILED',503);}
  finally{c.release();}
 },
 async authenticate(input){
  if(typeof input?.email!=='string'||typeof input?.password!=='string'||!validPassword(input.password))throw fail('INVALID_CREDENTIALS',401);
  let email;try{email=normalizeEmail(input.email);}catch{throw fail('INVALID_CREDENTIALS',401);}
  const row=(await pool.query('SELECT id,password_hash,member_status,suspended FROM lantian_members.members WHERE lower(email)=$1',[email])).rows[0];
  dummy ||= bcrypt.hash('UNUSABLE-DUMMY-'+require('node:crypto').randomBytes(24).toString('hex'),12);
  const hash=row?.password_hash&&/^\$2[aby]\$/.test(row.password_hash)?row.password_hash:await dummy;
  if(!await bcrypt.compare(input.password,hash)||!row?.password_hash)throw fail('INVALID_CREDENTIALS',401);
  if(unavailable(row))throw fail('ACCOUNT_UNAVAILABLE',403);
  return row.id;
 },
 async markLogin(id){
  const r=await pool.query("UPDATE lantian_members.members SET last_login_at=clock_timestamp() WHERE id=$1 AND suspended=false AND member_status IN ('pending','active') RETURNING id",[id]);
  if(!r.rowCount)throw fail('ACCOUNT_UNAVAILABLE',403);
 },
 async current(id){
  if(!id)throw fail('UNAUTHENTICATED',401);
  const row=(await pool.query('SELECT * FROM lantian_members.members WHERE id=$1',[id])).rows[0];
  if(!row||unavailable(row))throw fail('UNAUTHENTICATED',401);
  const b=row.member_type==='business'?(await pool.query('SELECT * FROM lantian_members.business_member_profiles WHERE member_fk=$1',[id])).rows[0]:null;
  return publicMember(row,b);
 }
};}
module.exports={service,validPassword,validateRegistration,publicMember,fail};

