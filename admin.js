(()=>{
const LIFF_ID='2011802000-aDp14e0D';
const AUTH_API='https://lantian-live-map.vercel.app/api/admin-auth';
const authStatus=document.getElementById('authStatus');
const loginBtn=document.getElementById('loginBtn');
const actions=[...document.querySelectorAll('.module-action')];
const SESSION_TOKEN='lantianAdminIdToken';

function setLocked(message, allowLogin=false){
  if(authStatus) authStatus.textContent=message;
  if(loginBtn){
    loginBtn.disabled=!allowLogin;
    loginBtn.textContent='LINE 管理員登入';
  }
  actions.forEach(el=>{
    if(el.tagName==='BUTTON') el.disabled=true;
    if(el.tagName==='A'){
      el.setAttribute('aria-disabled','true');
      el.setAttribute('tabindex','-1');
      el.classList.add('disabled-link');
    }
  });
}

function setAuthorized(name,idToken){
  try{ if(idToken) sessionStorage.setItem(SESSION_TOKEN,idToken); }catch(e){ console.warn(e); }
  if(authStatus) authStatus.textContent=`管理員驗證成功${name?`：${name}`:''}`;
  if(loginBtn){ loginBtn.disabled=true; loginBtn.textContent='已驗證'; loginBtn.onclick=null; }
  actions.forEach(el=>{
    if(el.tagName==='BUTTON') el.disabled=false;
    if(el.tagName==='A'){
      el.removeAttribute('aria-disabled');
      el.removeAttribute('tabindex');
      el.classList.remove('disabled-link');
    }
  });
}

function enableRelogin(message){
  try{ sessionStorage.removeItem(SESSION_TOKEN); }catch(e){ console.warn(e); }
  setLocked(message,true);
  if(loginBtn){
    loginBtn.textContent='重新登入 LINE';
    loginBtn.onclick=()=>{
      try{ if(window.liff&&liff.isLoggedIn()) liff.logout(); }catch(e){ console.error(e); }
      const redirectUri=window.location.href.split('#')[0];
      liff.login({redirectUri});
    };
  }
}

async function verifyAdmin(idToken){
  const r=await fetch(AUTH_API,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({idToken})
  });
  const data=await r.json().catch(()=>({}));

  if(r.ok && data.ok){
    setAuthorized(data.user?.name||'',idToken);
    return;
  }

  if(data.code==='ADMIN_LIST_NOT_CONFIGURED' && data.bootstrapHash){
    setLocked(`LINE 身分已驗證。首次設定碼：${data.bootstrapHash}`);
    return;
  }

  if(data.code==='NOT_AUTHORIZED'){
    enableRelogin('LINE 身分驗證成功，但此帳號不在管理員白名單。可重新登入其他管理員帳號。');
    return;
  }

  enableRelogin('後端管理員驗證失敗。請重新登入 LINE 後再試。');
}

async function initLiff(){
  setLocked('正在初始化 LINE LIFF…');
  try{
    await liff.init({liffId:LIFF_ID});
    if(!liff.isLoggedIn()){
      setLocked('尚未登入 LINE。請使用管理員 LINE 帳號登入。',true);
      loginBtn.onclick=()=>liff.login({redirectUri:window.location.href.split('#')[0]});
      return;
    }

    const idToken=liff.getIDToken();
    if(!idToken){
      setLocked('已登入 LINE，但未取得 ID token。請重新登入。',true);
      loginBtn.onclick=()=>{liff.logout();location.reload();};
      loginBtn.textContent='重新登入 LINE';
      return;
    }

    setLocked('LINE 登入成功，正在進行後端管理員驗證…');
    await verifyAdmin(idToken);
  }catch(err){
    console.error(err);
    enableRelogin('LIFF 初始化或後端驗證失敗。請重新登入 LINE 後再試。');
  }
}

if(window.liff) initLiff();
else setLocked('LINE LIFF SDK 載入失敗。');
})();
