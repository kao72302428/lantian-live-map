'use strict';

function toBool(v){return v===true;}
function normalizeLimit(value){
  const n=Number(value);
  if(!Number.isFinite(n))return 250;
  return Math.min(500,Math.max(1,Math.trunc(n)));
}
async function listMembers(queryable,{limit=250}={}){
  const safeLimit=normalizeLimit(limit);
  const [rowsResult,countResult]=await Promise.all([
    queryable.query(`SELECT
      m.member_id AS "memberId",
      m.member_type AS "memberType",
      m.name,
      m.display_name AS "displayName",
      m.mobile,
      m.email,
      m.member_status AS "memberStatus",
      m.registered_at AS "registeredAt",
      m.last_login_at AS "lastLoginAt",
      m.email_verified AS "emailVerified",
      m.mobile_verified AS "mobileVerified",
      m.suspended,
      m.updated_at AS "updatedAt",
      b.shop_id AS "shopId",
      b.shop_name AS "shopName",
      b.shop_identity AS "shopIdentity",
      b.shop_bound AS "shopBound",
      b.shop_review_status AS "shopReviewStatus",
      b.shop_change_review_status AS "shopChangeReviewStatus"
    FROM lantian_members.members m
    LEFT JOIN lantian_members.business_member_profiles b ON b.member_fk=m.id
    WHERE m.is_test=false
    ORDER BY m.registered_at DESC,m.member_id DESC
    LIMIT $1`,[safeLimit]),
    queryable.query('SELECT count(*)::int AS total FROM lantian_members.members WHERE is_test=false')
  ]);
  const items=rowsResult.rows.map(row=>({
    memberId:String(row.memberId||''),
    memberType:row.memberType==='business'?'business':'individual',
    name:String(row.name||''),
    displayName:String(row.displayName||''),
    mobile:String(row.mobile||''),
    email:String(row.email||''),
    memberStatus:String(row.memberStatus||''),
    registeredAt:row.registeredAt||null,
    lastLoginAt:row.lastLoginAt||null,
    emailVerified:toBool(row.emailVerified),
    mobileVerified:toBool(row.mobileVerified),
    suspended:toBool(row.suspended),
    updatedAt:row.updatedAt||null,
    ...(row.memberType==='business'?{
      shopId:row.shopId?String(row.shopId):null,
      shopName:String(row.shopName||''),
      shopIdentity:String(row.shopIdentity||''),
      shopBound:toBool(row.shopBound),
      shopReviewStatus:String(row.shopReviewStatus||''),
      shopChangeReviewStatus:String(row.shopChangeReviewStatus||'')
    }:{})
  }));
  return {items,total:Number(countResult.rows[0]?.total||0),limit:safeLimit};
}
module.exports={listMembers,normalizeLimit};
