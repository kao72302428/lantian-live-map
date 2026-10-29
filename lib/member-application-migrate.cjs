'use strict';
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {createHash}=require('node:crypto');
const versions=['001-members','002-member-auth','003-member-application'];
const sqls=versions.map(v=>readFileSync(join(__dirname,'../migrations/'+v+'.sql'),'utf8'));
const sums=sqls.map(s=>createHash('sha256').update(s).digest('hex'));
async function migrateApplication(c){
 await c.query('BEGIN');
 try{
  await c.query("SET LOCAL lock_timeout='5s'");
  await c.query('SELECT pg_advisory_xact_lock(72302428,1001)');
  const ledger=(await c.query('SELECT version,checksum FROM lantian_members.schema_migrations')).rows;
  if(ledger.some(r=>!versions.includes(r.version))||versions.slice(0,2).some((v,i)=>ledger.find(r=>r.version===v)?.checksum!==sums[i]))throw Error('MIGRATION_DRIFT_HOLD');
  const tables=(await c.query("SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f','S')")).rows;
  const allowed=['members','business_member_profiles','schema_migrations','sessions','rate_limits'];
  if(tables.length!==allowed.length||tables.some(t=>t.schema!=='lantian_members'||!allowed.includes(t.name)))throw Error('UNKNOWN_SCHEMA_HOLD');
  const done=ledger.find(r=>r.version===versions[2]);
  const constraints=(await c.query("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='lantian_members.business_member_profiles'::regclass AND conname='business_member_profiles_shop_identity_check'")).rows;
  if(constraints.length!==1||!constraints[0].def.includes("'existing'")||!constraints[0].def.includes("'new'")||constraints[0].def.includes("'application'")!==Boolean(done))throw Error('MIGRATION_DRIFT_HOLD');
  if(done){if(done.checksum!==sums[2])throw Error('MIGRATION_DRIFT_HOLD');await c.query('COMMIT');return 'ALREADY_APPLIED';}
  await c.query(sqls[2]);
  await c.query('INSERT INTO lantian_members.schema_migrations(version,checksum) VALUES($1,$2)',[versions[2],sums[2]]);
  await c.query('COMMIT');return 'APPLIED';
 }catch(e){await c.query('ROLLBACK');throw Error(['MIGRATION_DRIFT_HOLD','UNKNOWN_SCHEMA_HOLD'].includes(e.message)?e.message:'APPLICATION_MIGRATION_FAILED');}
}
module.exports={migrateApplication};
