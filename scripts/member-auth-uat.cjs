'use strict';
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const bcrypt=require('bcryptjs');
const {ORIGIN}=require('../lib/member-auth-handler.cjs');
function fixture(type){
 const d={memberType:type,password:randomBytes(20).toString('base64url')};
 d.name='SYSTEM UAT TEST';d.email=`uat-auth-${randomUUID()}@example.invalid`;d.mobile='TEST-NOT-A-PHONE';
 d.termsAccepted=true;d.privacyAccepted=true;
 if(type==='business'){d.shopName='SYSTEM UAT TEST SHOP';}
 return d;
}
async function runProduction(pool){
 const checks={},records=[fixture('individual'),fixture('business')];
 const mark=k=>checks[k]='PASS';
 const fingerprint=async()=>{
  const r=await pool.query(`SELECT
   (SELECT md5(coalesce(string_agg(to_jsonb(m)::text,'|' ORDER BY m.id),'')) FROM lantian_members.members m WHERE email<>ALL($1::text[])) AS members,
   (SELECT md5(coalesce(string_agg(to_jsonb(b)::text,'|' ORDER BY b.member_fk),'')) FROM lantian_members.business_member_profiles b JOIN lantian_members.members m ON m.id=b.member_fk WHERE m.email<>ALL($1::text[])) AS profiles`,[records.map(x=>x.email)]);
  return r.rows[0]; // Aggregate digest only; never log existing member data.
 };
 const before=await fingerprint();
 async function call(action,body,cookie){
  const res=await fetch(`${ORIGIN}/api/members/${action}`,{method:body===undefined?'GET':'POST',headers:{Origin:ORIGIN,...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000),redirect:'manual'});
  assert.equal(res.headers.get('x-member-auth-version'),'20261028-1');
  let data;try{data=await res.json();}catch{throw Error('PRODUCTION_HTTP_UNAVAILABLE');}
  return {status:res.status,data,setCookie:res.headers.get('set-cookie')};
 }
 try{
  for(const [i,data] of records.entries()){
   const reg=await call('register',data);assert.equal(reg.status,201);assert.equal(reg.data.ok,true);
   assert.ok(reg.data.member.memberId);mark(i?'business_register':'individual_register');if(i){assert.equal(reg.data.member.shopIdentity,'application');mark('business_application_minimal');}
   // Independent SQL connection after HTTP transaction COMMIT.
   const c=await pool.connect();
   try{
    const row=(await c.query('SELECT id,member_id,password_hash,member_status,email_verified,mobile_verified,suspended FROM lantian_members.members WHERE email=$1',[data.email])).rows[0];
    assert.equal(row.member_id,reg.data.member.memberId);assert.equal(reg.data.member.displayName,i?data.shopName:data.name);assert.notEqual(row.password_hash,data.password);assert.ok(await bcrypt.compare(data.password,row.password_hash));
    assert.equal(row.member_status,'pending');assert.equal(row.email_verified,false);assert.equal(row.mobile_verified,false);assert.equal(row.suspended,false);
    mark('committed_independent_readback');mark('password_hash_protection');
    if(i){const b=(await c.query('SELECT shop_id,shop_bound,shop_review_status FROM lantian_members.business_member_profiles WHERE member_fk=$1',[row.id])).rows[0];assert.equal(b.shop_id,null);assert.equal(b.shop_bound,false);assert.equal(b.shop_review_status,'pending');mark('business_profile');mark('business_pending');mark('business_unbound');}
   }finally{c.release();}
   const dup=await call('register',{...data,email:data.email.toUpperCase()});assert.equal(dup.status,409);mark('duplicate_email');
   const bad=await call('login',{email:data.email,password:randomBytes(20).toString('hex')});assert.equal(bad.status,401);mark('wrong_password');
   const login=await call('login',{email:data.email,password:data.password});assert.equal(login.status,200);assert.ok(login.setCookie);
   for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert.ok(login.setCookie.includes(flag));mark('login');mark(i?'business_login':'individual_login');mark('cookie_flags');
   const cookie=login.setCookie.split(';')[0]; // Memory only; never log or return cookie values.
   const me=await call('me',undefined,cookie);assert.equal(me.status,200);assert.equal(me.data.member.memberId,reg.data.member.memberId);assert.ok(me.data.member.lastLoginAt);mark('me_current_member');mark(i?'business_me':'individual_me');mark('last_login_at');
   const activity=await call('activity',{},cookie);assert.equal(activity.status,200);assert.ok(activity.data.idleExpiresAt>=me.data.idleExpiresAt);assert.equal(activity.data.sessionExpiresAt,me.data.sessionExpiresAt);mark('activity_refresh');
   for(const key of ['password_hash','passwordHash','password','admin_notes','adminNotes','id','sessionSecret'])assert.ok(!Object.hasOwn(me.data.member,key));mark('response_minimization');
   const out=await call('logout',{},cookie);assert.equal(out.status,200);assert.ok(out.setCookie.includes('Max-Age=0'));
   assert.equal((await call('me',undefined,cookie)).status,401);mark('logout_revoked');mark(i?'business_logout':'individual_logout');
  }
  const data=records[0],fresh=await call('login',{email:data.email,password:data.password});assert.equal(fresh.status,200);
  const expiredCookie=fresh.setCookie.split(';')[0];
  // Backdate only this generated test account's sessions; never wait or touch real users.
  await pool.query("UPDATE lantian_members.sessions SET sess=jsonb_set(sess::jsonb,'{lastActivityAt}',$1::jsonb)::json WHERE sess->>'memberId'=(SELECT id::text FROM lantian_members.members WHERE email=$2 AND name='SYSTEM UAT TEST')",[JSON.stringify(Date.now()-1800001),data.email]);
  const expired=await call('me',undefined,expiredCookie);assert.equal(expired.status,401);assert.equal(expired.data.code,'SESSION_EXPIRED');assert.ok(expired.setCookie.includes('Max-Age=0'));mark('idle_timeout_rejected');
  assert.equal((await call('activity',{},expiredCookie)).status,401);mark('expired_session_not_revivable');
  const remaining=(await pool.query("SELECT count(*) AS n FROM lantian_members.sessions WHERE sess->>'memberId'=(SELECT id::text FROM lantian_members.members WHERE email=$1)",[data.email])).rows[0];assert.equal(Number(remaining.n),0);mark('idle_session_deleted');
  const absolute=await call('login',{email:data.email,password:data.password});assert.equal(absolute.status,200);const absoluteCookie=absolute.setCookie.split(';')[0];
  await pool.query("UPDATE lantian_members.sessions SET sess=jsonb_set(jsonb_set(sess::jsonb,'{createdAt}',$1::jsonb),'{lastActivityAt}',$2::jsonb)::json WHERE sess->>'memberId'=(SELECT id::text FROM lantian_members.members WHERE email=$3 AND name='SYSTEM UAT TEST')",[JSON.stringify(Date.now()-604800001),JSON.stringify(Date.now()),data.email]);
  const absoluteMe=await call('me',undefined,absoluteCookie);assert.equal(absoluteMe.status,401);assert.equal(absoluteMe.data.code,'SESSION_EXPIRED');mark('absolute_7_day_timeout_rejected_despite_recent_activity');
  assert.equal((await call('activity',{},absoluteCookie)).status,401);mark('absolute_expired_session_not_revivable');
  const absoluteRemaining=(await pool.query("SELECT count(*) AS n FROM lantian_members.sessions WHERE sess->>'memberId'=(SELECT id::text FROM lantian_members.members WHERE email=$1)",[data.email])).rows[0];assert.equal(Number(absoluteRemaining.n),0);mark('absolute_session_deleted');
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
   assert.equal(Number((await c.query('SELECT count(*) AS n FROM lantian_members.members WHERE email=ANY($1::text[])',[emails])).rows[0].n),0);mark('cleanup');assert.deepEqual(await fingerprint(),before);mark('existing_records_unchanged');
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

