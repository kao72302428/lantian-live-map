(()=>{
const authStatus=document.getElementById('authStatus');
const loginBtn=document.getElementById('loginBtn');
const actions=[...document.querySelectorAll('.module-action')];

function lockAdminCenter(){
  if(authStatus) authStatus.textContent='尚未完成 LINE LIFF 管理員驗證設定；目前所有管理模組維持鎖定。';
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

lockAdminCenter();
})();
