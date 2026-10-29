'use strict';
// Production-only UAT. Never logs credentials, cookies, hashes, or real member rows.
const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const bcrypt=require('bcryptjs');
const {syncMemberToSheet}=require('../lib/member-sheet-sync.cjs');
const ORIGIN='https://lantian-live-map.vercel.app';
async function main(){
 if(process.env.VERCEL_ENV!=='production'||process.env.VERCEL_PROJECT_ID!=='prj_peie2UmHzHErZe44RMATDl1geC4i'||!process.env.MEMBER_SHEET_SECRET||!process.env.MEMBER_SHEET_URL)throw Error('PRODUCTION_CONFIG_REQUIRED');
 const pool=require('../lib/db.cjs').createPool(),checks={},created=[];
 const records=['individual','business'].map(memberType=>({memberType,name:'SYSTEM SHEET UAT TEST',mobile:'0900000000',email:'uat-sheet-'+randomUUID()+'@example.invalid',password:randomBytes(24).toString('base64url'),termsAccepted:true,privacyAccepted:true,...(memberType==='business'?{shopName:'SYSTEM SHEET UAT TEST SHOP'}:{})}));
 const fingerprint=async()=> (await pool.query(`SELECT
  (SELECT md5(coalesce(string_agg(to_jsonb(m)::text,'|' ORDER BY m.id),'')) FROM lantian_members.members m WHERE email<>ALL($1::text[])) AS members,
  (SELECT md5(coalesce(string_agg(to_jsonb(b)::text,'|' ORDER BY b.member_fk),'')) FROM lantian_members.business_member_profiles b JOIN lantian_members.members m ON m.id=b.member_fk WHERE m.email<>ALL($1::text[])) AS profiles`,[records.map(x=>x.email)])).rows[0];
 const before=await fingerprint();
 async function call(action,body,cookie){
  const response=await fetch(ORIGIN+'/api/members/'+action,{method:body===undefined?'GET':'POST',headers:{Origin:ORIGIN,...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(45000)});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
 }
 try{
  for(const input of records){
   const kind=input.memberType,reg=await call('register',input);
   assert.equal(reg.status,201);assert.equal(reg.data.ok,true);
   const member=reg.data.member;created.push({memberId:member.memberId,memberType:kind});
   checks[kind+'_register']='PASS';
   checks[kind+'_sync_status']=reg.data.memberSheet?.status||'missing';
   // Verify the secret actually signs accepted writes; no secret is read back.
   const sync=await syncMemberToSheet(member);
   assert.equal(sync.status,'synced');checks[kind+'_signed_sync']='PASS';
   assert.equal((await syncMemberToSheet(member)).status,'synced');checks[kind+'_replay_ack']='PASS';
   const c=await pool.connect();
   try{
    const row=(await c.query('SELECT id,member_id,password_hash FROM lantian_members.members WHERE email=$1',[input.email])).rows[0];
    assert.equal(row.member_id,member.memberId);assert.notEqual(row.password_hash,input.password);assert.ok(await bcrypt.compare(input.password,row.password_hash));checks[kind+'_db_readback']='PASS';
    if(kind==='business'){
     const b=(await c.query('SELECT shop_bound,shop_id FROM lantian_members.business_member_profiles WHERE member_fk=$1',[row.id])).rows[0];
     assert.equal(b.shop_bound,false);assert.equal(b.shop_id,null);checks.business_not_bound='PASS';
    }
   }finally{c.release();}
   const dup=await call('register',{...input,email:input.email.toUpperCase()});assert.equal(dup.status,409);checks[kind+'_duplicate_rejected']='PASS';
   const login=await call('login',{email:input.email,password:input.password});assert.equal(login.status,200);
   assert.ok(login.cookie);const cookie=login.cookie.split(';')[0];
   const me=await call('me',undefined,cookie);assert.equal(me.status,200);assert.equal(me.data.member.memberId,member.memberId);
   assert.equal((await call('logout',{},cookie)).status,200);assert.equal((await call('me',undefined,cookie)).status,401);checks[kind+'_login_me_logout']='PASS';
  }
 }finally{
  const c=await pool.connect(),emails=records.map(x=>x.email);
  try{
   await c.query('BEGIN');
   const ids=(await c.query("SELECT id FROM lantian_members.members WHERE email=ANY($1::text[]) AND name='SYSTEM SHEET UAT TEST'",[emails])).rows.map(x=>x.id);
   await c.query("DELETE FROM lantian_members.sessions WHERE sess->>'memberId'=ANY($1::text[])",[ids]);
   await c.query('DELETE FROM lantian_members.business_member_profiles WHERE member_fk=ANY($1::uuid[])',[ids]);
   await c.query("DELETE FROM lantian_members.members WHERE id=ANY($1::uuid[]) AND email=ANY($2::text[]) AND name='SYSTEM SHEET UAT TEST'",[ids,emails]);
   await c.query('COMMIT');
   assert.equal(Number((await c.query('SELECT count(*) AS n FROM lantian_members.members WHERE email=ANY($1::text[])',[emails])).rows[0].n),0);
   checks.db_test_cleanup='PASS';assert.deepEqual(await fingerprint(),before);checks.real_members_unchanged='PASS';
  }catch{await c.query('ROLLBACK');throw Error('UAT_CLEANUP_FAILED');}
  finally{
   c.release();records.forEach(x=>x.password='');await pool.end();
   // Public IDs belong only to generated synthetic test records; used for Sheet cleanup.
   console.log('MEMBER_SHEET_UAT '+JSON.stringify({sourceSha:process.env.VERCEL_GIT_COMMIT_SHA,checks,testRows:created,sheetCleanup:'PENDING_CONNECTOR_READBACK'}));
  }
 }
}
main().catch(()=>{console.error('MEMBER_SHEET_UAT FAIL');process.exitCode=1;});
