(()=>{
const LIFF_ID='2011802000-aDp14e0D';
const authStatus=document.getElementById('authStatus');
const loginBtn=document.getElementById('loginBtn');
const actions=[...document.querySelectorAll('.module-action')];

function lockAdminCenter(message){
  if(authStatus) authStatus.textContent=message;
  if(loginBtn){ loginBtn.disabled=false; loginBtn.textContent='LINE 管理員登入'; }
  actions.forEach(el=>{
    if(el.tagName==='BUTTON') el.disabled=true;
    if(el.tagName==='A'){
      el.setAttribute('aria-disabled','true');
      el.setAttribute('tabindex','-1');
      el.classList.add('disabled-link');
    }
  });
}

function hardLock(message){
  if(authStatus) authStatus.textContent=message;
  if(loginBtn){ loginBtn.disabled=true; loginBtn.textContent='LINE 管理員登入'; }
  actions.forEach(el=>{
    if(el.tagName==='BUTTON') el.disabled=true;
    if(el.tagName==='A'){
      el.setAttribute('aria-disabled','true');
      el.setAttribute('tabindex','-1');
      el.classList.add('disabled-link');
    }
  });
}

async function initLiff(){
  hardLock('正在初始化 LINE LIFF…');
  try{
    await liff.init({liffId:LIFF_ID});
    if(!liff.isLoggedIn()){
      lockAdminCenter('尚未登入 LINE。請使用管理員 LINE 帳號登入；登入後仍需後端驗證管理員身分。');
      loginBtn.onclick=()=>liff.login({redirectUri:window.location.href.split('#')[0]});
      return;
    }

    const idToken=liff.getIDToken();
    if(!idToken){
      lockAdminCenter('已登入 LINE，但未取得 ID token。請重新登入。');
      loginBtn.onclick=()=>{ liff.logout(); location.reload(); };
      loginBtn.textContent='重新登入 LINE';
      return;
    }

    // SECURITY: Do not trust profile/userId on the client. The ID token must be verified
    // by a server-side endpoint and matched against an administrator allowlist.
    hardLock('LINE 登入成功；後端管理員身分驗證尚未接通，因此管理功能仍維持鎖定。');
  }catch(err){
    console.error(err);
    hardLock('LIFF 初始化失敗，請確認 LIFF ID、Endpoint URL 與 LINE Login 設定。');
  }
}

if(window.liff){ initLiff(); }
else hardLock('LINE LIFF SDK 載入失敗。');
})();
