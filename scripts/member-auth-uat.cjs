'use strict';
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const bcrypt=require('bcryptjs');
const M=require('../member-schema.js');
const {ORIGIN}=require('../lib/member-auth-handler.cjs');
function fixture(type){
 const d={memberType:type,password:randomBytes(20).toString('base64url')};
 for(const f of M.fieldsFor(type)){
  if(['reserved','password-reserved','file'].includes(f.type))continue;
  if(f.type==='checkbox')d[f.key]=true;
  else if(f.required)d[f.key]=f.type==='select'?f.options[0]:'SYSTEM UAT TEST';
 }
 d.name='SYSTEM UAT TEST';d.email=`uat-auth-${randomUUID()}@example.invalid`;d.mobile='TEST-NOT-A-PHONE';
 if(type==='business'){d.shopIdentity='existing';d.existingShopName='SYSTEM UAT TEST SHOP';}
 return d;
}
async function runProduction(pool){
 const checks={},records=[fixture('individual'),fixture('business')];
 const mark=k=>checks[k]='PASS';
 async function call(action,body,cookie){
  const res=await fetch(`${ORIGIN}/api/members/${action}`,{method:body===undefined?'GET':'POST',headers:{Origin:ORIGIN,...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000),redirect:'manual'});
  assert.equal(res.headers.get('x-member-auth-version'),'20261028-1');
  let data;try{data=await res.json();}catch{throw Error('PRODUCTION_HTTP_UNAVAILABLE');}
  return {status:res.status,data,setCookie:res.headers.get('set-cookie')};
 }
 try{
  for(const [i,data] of records.entries()){
   const reg=await call('register',data);assert.equal(reg.status,201);assert.equal(reg.data.ok,true);
   assert.ok(reg.data.member.memberId);mark(i?'business_register':'individual_register');
   // Independent SQL connection after HTTP transaction COMMIT.
   const c=await pool.connect();
   try{
    const row=(await c.query('SELECT id,member_id,password_hash,member_status,email_verified,mobile_verified,suspended FROM lantian_members.members WHERE email=$1',[data.email])).rows[0];
    assert.equal(row.member_id,reg.data.member.memberId);assert.notEqual(row.password_hash,data.password);assert.ok(await bcrypt.compare(data.password,row.password_hash));
    assert.equal(row.member_status,'pending');assert.equal(row.email_verified,false);assert.equal(row.mobile_verified,false);assert.equal(row.suspended,false);
    mark('committed_independent_readback');mark('password_hash_protection');
    if(i){const b=(await c.query('SELECT shop_id,shop_bound,shop_review_status FROM lantian_members.business_member_profiles WHERE member_fk=$1',[row.id])).rows[0];assert.equal(b.shop_id,null);assert.equal(b.shop_bound,false);assert.equal(b.shop_review_status,'pending');mark('business_profile');mark('business_pending');mark('business_unbound');}
   }finally{c.release();}
   const dup=await call('register',{...data,email:data.email.toUpperCase()});assert.equal(dup.status,409);mark('duplicate_email');
   const bad=await call('login',{email:data.email,password:randomBytes(20).toString('hex')});assert.equal(bad.status,401);mark('wrong_password');
   const login=await call('login',{email:data.email,password:data.password});assert.equal(login.status,200);assert.ok(login.setCookie);
   for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert.ok(login.setCookie.includes(flag));mark('login');mark('cookie_flags');
   const cookie=login.setCookie.split(';')[0]; // Memory only; never log or return cookie values.
   const me=await call('me',undefined,cookie);assert.equal(me.status,200);assert.equal(me.data.member.memberId,reg.data.member.memberId);assert.ok(me.data.member.lastLoginAt);mark('me_current_member');mark('last_login_at');
   for(const key of ['password_hash','passwordHash','password','admin_notes','adminNotes','id','sessionSecret'])assert.ok(!Object.hasOwn(me.data.member,key));mark('response_minimization');
   const out=await call('logout',{},cookie);assert.equal(out.status,200);assert.ok(out.setCookie.includes('Max-Age=0'));
   assert.equal((await call('me',undefined,cookie)).status,401);mark('logout_revoked');
  }
  assert.equal((await call('me')).status,401);mark('me_requires_session');
 }finally{
  const emails=records.map(x=>x.email),c=await pool.connect();
  try{
   await c.query('BEGIN');
   const ids=(await c.query("SELECT id FROM lantian_members.members WHERE email=ANY($1::text[]) AND name='SYSTEM UAT TEST'",[emails])).rows.map(x=>x.id);
   await c.query("DELETE FROM lantian_members.sessions WHERE sess->>'memberId'=ANY($1::text[])",[ids]);
   await c.query('DELETE FROM lantian_members.business_member_profiles WHERE member_fk=ANY($1::uuid[])',[ids]);
   await c.query("DELETE FROM lantian_members.members WHERE id=ANY($1::uuid[]) AND email=ANY($2::text[]) AND name='SYSTEM UAT TEST'",[ids,emails]);
   await c.query('COMMIT');
   assert.equal(Number((await c.query('SELECT count(*) AS n FROM lantian_members.members WHERE email=ANY($1::text[])',[emails])).rows[0].n),0);mark('cleanup');
  }catch{await c.query('ROLLBACK');throw Error('UAT_CLEANUP_FAILED');}
  finally{c.release();records.forEach(x=>x.password='');}
 }
 return checks;
}
async function main(){
 if(process.env.VERCEL_ENV!=='production'||process.env.VERCEL_PROJECT_ID!=='prj_peie2UmHzHErZe44RMATDl1geC4i')throw Error('PRODUCTION_PROJECT_REQUIRED');
 const pool=require('../lib/db.cjs').createPool();
 try{console.log('MEMBER_AUTH_PRODUCTION '+JSON.stringify({source_sha:process.env.VERCEL_GIT_COMMIT_SHA,...await runProduction(pool)}));}finally{await pool.end();}
}
if(require.main===module)main().catch(()=>{console.error('MEMBER_AUTH_PRODUCTION FAIL');process.exitCode=1;});
module.exports={fixture,runProduction};
