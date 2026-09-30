(()=>{
const LIFF_ID='2011802000-aDp14e0D';
const AUTH_API='https://lantian-live-map.vercel.app/api/admin-auth';
const status=document.getElementById('authStatus');
const title=document.getElementById('authTitle');

function setState(ok,message){
 if(status){status.textContent=message;status.classList.toggle('ok',ok);}
 if(title) title.textContent=ok?'管理員驗證成功':'管理員驗證中';
}

async function verify(idToken){
 const r=await fetch(AUTH_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})});
 const data=await r.json().catch(()=>({}));
 if(r.ok&&data.ok){setState(true,`已驗證${data.user?.name?`：${data.user.name}`:''}`);return;}
 setState(false,'管理員驗證失敗，頁面維持唯讀。');
}

async function init(){
 try{
  await liff.init({liffId:LIFF_ID});
  if(!liff.isLoggedIn()){setState(false,'尚未登入 LINE，請由管理中心進入。');return;}
  const idToken=liff.getIDToken()||'';
  if(!idToken){setState(false,'未取得 LINE ID token。');return;}
  await verify(idToken);
 }catch(e){console.error(e);setState(false,'LIFF 或後端驗證失敗。');}
}

if(window.liff)init();else setState(false,'LINE LIFF SDK 載入失敗。');
})();
