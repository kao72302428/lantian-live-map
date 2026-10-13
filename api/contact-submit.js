const {parseResult}=require('./_contact-response');
const APPS_SCRIPT_URL='https://script.google.com/macros/s/AKfycbwimGrgk9jKgIAA2G7K0VDSDahmFZ_Q0o-WZQ0o9heeBxH7BvN9sGHk3Ee-CipZkNIa/exec';
const TYPES=['平台資訊修改','地方問題反映／協助通報','商圈意見回饋','合作提案'];
module.exports=async function handler(req,res){
 const origin='https://kao72302428.github.io';
 res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Content-Type');
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return res.status(405).json({ok:false,message:'不支援此操作。'});
 if(req.headers.origin&&req.headers.origin!==origin)return res.status(403).json({ok:false,message:'請從正式留言頁送出。'});
 const input=req.body;
 if(!input||typeof input!=='object'||Array.isArray(input))return res.status(400).json({ok:false,message:'留言格式不正確。'});
 const form=new URLSearchParams();
 for(const key of ['聯絡類型','姓名','電話','email','事實內容']){
  if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>10000)return res.status(400).json({ok:false,message:'請完整填寫留言必填欄位。'});
  form.set(key,input[key].trim());
 }
 if(!TYPES.includes(form.get('聯絡類型'))||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.get('email')))return res.status(400).json({ok:false,message:'留言類型或電子信箱格式不正確。'});
 const photo=input['照片Base64'];
 if(photo){
  if(typeof photo!=='string'||photo.length>3333336||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(photo)||!['image/jpeg','image/png','image/webp'].includes(input['照片格式']))return res.status(400).json({ok:false,message:'照片格式不正確，僅支援 2.5 MB 內的 JPG、PNG 或 WebP。'});
  const size=Buffer.from(photo,'base64').length;
  if(!size||size>2500000)return res.status(400).json({ok:false,message:'照片超過 2.5 MB 或檔案為空。'});
  form.set('照片Base64',photo);form.set('照片格式',input['照片格式']);form.set('照片檔名',String(input['照片檔名']||'照片').slice(0,200));
 }
 // Only public form fields are forwarded. Never retry a submission automatically.
 try{
  const upstream=await fetch(APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:form,redirect:'follow',signal:AbortSignal.timeout(45000)});
  const text=await upstream.text();
  if(!upstream.ok)throw new Error('Upstream unavailable');
  const data=parseResult(text);
  return res.status(data.ok?200:422).json({...data,...(!data.ok?{uncertain:true}:{} )});
 }catch{
  return res.status(502).json({ok:false,uncertain:true,message:'未收到可確認的送出結果。請聯絡平台查核試算表，勿重複送出。'});
 }
};
