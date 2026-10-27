'use strict';
// Server-only. Never export configuration, credentials, or raw driver errors.
function createPool() {
  if (typeof window !== 'undefined') throw new Error('SERVER_ONLY');
  if (!process.env.DATABASE_URL) throw new Error('DB_NOT_CONFIGURED');
  const { Pool } = require('pg');
  const pool = new Pool({connectionString: process.env.DATABASE_URL,
    ssl: {rejectUnauthorized: true}, max: 2, connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 1000, statement_timeout: 15000, application_name: 'lantian-members'});
  pool.on('error', () => {}); // Request/job boundary handles sanitized failure; never log credentials.
  return pool;
}
module.exports = {createPool};
