const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const handler=require('../api/news-admin');
const baseline=[{id:'existing',date:'2026-10-01',title:'Existing',summary:'Summary',content:'Content',published:true}];
function setup({authorized=true,conflict=false}={}){
 let data=structuredClone(baseline),sha='v1',writes=0,imageWrites=0,videoWrites=0,lastImagePath='',lastVideoPath='';
 process.env.ADMIN_LINE_USER_HASHES=authorized?crypto.createHash('sha256').update('fixture-admin').digest('hex'):'0'.repeat(64);
 process.env.GITHUB_CONTENT_TOKEN='fixture-token';
 const response=(status,body)=>({ok:status<400,status,json:async()=>body});
 global.fetch=async(url,options={})=>{
  if(url.includes('api.line.me'))return response(200,{sub:'fixture-admin'});
  if(options.method==='PUT'&&url.includes('/contents/assets/news-images/')){
   const body=JSON.parse(options.body);assert.equal(body.branch,'main');assert.ok(body.content);
   imageWrites++;lastImagePath=url;return response(200,{content:{sha:'image-sha'}});
  }
  if(options.method==='PUT'&&url.includes('/contents/assets/news-videos/')){
   const body=JSON.parse(options.body);assert.equal(body.branch,'main');assert.ok(body.content);
   videoWrites++;lastVideoPath=url;return response(200,{content:{sha:'video-sha'}});
  }
  if(options.method==='PUT'){
   const body=JSON.parse(options.body);assert.equal(body.branch,'main');assert.equal(body.sha,sha);
   if(conflict)return response(409,{});
   data=JSON.parse(Buffer.from(body.content,'base64').toString());sha='v'+(++writes+1);
   return response(200,{content:{sha}});
  }
  assert.match(url,/news.json\?ref=main$/);
  return response(200,{sha,content:Buffer.from(JSON.stringify(data)).toString('base64')});
 };
 return {get data(){return data},get sha(){return sha},get writes(){return writes},get imageWrites(){return imageWrites},get videoWrites(){return videoWrites},get lastImagePath(){return lastImagePath},get lastVideoPath(){return lastVideoPath}};
}
async function invoke(action,extra={}){
 const res={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this},end(){return this}};
 await handler({method:'POST',headers:{},body:{idToken:'fixture-id-token',action,...extra}},res);return res;
}
test('news lifecycle persists draft, edits, publishes, unpublishes and deletes only the selected message',async()=>{
 const s=setup();let r=await invoke('list');assert.equal(r.body.sha,'v1');
 r=await invoke('upsert',{expectedSha:s.sha,item:{date:'2026-10-12',title:'New',summary:'S',content:'C',published:false}});
 assert.equal(r.code,200);const id=r.body.item.id;assert.equal(r.body.item.published,false);assert.equal(r.body.sha,s.sha);
 r=await invoke('upsert',{expectedSha:s.sha,item:{...r.body.item,title:'Edited'}});assert.equal(r.code,200);
 r=await invoke('setPublished',{expectedSha:s.sha,id,published:true});assert.equal(r.body.item.published,true);
 r=await invoke('setPublished',{expectedSha:s.sha,id,published:false});assert.equal(r.body.item.published,false);
 r=await invoke('list');assert.equal(r.body.items.find(x=>x.id===id).title,'Edited');
 r=await invoke('delete',{expectedSha:s.sha,id});assert.equal(r.code,200);assert.deepEqual(s.data,baseline);
});
test('news image upload accepts JPG PNG or WebP and rejects invalid files',async()=>{
 const s=setup();
 const valid=Buffer.from('fixture-image').toString('base64');
 let r=await invoke('uploadImage',{image:{base64:valid,name:'photo.png',mime:'image/png'}});
 assert.equal(r.code,200);assert.equal(s.imageWrites,1);assert.match(r.body.path,/^\.\/assets\/news-images\/news-\d+-[a-f0-9]{8}\.png$/);
 assert.match(s.lastImagePath,/\/contents\/assets\/news-images\/news-/);
 r=await invoke('uploadImage',{image:{base64:valid,name:'photo.gif',mime:'image/gif'}});
 assert.equal(r.code,400);assert.equal(r.body.code,'INVALID_IMAGE_TYPE');assert.equal(s.imageWrites,1);
 r=await invoke('uploadImage',{image:{base64:'%%%bad%%%',name:'photo.png',mime:'image/png'}});
 assert.equal(r.code,400);assert.equal(r.body.code,'INVALID_IMAGE_DATA');assert.equal(s.imageWrites,1);
});
test('news video upload accepts MP4 or WebM and rejects invalid files',async()=>{
 const s=setup();
 const valid=Buffer.from('fixture-video').toString('base64');
 let r=await invoke('uploadVideo',{video:{base64:valid,name:'clip.mp4',mime:'video/mp4'}});
 assert.equal(r.code,200);assert.equal(s.videoWrites,1);assert.match(r.body.path,/^\.\/assets\/news-videos\/news-\d+-[a-f0-9]{8}\.mp4$/);
 assert.match(s.lastVideoPath,/\/contents\/assets\/news-videos\/news-/);
 r=await invoke('uploadVideo',{video:{base64:valid,name:'clip.mov',mime:'video/quicktime'}});
 assert.equal(r.code,400);assert.equal(r.body.code,'INVALID_VIDEO_TYPE');assert.equal(s.videoWrites,1);
 r=await invoke('uploadVideo',{video:{base64:'%%%bad%%%',name:'clip.mp4',mime:'video/mp4'}});
 assert.equal(r.code,400);assert.equal(r.body.code,'INVALID_VIDEO_DATA');assert.equal(s.videoWrites,1);
});
test('stale editor cannot overwrite, unpublish or delete newer data',async()=>{
 const s=setup();await invoke('setPublished',{expectedSha:s.sha,id:'existing',published:false});
 for(const [action,extra]of [['upsert',{item:baseline[0]}],['setPublished',{id:'existing',published:true}],['delete',{id:'existing'}]]){
  const r=await invoke(action,{expectedSha:'v1',...extra});assert.equal(r.code,409);assert.equal(r.body.code,'STALE_DATA');
 }
 assert.equal(s.writes,1);assert.equal(s.data[0].published,false);
});
test('all writes require an editor version',async()=>{
 const s=setup();for(const action of ['upsert','setPublished','delete'])assert.equal((await invoke(action)).body.code,'MISSING_EXPECTED_SHA');assert.equal(s.writes,0);
});
test('GitHub conflict is returned as conflict without changing stored news',async()=>{
 const s=setup({conflict:true});const r=await invoke('delete',{expectedSha:s.sha,id:'existing'});assert.equal(r.code,409);assert.equal(s.writes,0);assert.deepEqual(s.data,baseline);
});
test('non-admin cannot read or write news',async()=>{
 const s=setup({authorized:false});for(const action of ['list','upsert','setPublished','delete'])assert.equal((await invoke(action)).code,403);assert.equal(s.writes,0);
});
test('news editor sends loaded version and blocks overlapping save or delete while preserving a failed draft',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),nodes={},events={};
 function element(id){return nodes[id]??={style:{},value:'',checked:false,hidden:false,disabled:false,textContent:'',innerHTML:'',parentElement:{appendChild(){}},reset(){},addEventListener(type,fn){events[id+':'+type]=fn}};}
 const listButton={disabled:false};let writes=0,rejectSave;
 const context={document:{getElementById:element,querySelectorAll:()=>[listButton],createElement:()=>element('reverify'),querySelector:()=>element('gate')},sessionStorage:{getItem:()=> 'fixture',setItem(){},removeItem(){}},window:{liff:{},scrollTo(){}},console,confirm:()=>true,alert(){},fetch:async(url,options)=>{
  const body=JSON.parse(options.body);
  if(body.action==='list')return {ok:true,json:async()=>({ok:true,items:baseline,sha:'loaded-version'})};
  assert.equal(body.expectedSha,'loaded-version');writes++;return new Promise((resolve,reject)=>rejectSave=reject);
 }};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../admin-news.js'),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 for(const id of ['date','title','summary','content'])element(id).value='Draft';
 events['newsForm:submit']({preventDefault(){}});
 assert.equal(writes,1);assert.equal(listButton.disabled,true);
 events['newsForm:submit']({preventDefault(){}});
 await events['list:click']({target:{closest:()=>({dataset:{action:'delete'},closest:()=>({dataset:{id:'existing'}})})}});
 assert.equal(writes,1);
 rejectSave(Object.assign(Error('conflict'),{code:'STALE_DATA'}));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(element('title').value,'Draft');assert.equal(listButton.disabled,false);
 assert.match(element('formMessage').textContent,/本次未儲存/);
});
