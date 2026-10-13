// Decode the quoted data argument from Google HtmlService; never execute it.
function decodeString(literal){
 let out='';
 for(let i=1;i<literal.length-1;i++){
  let c=literal[i];if(c!=='\\'){out+=c;continue;}
  c=literal[++i];
  if(c==='x'||c==='u'){
   const n=c==='x'?2:4,hex=literal.slice(i+1,i+1+n);
   if(!new RegExp('^[0-9a-fA-F]{'+n+'}$').test(hex))throw new Error('Invalid escape');
   out+=String.fromCharCode(parseInt(hex,16));i+=n;
  }else{
   const escapes={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v','\\':'\\','"':'"',"'":"'",'/':'/'};
   if(!Object.hasOwn(escapes,c))throw new Error('Invalid escape');out+=escapes[c];
  }
 }
 return out;
}
function parseResult(text){
 let data;
 try{data=JSON.parse(text);}catch{
  const wrapped=text.match(/goog\.script\.init\(\s*("(?:\\.|[^"\\])*")/);
  if(wrapped){const envelope=JSON.parse(decodeString(wrapped[1]));text=envelope.userHtml;if(typeof text!=='string')throw new Error('Missing result');}
  const result=text.match(/parent\.postMessage\(\s*(\{[^\r\n]*\})\s*,\s*["']\*["']\s*\)/);
  if(!result)throw new Error('Missing result');data=JSON.parse(result[1]);
 }
 if(!data||typeof data.ok!=='boolean')throw new Error('Invalid result');
 if(data.ok&&!/^LT-[A-Za-z0-9-]{1,100}$/.test(data.id||''))throw new Error('Missing case ID');
 return {ok:data.ok,id:data.ok?data.id:'',message:String(data.message||'').slice(0,500)};
}
module.exports={parseResult};
