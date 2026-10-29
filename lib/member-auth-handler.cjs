'use strict';
const session=require('express-session');
const PgStore=require('connect-pg-simple')(session);
const {createHmac}=require('node:crypto');
const {createPool}=require('./db.cjs');
const {service,fail}=require('./member-auth-service.cjs');
const ORIGIN='https://lantian-live-map.vercel.app';
const COOKIE='__Host-lantian.sid';
const AGE=7*24*60*60*1000;
const IDLE=30*60*1000;
const messages={SESSION_EXPIRED:'閒置超過 30 分鐘或登入期限已到，請重新登入',INVALID_CREDENTIALS:'Email 或密碼錯誤',ACCOUNT_UNAVAILABLE:'此會員帳號目前無法使用',UNAUTHENTICATED:'請重新登入',EMAIL_REGISTERED:'此 Email 已註冊',WEAK_PASSWORD:'密碼至少 8 碼，且不可超過 72 bytes',INVALID_EMAIL:'Email 格式不正確',INVALID_MEMBER_TYPE:'請選擇會員類別',INVALID_FIELDS:'請確認必填欄位、格式與條款勾選',RATE_LIMITED:'操作過於頻繁，請稍後再試',BAD_ORIGIN:'請從正式會員頁操作',BAD_REQUEST:'請使用正確的 JSON 表單',REGISTER_FAILED:'註冊未完成，請稍後確認或重試'};
function createRuntime(pool,secret){
 if(typeof secret!=='string'||secret.length<32)throw Error('AUTH_NOT_CONFIGURED');
 const store=new PgStore({pool,schemaName:'lantian_members',tableName:'sessions',createTableIfMissing:false,pruneSessionInterval:false,disableTouch:true,errorLog:()=>{}});
 const middleware=session({name:COOKIE,secret,store,resave:false,saveUninitialized:false,proxy:true,rolling:false,
 cookie:{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:IDLE}});
 return {pool,secret,middleware,auth:service(pool)};
}
let runtime;
function getRuntime(){
 if(process.env.VERCEL_ENV!=='production')throw Error('AUTH_NOT_CONFIGURED');
 return runtime ||= createRuntime(createPool(),process.env.SESSION_SECRET);
}
function sessionCall(obj,method){return new Promise((resolve,reject)=>obj[method](e=>e?reject(e):resolve()));}
function clearCookie(res){res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);}
async function limit(rt,req,action){
 // Vercel overwrites x-real-ip with the connecting client IP. Never trust forwarded user chains.
 const ip=req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown';
 const keys=[`${action}:ip:${ip}`];
 if(action==='login')keys.push(`${action}:email:${String(req.body?.email||'').trim().toLowerCase()}`);
 const bucket=Math.floor(Date.now()/900000);
 for(const key of keys){
  const digest=createHmac('sha256',rt.secret).update(key).digest('hex');
  const r=await rt.pool.query(`INSERT INTO lantian_members.rate_limits(bucket_key,bucket_start,hits) VALUES($1,$2,1)
    ON CONFLICT(bucket_key,bucket_start) DO UPDATE SET hits=lantian_members.rate_limits.hits+1 RETURNING hits`,[digest,bucket]);
  if(r.rows[0].hits>(action==='register'?10:key.includes(':email:')?10:40))throw fail('RATE_LIMITED',429);
 }
 await rt.pool.query('DELETE FROM lantian_members.rate_limits WHERE bucket_start<$1',[bucket-96]);
 await rt.pool.query('DELETE FROM lantian_members.sessions WHERE expire < now()');
}
function handler(action,providedRuntime){return async function(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Cookie, Origin');
 res.setHeader('X-Member-Auth-Version','20261028-1');
 const method=action==='me'?'GET':'POST';
 if(req.method!==method){res.setHeader('Allow',method);return res.status(405).json({ok:false,code:'METHOD_NOT_ALLOWED'});}
 try{
  if(action!=='me'){
   if(req.headers.origin!==ORIGIN)throw fail('BAD_ORIGIN',403);
   if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw fail('BAD_REQUEST',415);
   if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Buffer.byteLength(JSON.stringify(req.body))>40000)throw fail('BAD_REQUEST',400);
  }
  const rt=providedRuntime||getRuntime();
  if(['register','login'].includes(action))await limit(rt,req,action);
  if(action==='register'){
   const member=await rt.auth.register(req.body);
   const registrationEmail=await require('./member-registration-mail.cjs').sendRegistrationMail(member);
   return res.status(201).json({ok:true,member,registrationEmail,message:'註冊成功，已加入免費會員，可直接登入'});
  }
  await new Promise((resolve,reject)=>rt.middleware(req,res,e=>e?reject(e):resolve()));
  if(action==='login'){
   const id=await rt.auth.authenticate(req.body);
   await sessionCall(req.session,'regenerate');
   try{
    req.session.memberId=id;
    req.session.createdAt=Date.now();req.session.lastActivityAt=Date.now();
    await sessionCall(req.session,'save');
    await rt.auth.markLogin(id);
    const member=await rt.auth.current(id);
    return res.status(200).json({ok:true,member,...deadlines(req.session)});
   }catch(e){await sessionCall(req.session,'destroy');clearCookie(res);throw e;}
  }
  if(action==='logout'){
   await sessionCall(req.session,'destroy');clearCookie(res);
   return res.status(200).json({ok:true});
  }
  try{
   const now=Date.now();
   if(req.session.memberId&&(!Number.isFinite(req.session.createdAt)||!Number.isFinite(req.session.lastActivityAt)||now-req.session.lastActivityAt>=IDLE||now-req.session.createdAt>=AGE))throw fail('SESSION_EXPIRED',401);
   const member=await rt.auth.current(req.session.memberId);
   if(action==='activity'){
    req.session.lastActivityAt=now;
    req.session.cookie.maxAge=Math.min(IDLE,req.session.createdAt+AGE-now);
    await sessionCall(req.session,'save');
    return res.status(200).json({ok:true,...deadlines(req.session)});
   }
   return res.status(200).json({ok:true,member,...deadlines(req.session)});
  }
  catch(e){if(['UNAUTHENTICATED','SESSION_EXPIRED'].includes(e.code)){await sessionCall(req.session,'destroy');clearCookie(res);}throw e;}
 }catch(e){
  const code=messages[e.code]?e.code:'SERVICE_UNAVAILABLE';
  if(code==='RATE_LIMITED')res.setHeader('Retry-After','900');
  return res.status(e.status||503).json({ok:false,code,message:messages[code]||'服務暫時無法使用，請稍後再試'});
 }
};}
function deadlines(s){return {idleExpiresAt:s.lastActivityAt+IDLE,sessionExpiresAt:s.createdAt+AGE};}
module.exports={handler,createRuntime,ORIGIN,COOKIE,IDLE,AGE};

