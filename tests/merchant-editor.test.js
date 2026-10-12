const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../admin-merchant.js'),'utf8');
test('pending merchant save blocks duplicate writes and editing; rejection unlocks controls',async()=>{
 const nodes={},handlers={};
 const get=id=>nodes[id]??=( {value:'',textContent:'',innerHTML:'',disabled:false,addEventListener(type,fn){(handlers[id+':'+type]??=[]).push(fn);}} );
 const rowButton={disabled:false},rowInput={disabled:false};
 let writes=0,rejectSave;
 const context={location:{hostname:'preview.vercel.app',origin:'https://preview.vercel.app'},document:{getElementById:get,querySelectorAll:()=>[rowButton,rowInput]},sessionStorage:{getItem:()=> 'mock-token',setItem(){}},window:{scrollTo(){}},confirm:()=>true,fetch:async(url,options)=>{
  const body=JSON.parse(options.body);
  if(body.action==='list')return {ok:true,json:async()=>({ok:true,items:[{id:'one',name:'Shop',address:'A'}],sha:'v1'})};
  writes++;
  return new Promise((resolve,reject)=>{rejectSave=reject;});
 }};
 vm.runInNewContext(source,context);
 await new Promise(resolve=>setImmediate(resolve));
 get('name').value='Draft';get('address').value='A';get('group').value='美食餐飲';
 const submit=handlers['merchantForm:submit'][0];
 const pending=submit({preventDefault(){}});
 assert.equal(writes,1);assert.equal(get('saveBtn').disabled,true);assert.equal(rowButton.disabled,true);assert.equal(rowInput.disabled,true);
 await submit({preventDefault(){}});
 for(const fn of handlers['list:click'])await fn({target:{closest:()=>({dataset:{publish:'one',id:'one'}})}});
 handlers['newBtn:click'][0]();
 assert.equal(writes,1);assert.equal(get('name').value,'Draft');
 rejectSave(Error('NETWORK_FAILED'));await pending;
 assert.equal(get('saveBtn').disabled,false);assert.equal(rowButton.disabled,false);assert.equal(rowInput.disabled,false);
 assert.equal(get('name').value,'Draft');assert.match(get('message').textContent,/NETWORK_FAILED/);
});

test('merchant delete supports cancellation, prevents overlapping writes and clears deleted editor only after success',async()=>{
 const nodes={},handlers={};const get=id=>nodes[id]??={value:'',textContent:'',innerHTML:'',disabled:false,addEventListener(type,fn){(handlers[id+':'+type]??=[]).push(fn)}};
 let accepted=false,writes=0,finish,lastPayload;const row={disabled:false};
 const context={location:{hostname:'kao72302428.github.io',origin:'https://kao72302428.github.io'},document:{getElementById:get,querySelectorAll:()=>[row]},sessionStorage:{getItem:()=> 'mock',setItem(){}},window:{scrollTo(){}},confirm:()=>accepted,fetch:async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='list')return {ok:true,json:async()=>({ok:true,items:[{id:'one',name:'Shop',address:'A'}],sha:'v1'})};writes++;lastPayload=body;return new Promise(resolve=>{finish=resolve})}};
 vm.runInNewContext(source,context);await new Promise(resolve=>setImmediate(resolve));
 assert.match(get('list').innerHTML,/data-delete="one"/);
 const click=handlers['list:click'].at(-1),event={target:{closest:()=>({dataset:{delete:'one'}})}};
 await click(event);assert.equal(writes,0);accepted=true;get('id').value='one';get('name').value='Draft';
 const pending=click(event);await click(event);handlers['newBtn:click'][0]();assert.equal(writes,1);assert.equal(row.disabled,true);assert.equal(get('name').value,'Draft');assert.equal(lastPayload.action,'delete');assert.equal(lastPayload.expectedSha,'v1');
 finish({ok:false,json:async()=>({ok:false,code:'STALE_DATA'})});await pending;assert.equal(get('id').value,'one');assert.equal(get('name').value,'Draft');assert.match(get('list').innerHTML,/Shop/);assert.equal(row.disabled,false);
 const retry=click(event);finish({ok:true,json:async()=>({ok:true,items:[],sha:'v2'})});await retry;assert.equal(get('id').value,'');assert.equal(get('name').value,'');assert.doesNotMatch(get('list').innerHTML,/Shop/);assert.match(get('message').textContent,/已刪除/);
});
