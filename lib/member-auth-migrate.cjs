'use strict';
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {createHash}=require('node:crypto');
const {CHECKSUM:BASE_CHECKSUM}=require('./members-migrate.cjs');
const VERSION='002-member-auth';
const SQL=readFileSync(join(__dirname,'../migrations/002-member-auth.sql'),'utf8');
const CHECKSUM=createHash('sha256').update(SQL).digest('hex');
async function migrateAuth(client){
 await client.query('BEGIN');
 try{
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query('SELECT pg_advisory_xact_lock(72302428,1001)');
  const ledger=(await client.query('SELECT version,checksum FROM lantian_members.schema_migrations')).rows;
  if(ledger.find(r=>r.version==='001-members')?.checksum!==BASE_CHECKSUM)throw Error('MIGRATION_DRIFT_HOLD');
  if(ledger.some(r=>!['001-members',VERSION].includes(r.version)))throw Error('UNKNOWN_SCHEMA_HOLD');
  const done=ledger.find(r=>r.version===VERSION);
  const allowed=done?['members','business_member_profiles','schema_migrations','sessions','rate_limits']:['members','business_member_profiles','schema_migrations'];
  const objects=(await client.query("SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f','S')")).rows;
  if(objects.length!==allowed.length||objects.some(o=>o.schema!=='lantian_members'||!allowed.includes(o.name)))throw Error('UNKNOWN_SCHEMA_HOLD');
  if(done){if(done.checksum!==CHECKSUM)throw Error('MIGRATION_DRIFT_HOLD');await client.query('COMMIT');return 'ALREADY_APPLIED';}
  await client.query(SQL);
  await client.query('INSERT INTO lantian_members.schema_migrations(version,checksum) VALUES($1,$2)',[VERSION,CHECKSUM]);
  await client.query('COMMIT');return 'APPLIED';
 }catch(e){await client.query('ROLLBACK');throw Error(['MIGRATION_DRIFT_HOLD','UNKNOWN_SCHEMA_HOLD'].includes(e.message)?e.message:'AUTH_MIGRATION_FAILED');}
}
module.exports={migrateAuth};
