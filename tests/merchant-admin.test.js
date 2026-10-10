const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const vm=require('node:vm');
const handler=require('../api/merchant-admin');
const source=fs.readFileSync(require('node:path').join(__dirname,'../merchants.js'),'utf8');
const sandbox={window:{}};vm.runInNewContext(source,sandbox);
const initial=JSON.parse(JSON.stringify(sandbox.window.MERCHANTS));
const LINE_SUB='offline-test-admin';
const ADMIN_HASH=crypto.createHash('sha256').update(LINE_SUB).digest('hex');
function response(status,body){return {ok:status>=200&&status<300,status,json:async()=>body};}
function setup({allow=true,stale=false}={}){
 let data=JSON.parse(JSON.stringify(initial)),sha='test-sha',writes=0;
 process.env.GITHUB_CONTENT_TOKEN='offline-test-token';
 process.env.VERCEL_ENV='preview';
 process.env.MERCHANT_UAT_WRITES_ENABLED='true';
 process.env.ADMIN_LINE_USER_HASHES=allow?ADMIN_HASH:'0'.repeat(64);
 global.fetch=async(url,options={})=>{
  if(url.includes('api.line.me'))return response(200,{sub:LINE_SUB,name:'Offline Admin'});
  if(url.includes('/contents/merchants.js')){
   if(options.method==='PUT'){
    const body=JSON.parse(options.body);
    assert.equal(body.branch,'feature/merchant-admin-phase2-access-20261010');
    assert.equal(body.sha,sha);
    if(stale)return response(409,{message:'conflict'});
    const raw=Buffer.from(body.content,'base64').toString('utf8');
    const match=/^window\.MERCHANTS = (\[[\s\S]*\]);\n$/.exec(raw);
    assert.ok(match,'must serialize a merchant array');
    data=JSON.parse(match[1]);sha='new-sha';writes++;
    return response(200,{content:{sha}});
   }
   const ref=new URL(url).searchParams.get('ref');
   assert.equal(ref,'feature/merchant-admin-phase2-access-20261010');
   return response(200,{sha,content:Buffer.from('window.MERCHANTS = '+JSON.stringify(data)+';\n').toString('base64')});
  }
  throw Error('Unexpected URL: '+url);
 };
 return {get data(){return data},get writes(){return writes}};
}
async function invoke(action,extra={},token='offline-token'){
 const req={method:'POST',headers:{origin:'https://kao72302428.github.io'},body:{idToken:token,action,...extra}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.code=n;return this},json(obj){this.body=obj;return this},end(){return this}};
 await handler(req,res);return res;
}
test('all 157 original merchant IDs preserved in fixture',()=>{assert.equal(initial.length,157);assert.equal(new Set(initial.map(x=>x.id)).size,157)});
test('non-admin cannot list or modify',async()=>{const s=setup({allow:false});for(const action of ['list','upsert','setPublished','setSortOrder']){const r=await invoke(action,{id:initial[0].id,published:false,sortOrder:3,item:initial[0]});assert.equal(r.code,403)}assert.equal(s.writes,0)});
test('missing token rejected',async()=>{const s=setup();const r=await invoke('list',{},'');assert.equal(r.code,400);assert.equal(s.writes,0)});
test('admin can read without writes',async()=>{const s=setup();const r=await invoke('list');assert.equal(r.code,200);assert.equal(r.body.items.length,157);assert.equal(s.writes,0)});
test('publish toggle persists without losing original records',async()=>{const s=setup();const id=initial[0].id;const r=await invoke('setPublished',{id,published:false});assert.equal(r.code,200);assert.equal(s.data.length,157);assert.equal(s.data.find(x=>x.id===id).published,false);assert.equal(s.writes,1)});
test('sort order persists',async()=>{const s=setup();const r=await invoke('setSortOrder',{id:initial[0].id,sortOrder:4});assert.equal(r.code,200);assert.equal(s.data[0].sortOrder,4)});
test('invalid sort order rejected',async()=>{const s=setup();const r=await invoke('setSortOrder',{id:initial[0].id,sortOrder:-1});assert.equal(r.code,400);assert.equal(s.writes,0)});
test('editing existing merchant preserves all other entries',async()=>{const s=setup();const changed={...initial[0],name:'Offline UAT merchant'};const r=await invoke('upsert',{item:changed});assert.equal(r.code,200);assert.equal(s.data.length,157);assert.deepEqual(s.data.slice(1),initial.slice(1))});
test('unknown ID cannot overwrite or create record',async()=>{const s=setup();const r=await invoke('upsert',{item:{...initial[0],id:'unknown'}});assert.equal(r.code,404);assert.equal(s.writes,0)});
test('GitHub SHA conflict returns 409 and does not overwrite',async()=>{const s=setup({stale:true});const r=await invoke('setPublished',{id:initial[0].id,published:false});assert.equal(r.code,409);assert.equal(s.writes,0)});

