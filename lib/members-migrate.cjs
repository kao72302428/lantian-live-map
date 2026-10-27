'use strict';
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {createHash} = require('node:crypto');
const VERSION = '001-members';
const SQL = readFileSync(join(__dirname,'../migrations/001-members.sql'),'utf8');
const CHECKSUM = createHash('sha256').update(SQL).digest('hex');
async function migrate(client) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query('SELECT pg_advisory_xact_lock(72302428, 1001)');
    const {rows:objects} = await client.query(`SELECT n.nspname AS schema,c.relname AS name
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
      AND c.relkind IN ('r','p','v','m','f','S')`);
    const allowed = new Set(['members','business_member_profiles','schema_migrations']);
    if (objects.some(o=>o.schema !== 'lantian_members' || !allowed.has(o.name))) throw new Error('UNKNOWN_SCHEMA_HOLD');
    const {rows:schemas} = await client.query("SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('information_schema','public','lantian_members')");
    if (schemas.length) throw new Error('UNKNOWN_SCHEMA_HOLD');
    const exists = (await client.query("SELECT to_regnamespace('lantian_members') AS present")).rows[0].present;
    if (exists) {
      if (objects.length !== 3) throw new Error('UNKNOWN_SCHEMA_HOLD');
      const {rows} = await client.query('SELECT version,checksum FROM lantian_members.schema_migrations');
      if (rows.length !== 1 || rows[0].version !== VERSION || rows[0].checksum !== CHECKSUM) throw new Error('MIGRATION_DRIFT_HOLD');
      await client.query('COMMIT');
      return 'ALREADY_APPLIED';
    }
    await client.query(SQL);
    await client.query('INSERT INTO lantian_members.schema_migrations(version,checksum) VALUES($1,$2)',[VERSION,CHECKSUM]);
    await client.query('COMMIT');
    return 'APPLIED';
  } catch(e) {
    await client.query('ROLLBACK');
    throw new Error(['UNKNOWN_SCHEMA_HOLD','MIGRATION_DRIFT_HOLD'].includes(e.message) ? e.message : 'MIGRATION_FAILED');
  }
}
module.exports = {migrate,VERSION,CHECKSUM};
