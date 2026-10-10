const { verifyAdminToken } = require('./_admin-verify');
const REPO='kao72302428/lantian-live-map';
const PATH='merchants.js';
// UAT-only: never write the production main branch from this endpoint.
const TARGET_BRANCH='feature/merchant-admin-phase2-access-20261010';
const ORIGIN='https://kao72302428.github.io';
const GROUPS=new Set(['美食餐飲','購物零售','居家服務','醫療保健','生活服務','教育休閒']);
const LIMIT=2000;
const SORT_LIMIT=100000;
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
 if(Object.prototype.hasOwnProperty.call(raw,'published'))value.published=raw.published===true;
 if(Object.prototype.hasOwnProperty.call(raw,'sortOrder')){const order=Number(raw.sortOrder);if(!Number.isInteger(order)||order<0||order>SORT_LIMIT)throw Error('INVALID_SORT_ORDER');value.sortOrder=order;}
 return value;
}
async function read(token){
 const response=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+PATH+'?ref='+encodeURIComponent(TARGET_BRANCH),{headers:headers(token)});
 const body=await response.json().catch(()=>({}));
 if(!response.ok||!body.sha||!body.content)throw Error('STORAGE_READ_FAILED');
 const source=Buffer.from(body.content.replace(/\s/g,''),'base64').toString('utf8');
 return {items:decode(source),sha:body.sha};
}
async function write(token,items,sha,description){
 const source='window.MERCHANTS = '+JSON.stringify(items,null,2)+';\n';
 const response=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+PATH,{method:'PUT',headers:headers(token),body:JSON.stringify({message:description,content:Buffer.from(source).toString('base64'),sha,branch:TARGET_BRANCH})});
 if(response.status===409)return {ok:false,code:'STALE_DATA'};
 if(!response.ok)throw Error('STORAGE_WRITE_FAILED');
 const result=await response.json().catch(()=>({}));
 return {ok:true,sha:result.content?.sha||null};
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
 const storageToken=String(process.env.MERCHANT_UAT_GITHUB_TOKEN||'').trim();
 if(!storageToken)return res.status(503).json({ok:false,code:'STORAGE_NOT_CONFIGURED'});
 const action=String(req.body?.action||'');
 // Explicit preview-only gate. Never permit writes from a production deployment.
 if(action!=='list'&&(process.env.VERCEL_ENV!=='preview'||process.env.MERCHANT_UAT_WRITES_ENABLED!=='true'))
  return res.status(403).json({ok:false,code:'UAT_WRITE_DISABLED'});
 try{
  const {items,sha}=await read(storageToken);
  if(action==='list')return res.status(200).json({ok:true,items,sha,branch:TARGET_BRANCH});
  // Require the exact version originally loaded by the editor, not only the latest read-before-write SHA.
  if(typeof req.body?.expectedSha!=='string'||!req.body.expectedSha.trim())return res.status(400).json({ok:false,code:'MISSING_EXPECTED_SHA'});
  if(req.body.expectedSha!==sha)return res.status(409).json({ok:false,code:'STALE_DATA'});
  // No deletion action: preserve every existing merchant record.
  if(action==='setPublished'||action==='setSortOrder'){
    const id=String(req.body?.id||'').trim();
    const index=items.findIndex(x=>x.id===id);
    if(index<0)return res.status(404).json({ok:false,code:'NOT_FOUND'});
    if(action==='setPublished'){
      if(typeof req.body?.published!=='boolean')return res.status(400).json({ok:false,code:'INVALID_PUBLISHED'});
      items[index]={...items[index],published:req.body.published};
    }else{
      const order=req.body?.sortOrder;
      if(!Number.isInteger(order)||order<0||order>SORT_LIMIT)return res.status(400).json({ok:false,code:'INVALID_SORT_ORDER'});
      items[index]={...items[index],sortOrder:order};
    }
    const written=await write(storageToken,items,sha,'UAT merchant '+action+' '+id);
    if(!written.ok)return res.status(409).json(written);
    return res.status(200).json({ok:true,items,item:items[index],sha:written.sha});
  }
  if(action==='upsert'){
    const raw=req.body?.item;
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return res.status(400).json({ok:false,code:'INVALID_ITEM'});
    const id=String(raw.id||'').trim();
    const index=items.findIndex(x=>x.id===id);
    if(id&&index<0)return res.status(404).json({ok:false,code:'UNKNOWN_ID'});
    if(items.length>=LIMIT&&index<0)return res.status(400).json({ok:false,code:'MERCHANT_LIMIT'});
    const newId=index>=0?id:'NEW'+require('node:crypto').randomUUID().replace(/-/g,'');
    const item={...sanitize(raw,index>=0?items[index]:{published:false}),id:newId};
    // Publication changes must use the dedicated action, never an upsert payload.
    item.published=index>=0?items[index].published!==false:false;
    if(index>=0)items[index]=item;else items.push(item);
    const written=await write(storageToken,items,sha,'Admin '+(index>=0?'update':'add')+' merchant '+newId);
    if(!written.ok)return res.status(409).json(written);
    return res.status(200).json({ok:true,items,item,sha:written.sha});
  }
  return res.status(400).json({ok:false,code:'UNKNOWN_ACTION'});
 }catch(error){
  if(['INVALID_FIELDS','INVALID_URL','INVALID_ITEM','INVALID_SORT_ORDER'].includes(error.message))return res.status(400).json({ok:false,code:error.message});
  console.error('merchant admin operation failed',error.message);
  return res.status(502).json({ok:false,code:'STORAGE_UNAVAILABLE'});
 }
};
