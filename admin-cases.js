(()=>{
const statusBox=document.getElementById('statusBox');
const loginBtn=document.getElementById('loginBtn');
const casePanel=document.getElementById('casePanel');

function lockAdminCenter(message){
 if(statusBox)statusBox.textContent=message;
 if(loginBtn){loginBtn.disabled=true;loginBtn.textContent='LINE 管理員登入';}
 if(casePanel)casePanel.hidden=true;
}

lockAdminCenter('尚未完成 LINE LIFF 管理員驗證設定；目前不會載入任何案件資料。');
})();
