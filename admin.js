(()=>{
const LIFF_ID='2011802000-aDp14e0D';
const AUTH_API='https://lantian-live-map.vercel.app/api/admin-auth';
const authStatus=document.getElementById('authStatus');
const loginBtn=document.getElementById('loginBtn');
const logoutBtn=document.getElementById('logoutBtn');
const LOGOUT_MARKER='lantianAdminExplicitLogout';
if(logoutBtn)logoutBtn.addEventListener('click',()=>{
  try{sessionStorage.removeItem('lantianAdminIdToken');}catch(e){console.warn(e);}
  try{localStorage.setItem(LOGOUT_MARKER,'1');}catch(e){console.warn(e);}
  try{if(window.liff&&liff.isLoggedIn())liff.logout();}catch(e){console.error(e);}
  window.location.replace(new URL('./contact.html',window.location.href).href);
});
const actions=[...document.querySelectorAll('.module-action')];
const SESSION_TOKEN='lantianAdminIdToken';

function setLocked(message, allowLogin=false){
  if(authStatus) authStatus.textContent=message;
  if(logoutBtn)logoutBtn.hidden=true;
  if(loginBtn){
    loginBtn.hidden=false;
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
  if(logoutBtn)logoutBtn.hidden=false;
  if(loginBtn){ loginBtn.disabled=true; loginBtn.hidden=true; loginBtn.onclick=null; }
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
  setLocked('正在驗證管理員身分…');
  // Reuse only a token already verified by the server; a cached token alone grants no access.
  let savedToken='';
  try{savedToken=sessionStorage.getItem(SESSION_TOKEN)||'';}catch(e){console.warn(e);}
  const paramsBeforeInit=new URLSearchParams(location.search);
  const forceReauth=paramsBeforeInit.get('reauth')==='1';
  let explicitLogout=false;
  try{explicitLogout=localStorage.getItem(LOGOUT_MARKER)==='1';}catch(e){console.warn(e);}
  // LINE primary redirect must be initialized before using a cached session.
  // Do not inspect or log the confidential token values in the URL fragment.
  const isLiffRedirect=paramsBeforeInit.has('liff.state') ||
    /(?:^|[&#])(?:access_token|id_token|context_token|feature_token)=/.test(location.hash);
  if(savedToken&&!forceReauth&&!isLiffRedirect&&!explicitLogout){
    try{
      const response=await fetch(AUTH_API,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({idToken:savedToken})
      });
      const data=await response.json().catch(()=>({}));
      if(response.ok&&data.ok){
        setAuthorized(data.user?.name||'',savedToken);
        return;
      }
      if(!response.ok){
        try{sessionStorage.removeItem(SESSION_TOKEN);}catch(e){console.warn(e);}
      }
    }catch(e){console.warn('Cached authorization check failed; falling back to LIFF.',e);}
  }
  setLocked('正在初始化 LINE LIFF…');
  let initTimer;
  try{
    await Promise.race([
      liff.init({liffId:LIFF_ID}),
      new Promise((_,reject)=>{initTimer=setTimeout(()=>reject(new Error('LIFF_INIT_TIMEOUT')),15000);})
    ]);
    clearTimeout(initTimer);
    const params=new URLSearchParams(location.search);
    if(params.get('reauth')==='1'){
      history.replaceState(null,'',new URL('./admin.html',location.href).pathname);
      try{ if(liff.isLoggedIn()) liff.logout(); }catch(e){ console.error(e); }
      liff.login({redirectUri:new URL('./admin.html',location.href).href});
      return;
    }
    if(explicitLogout){
      try{if(liff.isLoggedIn())liff.logout();}catch(e){console.error(e);}
      setLocked('已登出管理中心，請點選 LINE 管理員登入。',true);
      if(loginBtn)loginBtn.onclick=()=>{
        try{localStorage.removeItem(LOGOUT_MARKER);}catch(e){console.warn(e);}
        liff.login({redirectUri:new URL('./admin.html',window.location.href).href});
      };
      return;
    }
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
    clearTimeout(initTimer);
    console.error(err);
    if(err?.message==='LIFF_INIT_TIMEOUT'){
      setLocked('LINE LIFF 初始化逾時，請重新載入管理中心；權限尚未驗證。',true);
      if(loginBtn){
        loginBtn.textContent='重新載入驗證';
        loginBtn.onclick=()=>window.location.reload();
      }
    }else{
      setLocked('LINE 初始化失敗，請重新載入管理中心；權限尚未驗證。',true);
      if(loginBtn){
        loginBtn.textContent='重新載入驗證';
        loginBtn.onclick=()=>window.location.reload();
      }
    }
  }
}

if(window.liff) initLiff();
else setLocked('LINE LIFF SDK 載入失敗。');
})();
