'use strict';
// Run only in trusted Production runtime. No credentials or member rows are printed.
const {createPool}=require('../lib/db.cjs');
const {syncMemberToSheet}=require('../lib/member-sheet-sync.cjs');
async function main(){
 if(process.env.VERCEL_ENV!=='production'||!process.env.MEMBER_SHEET_URL||!process.env.MEMBER_SHEET_SECRET)throw Error('SHEET_NOT_CONFIGURED');
 const pool=createPool();let synced=0;
 try{
  let cursor='';
  while(true){
   const {rows}=await pool.query(`SELECT m.member_id AS "memberId",m.member_type AS "memberType",m.name,m.mobile,m.email,m.registered_at AS "registeredAt",b.shop_name AS "shopName"
     FROM lantian_members.members m LEFT JOIN lantian_members.business_member_profiles b ON b.member_fk=m.id
     WHERE m.is_test=false AND m.member_id>$1 ORDER BY m.member_id LIMIT 100`,[cursor]);
   if(!rows.length)break;
   for(const member of rows){
    const result=await syncMemberToSheet(member);
    if(result.status!=='synced')throw Error('SHEET_SYNC_INCOMPLETE');
    synced++;cursor=member.memberId;
   }
  }
  console.log(JSON.stringify({memberSheetBackfill:'PASS',synced}));
 }finally{await pool.end();}
}
main().catch(()=>{console.error('Member sheet backfill incomplete; no member data logged.');process.exitCode=1;});
