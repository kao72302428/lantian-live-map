const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const source=fs.readFileSync(path.join(__dirname,'../merchant-app.js'),'utf8');const data=[{id:'a',name:'Alpha',group:'美食餐飲',sub:'小吃',address:'A',sortOrder:20},{id:'b',name:'Beta',group:'美食餐飲',sub:'小吃',address:'B',sortOrder:1},{id:'c',name:'Hidden',group:'美食餐飲',sub:'小吃',address:'C',published:false}];function element(){return {innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll(){return []}}}const list=element(),hint=element(),mapbox=element(),search=element(),subfilters=element();const document={getElementById(id){return ({list,hint,mapbox,search,subfilters})[id]},querySelectorAll(){return []},querySelector(){return {classList:{add(){}}}}};const window={MERCHANTS:data};vm.runInNewContext(source,{window,document,console,encodeURIComponent});test('unpublished merchants are hidden',()=>{assert.doesNotMatch(list.innerHTML,/Hidden/);assert.match(list.innerHTML,/Alpha/)});test('published merchants respect sort order',()=>{assert.ok(list.innerHTML.indexOf('Beta')<list.innerHTML.indexOf('Alpha'))});test('legacy merchant without published field stays visible',()=>{assert.match(list.innerHTML,/Alpha/)});
test('merchant names and addresses render as escaped text, not injected HTML',()=>{const malicious=[{id:'x" onmouseover="alert(1)',name:'<img src=x onerror=alert(1)>',group:'美食餐飲',sub:'小吃',address:'<script>alert(1)</script>'}];const l=element();const doc={getElementById(id){return ({list:l,hint:element(),mapbox:element(),search:element(),subfilters:element()})[id]},querySelectorAll(){return []},querySelector(){return {classList:{add(){}}}}};vm.runInNewContext(source,{window:{MERCHANTS:malicious},document:doc,console,encodeURIComponent});assert.doesNotMatch(l.innerHTML,/<img|<script|data-id="[^"]*"\s+onmouseover=/);assert.match(l.innerHTML,/&quot; onmouseover=&quot;/);assert.match(l.innerHTML,/&lt;img/);assert.match(l.innerHTML,/&lt;script/);assert.match(l.innerHTML,/&quot;/)});

test('search filters by merchant name and address without showing unpublished results',()=>{const l=element(),s=element();let onInput; s.addEventListener=(event,fn)=>{if(event==='input')onInput=fn};const doc={getElementById(id){return ({list:l,hint:element(),mapbox:element(),search:s,subfilters:element()})[id]},querySelectorAll(){return []},querySelector(){return {classList:{add(){}}}}};vm.runInNewContext(source,{window:{MERCHANTS:data},document:doc,console,encodeURIComponent});assert.equal(typeof onInput,'function');s.value='Beta';onInput();assert.match(l.innerHTML,/Beta/);assert.doesNotMatch(l.innerHTML,/Alpha|Hidden/);s.value='A';onInput();assert.match(l.innerHTML,/Alpha/);assert.doesNotMatch(l.innerHTML,/Hidden/);});

test('category switching limits visible merchants and resets search',()=>{
 const sample=[{id:'food',name:'Food Shop',group:'美食餐飲',sub:'小吃',address:'A'},{id:'shop',name:'Retail Shop',group:'購物零售',sub:'超市',address:'B'}];
 const l=element(),s=element(),subs=element(),food=element(),all=element(),retail=element();
 const buttons=[all,food,retail];all.dataset={g:'全部'};food.dataset={g:'美食餐飲'};retail.dataset={g:'購物零售'};
 for(const b of buttons)b.addEventListener=(type,fn)=>{if(type==='click')b.click=fn};
 subs.querySelectorAll=()=>[];
 const doc={getElementById(id){return ({list:l,hint:element(),mapbox:element(),search:s,subfilters:subs})[id]},querySelectorAll(sel){return sel==='button[data-g]'?buttons:[]},querySelector(){return {classList:{add(){}}}}};
 vm.runInNewContext(source,{window:{MERCHANTS:sample},document:doc,console,encodeURIComponent});
 assert.match(l.innerHTML,/Food Shop/);assert.match(l.innerHTML,/Retail Shop/);
 s.value='no matching search';food.click();
 assert.equal(s.value,'');assert.match(l.innerHTML,/Food Shop/);assert.doesNotMatch(l.innerHTML,/Retail Shop/);
 retail.click();assert.match(l.innerHTML,/Retail Shop/);assert.doesNotMatch(l.innerHTML,/Food Shop/);
 all.click();assert.match(l.innerHTML,/Food Shop/);assert.match(l.innerHTML,/Retail Shop/);
});
test('initial merchant map embeds a Google Maps search for the local district',()=>{
 assert.match(mapbox.innerHTML,/https:\/\/www\.google\.com\/maps\?q=/);
 assert.match(mapbox.innerHTML,/output=embed/);
});
