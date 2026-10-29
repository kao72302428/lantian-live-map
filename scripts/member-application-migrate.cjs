'use strict';
async function main(){
 if(process.env.VERCEL_ENV!=='production'||process.env.VERCEL_PROJECT_ID!=='prj_peie2UmHzHErZe44RMATDl1geC4i')throw Error('PRODUCTION_PROJECT_REQUIRED');
 const pool=require('../lib/db.cjs').createPool(),c=await pool.connect();
 try{console.log('MEMBER_APPLICATION_MIGRATION '+await require('../lib/member-application-migrate.cjs').migrateApplication(c));}finally{c.release();await pool.end();}
}
main().catch(()=>{console.error('MEMBER_APPLICATION_MIGRATION FAIL');process.exitCode=1;});
