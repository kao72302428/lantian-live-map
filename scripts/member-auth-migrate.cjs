'use strict';
const {createPool}=require('../lib/db.cjs');
const {migrateAuth}=require('../lib/member-auth-migrate.cjs');
async function main(){
 if(process.env.VERCEL_ENV!=='production'||process.env.VERCEL_PROJECT_ID!=='prj_peie2UmHzHErZe44RMATDl1geC4i')throw Error('PRODUCTION_PROJECT_REQUIRED');
 if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)throw Error('AUTH_NOT_CONFIGURED');
 const pool=createPool(),client=await pool.connect();
 try{console.log('MEMBER_AUTH_MIGRATION '+await migrateAuth(client));}finally{client.release();await pool.end();}
}
if(require.main===module)main().catch(()=>{console.error('MEMBER_AUTH_MIGRATION FAIL');process.exitCode=1;});
