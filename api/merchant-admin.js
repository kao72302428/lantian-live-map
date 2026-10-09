const { verifyAdminToken } = require('./_admin-verify');
const REPO='kao72302428/lantian-live-map';
const PATH='merchants.js';
const ORIGIN='https://kao72302428.github.io';
const GROUPS=new Set(['美食餐飲','購物零售','居家服務','醫療保健','生活服務','教育休閒']);
const LIMIT=2000;
function headers(token){return {'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'};}
function decode(source){
 const match=/^window\.MERCHANTS\s*=\s*(\[[\s\S]*\]);?\s*$/.exec(source.trim());
 if(!match)throw Error('INVALID_SOURCE_FORMAT');
 const data=JSON.parse(match[1]);
 if(!Array.isArray(data)||data.length<157||new Set(data.map(x=>x.id)).size!==data.length)throw Error('INVALID_MERCHANT_DATA');
 return data;
}
function sanitize(raw,old){
 const value={...old};
 for(const [name,max] of [['name',120],['address',200],['group',40],['sub',80],['area',80],['phone',50],['description',1000],['map',500],['website',500],['social',500]]){
   if(Object.prototype.hasOwnProperty.call(raw,name))value[name]=String(raw[name]??'').trim().slice(0,max);
 }
 if(!value.name||!value.address||!GROUPS.has(value.group))throw Error('INVALID_FIELDS');
 for(const field of ['map','website','social']){
   if(value[field]&&!/^https:\/\//i.test(value[field]))throw Error('INVALID_URL');
 }
 return value;
}
async function read(token){
 const response=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+PATH+'?ref=main',{headers:headers(token)});
 const body=await response.json().catch(()=>({}));
 if(!response.ok||!body.sha||!body.content)throw Error('STORAGE_READ_FAILED');
 const source=Buffer.from(body.content.replace(/\s/g,''),'base64').toString('utf8');
 return {items:decode(source),sha:body.sha};
}
async function write(token,items,sha,description){
 const source='window.MERCHANTS = '+JSON.stringify(items,null,2)+';\n';
 const response=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+PATH,{method:'PUT',headers:headers(token),body:JSON.stringify({message:description,content:Buffer.from(source).toString('base64'),sha,branch:'main'})});
 if(response.status===409)return {ok:false,code:'STALE_DATA'};
 if(!response.ok)throw Error('STORAGE_WRITE_FAILED');
 return {ok:true};
}
module.exports=async(req,res)=>{
 const origin=req.headers?.origin||'';
 res.setHeader('Access-Control-Allow-Origin',origin===ORIGIN?origin:ORIGIN);
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Content-Type');
 res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return res.status(405).json({ok:false,code:'METHOD_NOT_ALLOWED'});
 const tokenId=String(req.body?.idToken||'');
 const auth=await verifyAdminToken(tokenId);
 if(!auth.body.ok)return res.status(auth.status).json({ok:false,code:auth.body.code});
 const storageToken=String(process.env.GITHUB_CONTENT_TOKEN||'').trim();
 if(!storageToken)return res.status(503).json({ok:false,code:'STORAGE_NOT_CONFIGURED'});
 const action=String(req.body?.action||'');
 try{
  const {items,sha}=await read(storageToken);
  if(action==='list')return res.status(200).json({ok:true,items});
  // No deletion action: preserve every existing merchant record.
  if(action==='upsert'){
    const raw=req.body?.item;
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return res.status(400).json({ok:false,code:'INVALID_ITEM'});
    const id=String(raw.id||'').trim();
    const index=items.findIndex(x=>x.id===id);
    if(id&&index<0)return res.status(404).json({ok:false,code:'UNKNOWN_ID'});
    if(items.length>=LIMIT&&index<0)return res.status(400).json({ok:false,code:'MERCHANT_LIMIT'});
    const newId=index>=0?id:'NEW'+Date.now().toString(36);
    const item={...sanitize(raw,index>=0?items[index]:{}),id:newId};
    if(index>=0)items[index]=item;else items.push(item);
    const written=await write(storageToken,items,sha,'Admin '+(index>=0?'update':'add')+' merchant '+newId);
    if(!written.ok)return res.status(409).json(written);
    return res.status(200).json({ok:true,items,item});
  }
  return res.status(400).json({ok:false,code:'UNKNOWN_ACTION'});
 }catch(error){
  if(['INVALID_FIELDS','INVALID_URL','INVALID_ITEM'].includes(error.message))return res.status(400).json({ok:false,code:error.message});
  console.error('merchant admin operation failed',error.message);
  return res.status(502).json({ok:false,code:'STORAGE_UNAVAILABLE'});
 }
};
