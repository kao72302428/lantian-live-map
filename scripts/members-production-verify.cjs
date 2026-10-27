'use strict';
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {createPool} = require('../lib/db.cjs');
const {migrate} = require('../lib/members-migrate.cjs');
const {repository} = require('../lib/members-repository.cjs');
async function verify(pool) {
  const report = {};
  const created = [];
  let writer,reader;
  const mark = name => {report[name]='PASS';};
  try {
    writer = await pool.connect();
    assert.equal((await writer.query('SELECT 1 AS connected')).rows[0].connected,1);
    mark('production_connection');
    report.migration = await migrate(writer);
    const repo = repository(writer);
    const email = `uat-${randomUUID()}@example.invalid`;
    const row = await repo.createMember({memberType:'individual',name:'SYSTEM UAT TEST',displayName:'SYSTEM-UAT',mobile:'TEST-NOT-A-PHONE',email},
      {isTest:true,passwordHash:'TEST-ONLY-NOT-AUTHENTICATION'});
    created.push(row.id);
    assert.ok(row.id && row.member_id && row.registered_at);
    // Commit happened inside createMember; independent DB connection proves persisted readback.
    reader = await pool.connect();
    const read = await repository(reader).getMemberByMemberId(row.member_id);
    for (const key of ['member_id','member_type','email','member_status','email_verified','mobile_verified','suspended']) assert.equal(read[key],row[key]);
    assert.equal(read.member_status,'pending');
    for(const key of ['email_verified','mobile_verified','suspended']) assert.equal(read[key],false);
    assert.ok(read.updated_at && read.registered_at);
    assert.ok(!Object.hasOwn(read,'password_hash') && !Object.hasOwn(read,'password'));
    assert.equal((await repository(reader).getMemberByEmail(email.toUpperCase())).id,row.id);
    report.uat = {row_id:row.id,member_id:row.member_id,registered_at:row.registered_at.toISOString()};
    mark('insert');mark('committed_readback');mark('default_states');mark('no_password_in_response');
    async function rejected(label,sql,values,expectedCode) {
      await writer.query('BEGIN');
      let code;
      try {await writer.query(sql,values);} catch(e) {code=e.code;}
      finally {await writer.query('ROLLBACK');}
      assert.equal(code,expectedCode);mark(label);
    }
    const base = `INSERT INTO lantian_members.members(member_type,name,display_name,mobile,email) VALUES ('individual','SYSTEM UAT TEST','SYSTEM-UAT','TEST',$1)`;
    await rejected('email_unique',base,[email],'23505');
    await rejected('email_case_unique_or_normalization',base,[email.toUpperCase()],'23514');
    await rejected('member_id_unique',`INSERT INTO lantian_members.members(member_id,member_type,name,display_name,mobile,email) VALUES ($1,'individual','SYSTEM UAT TEST','SYSTEM-UAT','TEST',$2)`,[row.member_id,`uat-${randomUUID()}@example.invalid`],'23505');
    await rejected('member_type_constraint',`INSERT INTO lantian_members.members(member_type,name,display_name,mobile,email) VALUES ('invalid','SYSTEM UAT TEST','SYSTEM-UAT','TEST',$1)`,[`uat-${randomUUID()}@example.invalid`],'23514');
    await rejected('member_status_constraint',`INSERT INTO lantian_members.members(member_status,member_type,name,display_name,mobile,email) VALUES ('invalid','individual','SYSTEM UAT TEST','SYSTEM-UAT','TEST',$1)`,[`uat-${randomUUID()}@example.invalid`],'23514');
    await rejected('plaintext_password_rejected',`INSERT INTO lantian_members.members(password_hash,member_type,name,display_name,mobile,email) VALUES ('INVALID-PLAINTEXT-SENTINEL','individual','SYSTEM UAT TEST','SYSTEM-UAT','TEST',$1)`,[`uat-${randomUUID()}@example.invalid`],'23514');
    for(const shopIdentity of ['existing','new']) {
      const business = await repo.createMember({memberType:'business',name:'SYSTEM UAT TEST',displayName:'SYSTEM-UAT',mobile:'TEST',email:`uat-${randomUUID()}@example.invalid`,shopName:'SYSTEM UAT TEST SHOP',shopIdentity},{isTest:true});
      created.push(business.id);
      const b = (await reader.query('SELECT shop_id,shop_bound,shop_review_status FROM lantian_members.business_member_profiles WHERE member_fk=$1',[business.id])).rows[0];
      assert.equal(b.shop_id,null);assert.equal(b.shop_bound,false);assert.equal(b.shop_review_status,'pending');
      mark(`business_${shopIdentity}_pending`);
    }
    const before = read.updated_at;
    await writer.query('UPDATE lantian_members.members SET display_name=display_name WHERE id=$1 AND is_test=true',[row.id]);
    assert.ok((await repository(reader).getMemberByMemberId(row.member_id)).updated_at > before);
    mark('updated_at_trigger');
    assert.equal(await migrate(writer),'ALREADY_APPLIED');mark('migration_repeatable');
  } finally {
    try { if(writer) {
      // Delete only exact UUIDs produced by this invocation, also requiring the test marker.
      if(created.length) {
        await writer.query('BEGIN');
        try {
          await writer.query('DELETE FROM lantian_members.business_member_profiles WHERE member_fk IN (SELECT id FROM lantian_members.members WHERE id=ANY($1::uuid[]) AND is_test=true)',[created]);
          await writer.query('DELETE FROM lantian_members.members WHERE id=ANY($1::uuid[]) AND is_test=true',[created]);
          await writer.query('COMMIT');
          assert.equal(Number((await writer.query('SELECT count(*) AS n FROM lantian_members.members WHERE id=ANY($1::uuid[])',[created])).rows[0].n),0);
          mark('cleanup');
        } catch {await writer.query('ROLLBACK');throw new Error('CLEANUP_FAILED');}
      }
    } } finally { if(writer) writer.release(); if(reader) reader.release(); }
  }
  return report;
}
async function main() {
  if(process.env.VERCEL_ENV !== 'production' || process.env.VERCEL_PROJECT_ID !== 'prj_peie2UmHzHErZe44RMATDl1geC4i') throw new Error('PRODUCTION_PROJECT_REQUIRED');
  const pool = createPool();
  try {
    const report = await verify(pool);
    // Deliberately limited to statuses plus synthetic UAT identifiers. Never log raw errors/rows.
    console.log('MEMBERS_DB_VERIFICATION '+JSON.stringify({source_sha:process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',...report}));
  } finally {await pool.end();}
}
if(require.main === module) main().catch(e=>{
  const safe = ['UNKNOWN_SCHEMA_HOLD','MIGRATION_DRIFT_HOLD','PRODUCTION_PROJECT_REQUIRED','DB_NOT_CONFIGURED','CLEANUP_FAILED'];
  console.error('MEMBERS_DB_VERIFICATION FAIL '+(safe.includes(e.message)?e.message:'SAFE_JOB_FAILURE'));
  process.exitCode=1;
});
module.exports={verify};
