const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const source=fs.readFileSync(path.join(__dirname,'../merchant-app.js'),'utf8');const data=[{id:'a',name:'Alpha',group:'美食餐飲',sub:'小吃',address:'A',sortOrder:20},{id:'b',name:'Beta',group:'美食餐飲',sub:'小吃',address:'B',sortOrder:1},{id:'c',name:'Hidden',group:'美食餐飲',sub:'小吃',address:'C',published:false}];function element(){return {innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll(){return []}}}const list=element(),hint=element(),mapbox=element(),search=element(),subfilters=element();const document={getElementById(id){return ({list,hint,mapbox,search,subfilters})[id]},querySelectorAll(){return []},querySelector(){return {classList:{add(){}}}}};const window={MERCHANTS:data};vm.runInNewContext(source,{window,document,console,encodeURIComponent});test('unpublished merchants are hidden',()=>{assert.doesNotMatch(list.innerHTML,/Hidden/);assert.match(list.innerHTML,/Alpha/)});test('published merchants respect sort order',()=>{assert.ok(list.innerHTML.indexOf('Beta')<list.innerHTML.indexOf('Alpha'))});test('legacy merchant without published field stays visible',()=>{assert.match(list.innerHTML,/Alpha/)});
test('merchant names and addresses render as escaped text, not injected HTML',()=>{const malicious=[{id:'x" onmouseover="alert(1)',name:'<img src=x onerror=alert(1)>',group:'美食餐飲',sub:'小吃',address:'<script>alert(1)</script>'}];const l=element();const doc={getElementById(id){return ({list:l,hint:element(),mapbox:element(),search:element(),subfilters:element()})[id]},querySelectorAll(){return []},querySelector(){return {classList:{add(){}}}}};vm.runInNewContext(source,{window:{MERCHANTS:malicious},document:doc,console,encodeURIComponent});assert.doesNotMatch(l.innerHTML,/<img|<script|data-id="[^"]*"\s+onmouseover=/);assert.match(l.innerHTML,/&quot; onmouseover=&quot;/);assert.match(l.innerHTML,/&lt;img/);assert.match(l.innerHTML,/&lt;script/);assert.match(l.innerHTML,/&quot;/)});

test('search filters by merchant name and address without showing unpublished results',()=>{const l=element(),s=element();let onInput; s.addEventListener=(event,fn)=>{if(event==='input')onInput=fn};const doc={getElementById(id){return ({list:l,hint:element(),mapbox:element(),search:s,subfilters:element()})[id]},querySelectorAll(){return []},querySelector(){return {classList:{add(){}}}}};vm.runInNewContext(source,{window:{MERCHANTS:data},document:doc,console,encodeURIComponent});assert.equal(typeof onInput,'function');s.value='Beta';onInput();assert.match(l.innerHTML,/Beta/);assert.doesNotMatch(l.innerHTML,/Alpha|Hidden/);s.value='A';onInput();assert.match(l.innerHTML,/Alpha/);assert.doesNotMatch(l.innerHTML,/Hidden/);});

test('six main categories replace all and reset search when switching',()=>{
 const groups=['美食餐飲','購物零售','居家服務','醫療保健','生活服務','教育休閒'];
 const html=fs.readFileSync(path.join(__dirname,'../merchant.html'),'utf8');
 const admin=fs.readFileSync(path.join(__dirname,'../admin-merchant.html'),'utf8');
 const labels=[...html.matchAll(/data-g="([^"]+)">[^<]*?<\/button>/g)].map(x=>x[1]);
 const adminGroups=[...admin.matchAll(/<option>([^<]+)<\/option>/g)].map(x=>x[1]);
 assert.deepEqual(labels,adminGroups);assert.deepEqual(labels,groups);
 for(const group of groups)assert.ok(html.includes(' '+group+'</button>'));
 assert.doesNotMatch(html,/data-g="全部"|id="subfilters"/);
 assert.doesNotMatch(source,/data-sub=|function renderSubs/);
 const sample=groups.map((group,i)=>({id:'cat-'+i,name:'CategoryShop'+i,group,sub:'',address:'A'}));
 const l=element(),s=element(),subs=element();
 const buttons=groups.map(g=>{const b=element();b.dataset={g};b.addEventListener=(type,fn)=>{if(type==='click')b.click=fn};return b});
 const doc={getElementById(id){return ({list:l,hint:element(),mapbox:element(),search:s,subfilters:subs})[id]},querySelectorAll(sel){return sel==='button[data-g]'?buttons:[]},querySelector(){return buttons[0]}};
 vm.runInNewContext(source,{window:{MERCHANTS:sample},document:doc,console,encodeURIComponent});
 assert.match(l.innerHTML,/CategoryShop0/);assert.doesNotMatch(l.innerHTML,/CategoryShop[1-5]/);
 for(let i=0;i<buttons.length;i++){
  s.value='no matching search';buttons[i].click();assert.equal(s.value,'');
  assert.match(l.innerHTML,new RegExp('CategoryShop'+i));
  for(let j=0;j<buttons.length;j++)if(j!==i)assert.doesNotMatch(l.innerHTML,new RegExp('CategoryShop'+j));
 }
});
test('initial merchant map embeds a Google Maps search for the local district',()=>{
 assert.match(mapbox.innerHTML,/https:\/\/www\.google\.com\/maps\?q=/);
 assert.match(mapbox.innerHTML,/output=embed/);
});

test('phase 2 admin website and social links are visible with safe link attributes',()=>{
 const l=element(),doc={getElementById(id){return ({list:l,hint:element(),mapbox:element(),search:element(),subfilters:element()})[id]},querySelectorAll(){return []},querySelector(){return {classList:{add(){}}}}};
 const rows=[{id:'phase2',name:'Phase2 Shop',address:'UAT',group:'美食餐飲',sub:'正餐小吃',website:'https://example.com/shop?x=1&y=2',social:'https://example.com/social',description:'UAT',published:true},{id:'draft',name:'Draft',address:'UAT',group:'美食餐飲',published:false,website:'https://example.com/draft'}];
 vm.runInNewContext(source,{window:{MERCHANTS:rows},document:doc,encodeURIComponent});
 assert.match(l.innerHTML,/官方網站/);
 assert.match(l.innerHTML,/社群連結/);
 assert.match(l.innerHTML,/x=1&amp;y=2/);
 assert.match(l.innerHTML,/rel="noopener noreferrer"/);
 assert.doesNotMatch(l.innerHTML,/Draft|example.com\/draft/);
});

test('phase2 Preview fetches latest isolated branch data without changing static production behavior',async()=>{
 const make=()=>({innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll(){return []}});
 const nodes={list:make(),hint:make(),mapbox:make(),search:make(),subfilters:make()};
 const doc={getElementById:id=>nodes[id],querySelectorAll:()=>[],querySelector:()=>({classList:{add(){}}})};
 const latest=[...data,{id:'preview-new',name:'Fresh Preview Merchant',group:'美食餐飲',sub:'正餐小吃',address:'UAT',published:true,sortOrder:0}];
 const baseline=Array.from({length:157},(_,i)=>({id:'base-'+i,name:'Original '+i,group:'美食餐飲',sub:'正餐小吃',address:'UAT'}));
 const incoming=[...baseline,{id:'preview-new',name:'Fresh Preview Merchant',group:'美食餐飲',sub:'正餐小吃',address:'UAT',published:true,sortOrder:0}];
 let requested='';
 const context={window:{MERCHANTS:baseline},document:doc,encodeURIComponent,location:{hostname:'preview-branch.vercel.app'},fetch:async url=>{requested=url;return {ok:true,text:async()=> 'window.MERCHANTS = '+JSON.stringify(incoming)+';'};}};
 vm.runInNewContext(source,context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(requested,/feature\/merchant-admin-phase2-access-20261010\/merchants.js/);
 assert.match(nodes.list.innerHTML,/Fresh Preview Merchant/);
 assert.ok(nodes.list.innerHTML.indexOf('Fresh Preview Merchant')<nodes.list.innerHTML.indexOf('Original 0'));
 assert.equal(context.window.MERCHANTS.length,158);
});
test('production hostname refreshes main and never fetches Preview merchant records',()=>{
 const make=()=>({innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll(){return []}});
 const nodes={list:make(),hint:make(),mapbox:make(),search:make(),subfilters:make()};
 const doc={getElementById:id=>nodes[id],querySelectorAll:()=>[],querySelector:()=>({classList:{add(){}}})};
 let calls=0;
 vm.runInNewContext(source,{window:{MERCHANTS:data},document:doc,encodeURIComponent,location:{hostname:'lantian-live-map.vercel.app'},fetch:url=>{calls++;assert.match(url,/\/main\/merchants.js$/);return Promise.resolve({ok:false});}});
 assert.equal(calls,1);assert.match(nodes.list.innerHTML,/Alpha/);
});

test('phase2 website clicks do not also select merchant map, while card clicks still work',()=>{
 const make=()=>({innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll(){return []}});
 const nodes={list:make(),hint:make(),mapbox:make(),search:make(),subfilters:make()};
 const handlers={};nodes.list.addEventListener=(event,fn)=>{handlers[event]=fn};
 const doc={getElementById:id=>nodes[id],querySelectorAll:()=>[],querySelector:()=>({classList:{add(){}}})};
 vm.runInNewContext(source,{window:{MERCHANTS:data,matchMedia:()=>({matches:false})},document:doc,encodeURIComponent});
 let prevented=0;const card={dataset:{id:'a'}};
 handlers.click({target:{closest:selector=>selector==='a[href]'?{}:card},preventDefault:()=>prevented++});
 assert.equal(prevented,0);
 handlers.click({target:{closest:selector=>selector==='a[href]'?null:card},preventDefault:()=>prevented++});
 assert.equal(prevented,1);
});
