(()=>{
const LIFF_ID='2011802000-aDp14e0D';
const AUTH_API='https://lantian-live-map.vercel.app/api/admin-auth';
const SESSION_TOKEN='lantianAdminIdToken';
const status=document.getElementById('authStatus');
const title=document.getElementById('authTitle');
let reverifyBtn=null;

function ensureReverifyButton(){
 if(reverifyBtn)return reverifyBtn;
 reverifyBtn=document.createElement('button');
 reverifyBtn.type='button';
 reverifyBtn.textContent='重新驗證';
 reverifyBtn.style.cssText='display:none;margin-top:12px;border:1px solid #b9cfdd;background:#fff;color:#0f5d9d;border-radius:999px;padding:9px 14px;font:inherit;font-weight:800;cursor:pointer';
 const host=status?.parentElement||document.querySelector('.gate');
 host?.appendChild(reverifyBtn);
 reverifyBtn.addEventListener('click',reverify);
 return reverifyBtn;
}
function showReverify(show){const b=ensureReverifyButton();if(b)b.style.display=show?'inline-block':'none';}
function cacheToken(token){try{if(token)sessionStorage.setItem(SESSION_TOKEN,token);}catch(e){console.warn(e);}}
function cachedToken(){try{return sessionStorage.getItem(SESSION_TOKEN)||'';}catch(e){return '';}}
function clearToken(){try{sessionStorage.removeItem(SESSION_TOKEN);}catch(e){console.warn(e);}}

function setState(ok,message){
 if(status){status.textContent=message;status.classList.toggle('ok',ok);}
 if(title)title.textContent=ok?'管理員驗證成功':'管理權限尚未啟用';
 showReverify(!ok);
}

async function verify(token){
 const r=await fetch(AUTH_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});
 const data=await r.json().catch(()=>({}));
 if(r.ok&&data.ok){
  cacheToken(token);
  setState(true,`已驗證${data.user?.name?`：${data.user.name}`:''}`);
  return true;
 }
 return false;
}

async function currentLiffToken(){
 await liff.init({liffId:LIFF_ID});
 if(!liff.isLoggedIn())return '';
 return liff.getIDToken()||'';
}

async function reverify(){
 clearToken();
 try{
  await liff.init({liffId:LIFF_ID});
  if(liff.isLoggedIn())liff.logout();
  liff.login({redirectUri:window.location.href.split('#')[0]});
 }catch(e){
  console.error(e);
  setState(false,'無法啟動重新驗證，請返回管理中心登入。');
 }
}

async function init(){
 showReverify(false);
 const saved=cachedToken();
 if(saved){
  setState(false,'正在沿用管理中心驗證…');
  try{if(await verify(saved))return;}catch(e){console.warn(e);}
  clearToken();
 }
 try{
  const token=await currentLiffToken();
  if(token&&await verify(token))return;
  setState(false,'管理員驗證已失效，請按「重新驗證」。');
 }catch(e){
  console.error(e);
  setState(false,'管理員驗證已失效，請按「重新驗證」。');
 }
}

if(window.liff)init();else setState(false,'LINE LIFF SDK 載入失敗。');
})();