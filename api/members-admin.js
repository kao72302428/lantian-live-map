const {verifyAdminToken}=require('./_admin-verify');
const {createPool}=require('../lib/db.cjs');
const {listMembers}=require('../lib/members-admin-read.cjs');

const ALLOWED_ORIGINS=new Set([
  'https://kao72302428.github.io',
  'https://lantian-live-map.vercel.app'
]);

function setHeaders(req,res){
  const origin=String(req.headers.origin||'');
  if(ALLOWED_ORIGINS.has(origin))res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Vary','Origin');
}

module.exports=async function handler(req,res){
  setHeaders(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({ok:false,code:'METHOD_NOT_ALLOWED'});
  const origin=String(req.headers.origin||'');
  if(origin&&!ALLOWED_ORIGINS.has(origin))return res.status(403).json({ok:false,code:'ORIGIN_NOT_ALLOWED'});
  const idToken=String(req.body?.idToken||'').trim();
  const action=String(req.body?.action||'').trim();
  if(!idToken)return res.status(400).json({ok:false,code:'MISSING_ID_TOKEN'});
  if(action!=='list')return res.status(400).json({ok:false,code:'READ_ONLY'});
  const auth=await verifyAdminToken(idToken);
  if(!auth.body?.ok)return res.status(auth.status).json({ok:false,code:auth.body?.code||'NOT_AUTHORIZED'});
  const pool=createPool();
  try{
    const data=await listMembers(pool,{limit:250});
    return res.status(200).json({ok:true,...data});
  }catch(_){
    return res.status(503).json({ok:false,code:'MEMBER_LIST_UNAVAILABLE'});
  }finally{
    await pool.end().catch(()=>{});
  }
};