test('production deployment rejects writes even with admin token',async()=>{const s=setup();process.env.VERCEL_ENV='production';const r=await invoke('setPublished',{id:initial[0].id,published:false});assert.equal(r.code,403);assert.equal(r.body.code,'UAT_WRITE_DISABLED');assert.equal(s.writes,0)});
test('preview deployment requires explicit write enablement',async()=>{const s=setup();delete process.env.MERCHANT_UAT_WRITES_ENABLED;const r=await invoke('setSortOrder',{id:initial[0].id,sortOrder:2});assert.equal(r.code,403);assert.equal(s.writes,0)});
test('new merchant starts unpublished',async()=>{const s=setup();const r=await invoke('upsert',{item:{name:'Offline new shop',address:'UAT street',group:'美食餐飲'}});assert.equal(r.code,200);assert.equal(r.body.item.published,false);assert.equal(s.data.length,158)});

test('upsert cannot publish a new merchant or change existing publication state',async()=>{const s=setup();const id=initial[0].id;let r=await invoke('upsert',{item:{...initial[0],published:false}});assert.equal(r.code,200);assert.notEqual(s.data.find(x=>x.id===id).published,false);r=await invoke('setPublished',{id,published:false});assert.equal(r.code,200);r=await invoke('upsert',{item:{...s.data.find(x=>x.id===id),published:true,name:'Edited while unpublished'}});assert.equal(r.code,200);assert.equal(s.data.find(x=>x.id===id).published,false);r=await invoke('upsert',{item:{name:'New unpublished merchant',address:'Test street',group:'美食餐飲',published:true}});assert.equal(r.code,200);assert.equal(r.body.item.published,false);assert.equal(s.data.length,158)});

test('invalid external merchant links are rejected without modifying records',async()=>{const s=setup();const r=await invoke('upsert',{item:{...initial[0],website:'javascript:alert(1)'}});assert.equal(r.code,400);assert.equal(r.body.code,'INVALID_URL');assert.equal(s.writes,0);assert.deepEqual(s.data,initial)});
test('invalid category and non-integer sorting are rejected without writes',async()=>{const s=setup();let r=await invoke('upsert',{item:{...initial[0],group:'不合法分類'}});assert.equal(r.code,400);assert.equal(r.body.code,'INVALID_FIELDS');r=await invoke('setSortOrder',{id:initial[0].id,sortOrder:1.5});assert.equal(r.code,400);assert.equal(r.body.code,'INVALID_SORT_ORDER');assert.equal(s.writes,0);assert.deepEqual(s.data,initial)});

test('production gate blocks every merchant write operation',async()=>{
 const s=setup();process.env.VERCEL_ENV='production';
 const attempts=[
  ['upsert',{item:{...initial[0],name:'Should not change'}}],
  ['setPublished',{id:initial[0].id,published:false}],
  ['setSortOrder',{id:initial[0].id,sortOrder:2}]
 ];
 for(const [action,extra] of attempts){const r=await invoke(action,extra);assert.equal(r.code,403,action);assert.equal(r.body.code,'UAT_WRITE_DISABLED',action);}
 assert.equal(s.writes,0);assert.deepEqual(s.data,initial);
});
test('preview without write flag blocks every merchant write operation',async()=>{
 const s=setup();delete process.env.MERCHANT_UAT_WRITES_ENABLED;
 const attempts=[
  ['upsert',{item:{...initial[0],name:'Should not change'}}],
  ['setPublished',{id:initial[0].id,published:false}],
  ['setSortOrder',{id:initial[0].id,sortOrder:2}]
 ];
 for(const [action,extra] of attempts){const r=await invoke(action,extra);assert.equal(r.code,403,action);assert.equal(r.body.code,'UAT_WRITE_DISABLED',action);}
 assert.equal(s.writes,0);assert.deepEqual(s.data,initial);
});

test('publishing and sorting never alter unrelated merchant records',async()=>{
 const s=setup(),id=initial[0].id;
 let r=await invoke('setPublished',{id,published:false});assert.equal(r.code,200);
 r=await invoke('setSortOrder',{id,sortOrder:42});assert.equal(r.code,200);
 assert.equal(s.data.length,157);assert.equal(s.data[0].published,false);assert.equal(s.data[0].sortOrder,42);
 assert.deepEqual(s.data.slice(1),initial.slice(1));
 assert.equal(s.writes,2);
});
test('unsupported merchant action and unknown IDs never write',async()=>{
 const s=setup();
 for(const [action,extra,expected] of [
  ['delete',{id:initial[0].id},400],
  ['setPublished',{id:'missing-merchant',published:false},404],
  ['setSortOrder',{id:'missing-merchant',sortOrder:1},404]
 ]){const r=await invoke(action,extra);assert.equal(r.code,expected,action);}
 assert.equal(s.writes,0);assert.deepEqual(s.data,initial);
});

test('two newly created merchants receive distinct IDs and retain original data',async()=>{
 const s=setup();
 const first=await invoke('upsert',{item:{name:'UAT shop one',address:'Test road 1',group:'美食餐飲'}});
 const second=await invoke('upsert',{item:{name:'UAT shop two',address:'Test road 2',group:'購物零售'}});
 assert.equal(first.code,200);assert.equal(second.code,200);
 assert.notEqual(first.body.item.id,second.body.item.id);
 assert.match(first.body.item.id,/^NEW[0-9a-f]{32}$/);
 assert.match(second.body.item.id,/^NEW[0-9a-f]{32}$/);
 assert.equal(first.body.item.published,false);assert.equal(second.body.item.published,false);
 assert.equal(s.data.length,159);assert.equal(new Set(s.data.map(x=>x.id)).size,159);
 assert.deepEqual(s.data.slice(0,157),initial);assert.equal(s.writes,2);
});
