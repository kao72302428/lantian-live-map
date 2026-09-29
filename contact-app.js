(()=>{
const typeInput=document.getElementById('caseType'),selected=document.getElementById('selected'),form=document.getElementById('contactForm'),formSection=document.getElementById('contactFormSection'),msg=document.getElementById('formMsg'),submit=form?.querySelector('.submit'),receiver=document.getElementById('contactReceiver'),contentText=document.getElementById('contentText'),contentLabelText=document.getElementById('contentLabelText'),contentGuide=document.getElementById('contentGuide'),typesSection=document.getElementById('contactTypes');
let waiting=false,done=false,progressTimer=null,slowTimer=null,resetTimer=null;
const prompts={
'平台資訊修改':{label:'平台資訊修改留言',guide:'請依序填寫：\n1. 店家／單位名稱\n2. 需要修改的項目（店名、地址、電話、營業時間、類別等）\n3. 正確資料\n4. 其他補充說明'},
'地方問題反映／協助通報':{label:'地方問題反映留言',guide:'請依序填寫：\n1. 問題類型（路燈、道路、水溝、環境或其他）\n2. 發生地點／附近明顯地標\n3. 發現時間\n4. 現場狀況與影響\n5. 問題是否仍持續'},
'商圈意見回饋':{label:'商圈意見回饋留言',guide:'請依序填寫：\n1. 店家／地點名稱\n2. 回饋項目（服務、環境、資訊、食安、推薦等）\n3. 發生／體驗時間\n4. 具體情況\n5. 您的建議或希望改善方式'},
'合作提案':{label:'合作提案留言',guide:'請依序填寫：\n1. 合作項目\n2. 預計時間\n3. 預計地點\n4. 項目內容／活動規模\n5. 希望的合作方式\n6. 需要我們協助或回覆的事項'}
};
function clearTimers(){if(progressTimer){clearTimeout(progressTimer);progressTimer=null;}if(slowTimer){clearTimeout(slowTimer);slowTimer=null;}}
function clearResetTimer(){if(resetTimer){clearTimeout(resetTimer);resetTimer=null;}}
function clearDraft(){try{sessionStorage.removeItem('contactDraft');localStorage.removeItem('contactDraft');}catch(e){}}
function showTypes(scrollToTypes=true){
 clearResetTimer();
 form?.reset();clearDraft();clearTimers();waiting=false;done=false;
 if(typeInput)typeInput.value='';
 if(selected)selected.textContent='';
 if(contentLabelText)contentLabelText.textContent='留言內容';
 if(contentGuide)contentGuide.textContent='';
 if(contentText){contentText.value='';contentText.placeholder='請依照上方提示項目填寫內容';}
 if(msg)msg.textContent='';
 if(formSection)formSection.hidden=true;
 document.querySelectorAll('[data-card-type]').forEach(c=>c.classList.remove('active'));
 if(submit){submit.disabled=false;submit.textContent='送出資料';}
 if(scrollToTypes)requestAnimationFrame(()=>typesSection?.scrollIntoView({behavior:'smooth',block:'start'}));
}
function openForm(type){
 const p=prompts[type];if(!p)return;
 clearResetTimer();
 document.querySelectorAll('[data-card-type]').forEach(c=>c.classList.toggle('active',c.dataset.cardType===type));
 if(typeInput)typeInput.value=type;
 if(selected)selected.textContent='目前選擇：'+type;
 if(contentLabelText)contentLabelText.textContent=p.label;
 if(contentGuide){contentGuide.textContent=p.guide;contentGuide.style.whiteSpace='pre-line';}
 if(contentText){contentText.value='';contentText.placeholder='請依照上方提示項目填寫內容';}
 if(formSection)formSection.hidden=false;
 if(msg)msg.textContent='';
 if(submit){submit.disabled=false;submit.textContent='送出資料';}
 requestAnimationFrame(()=>formSection?.scrollIntoView({behavior:'smooth',block:'start'}));
}
function markSuccess(text){
 clearTimers();clearResetTimer();waiting=false;done=true;
 if(msg)msg.textContent=text;
 if(submit){submit.disabled=true;submit.textContent='已送出';}
 resetTimer=setTimeout(()=>showTypes(),1800);
}
if('scrollRestoration' in history)history.scrollRestoration='manual';
window.addEventListener('pageshow',()=>{
 showTypes(false);
 requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}));
});
window.addEventListener('beforeunload',()=>{clearDraft();clearResetTimer();});
document.querySelectorAll('.enterMessage[data-type]').forEach(btn=>btn.addEventListener('click',()=>openForm(btn.dataset.type)));

if(form){form.addEventListener('submit',e=>{
 if(!typeInput?.value){e.preventDefault();showTypes();return;}
 if(!form.reportValidity()){e.preventDefault();return;}
 clearTimers();clearResetTimer();waiting=true;done=false;
 if(submit){submit.disabled=true;submit.textContent='送出中…';}
 if(msg)msg.textContent='資料送出中…';
 progressTimer=setTimeout(()=>{if(waiting&&!done&&msg)msg.textContent='資料處理中，請稍候…';},3000);
 slowTimer=setTimeout(()=>{if(waiting&&!done&&msg)msg.textContent='系統回應較慢，請勿重複送出。';},12000);
});}

if(receiver){receiver.addEventListener('load',()=>{
 if(waiting&&!done){markSuccess('資料已送出完成，1.8 秒後自動回到留言選單。');}
});}

window.addEventListener('message',e=>{
 if(!receiver||e.source!==receiver.contentWindow)return;
 if(!waiting&&!done)return;
 const d=e.data;if(!d||typeof d!=='object'||typeof d.ok==='undefined')return;
 clearTimers();
 if(d.ok){
  markSuccess('資料已送出並完成存檔。案件編號：'+(d.id||'')+'｜即將回到留言選單。');
 }else{
  clearResetTimer();waiting=false;done=true;
  if(msg)msg.textContent='送出失敗：'+(d.message||'請稍後再試');
  if(submit){submit.disabled=false;submit.textContent='重新送出';}
 }
});
})();
