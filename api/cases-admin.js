const APPS_SCRIPT_URL='https://script.google.com/macros/s/AKfycbwimGrgk9jKgIAA2G7K0VDSDahmFZ_Q0o-WZQ0o9heeBxH7BvN9sGHk3Ee-CipZkNIa/exec';

module.exports=async function handler(req,res){
 const allowedOrigin='https://kao72302428.github.io';
 const origin=req.headers.origin||'';
 res.setHeader('Access-Control-Allow-Origin',origin===allowedOrigin?origin:allowedOrigin);
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Content-Type');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Vary','Origin');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return res.status(405).json({ok:false,code:'METHOD_NOT_ALLOWED'});
 const idToken=String(req.body?.idToken||'').trim();
 const action=String(req.body?.action||'').trim();
 if(!idToken||!action)return res.status(400).json({ok:false,code:'MISSING_ARGUMENT'});
 const gatewaySecret=String(process.env.CASES_ADMIN_GATEWAY_SECRET||'').trim();
 if(!gatewaySecret)return res.status(503).json({ok:false,code:'CASE_GATEWAY_NOT_CONFIGURED'});
 try{
  const auth=await fetch('https://lantian-live-map.vercel.app/api/admin-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})});
  const authData=await auth.json().catch(()=>({}));
  if(!auth.ok||!authData.ok)return res.status(401).json({ok:false,code:'NOT_AUTHORIZED'});
  const form=new URLSearchParams({adminAction:action,gatewaySecret});
  if(req.body?.id)form.set('id',String(req.body.id));
  if(req.body?.status)form.set('status',String(req.body.status));
  if(req.body?.reply)form.set('reply',String(req.body.reply));
  const upstream=await fetch(APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:form,redirect:'follow'});
  const text=await upstream.text();
  let data;try{data=JSON.parse(text);}catch{return res.status(502).json({ok:false,code:'CASE_SERVICE_BAD_RESPONSE'});}
  if(!data.ok)return res.status(400).json(data);
  return res.status(200).json(data);
 }catch(e){
  console.error(e);
  return res.status(502).json({ok:false,code:'CASE_SERVICE_UNREACHABLE'});
 }
};