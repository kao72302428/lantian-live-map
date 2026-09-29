(()=>{
const typeInput=document.getElementById('caseType'),selected=document.getElementById('selected'),form=document.getElementById('contactForm'),msg=document.getElementById('formMsg'),submit=form?.querySelector('.submit'),receiver=document.getElementById('contactReceiver'),contentText=document.getElementById('contentText'),contentLabelText=document.getElementById('contentLabelText'),contentGuide=document.getElementById('contentGuide'),typesSection=document.getElementById('contactTypes');
let waiting=false,done=false,confirmTimer=null,progressTimer=null;
const prompts={
'平台資訊修改':{label:'修改內容',guide:'請依序填寫：\n1. 店家／單位名稱\n2. 需要修改的項目（店名、地址、電話、營業時間、類別等）\n3. 正確資料\n4. 其他補充說明'},
'地方問題反映／協助通報':{label:'問題內容',guide:'請依序填寫：\n1. 問題類型（路燈、道路、水溝、環境或其他）\n2. 發生地點／附近明顯地標\n3. 發現時間\n4. 現場狀況與影響\n5. 問題是否仍持續'},
'商圈意見回饋':{label:'回饋內容',guide:'請依序填寫：\n1. 店家／地點名稱\n2. 回饋項目（服務、環境、資訊、食安、推薦等）\n3. 發生／體驗時間\n4. 具體情況\n5. 您的建議或希望改善方式'},
'合作提案':{label:'合作提案內容',guide:'請依序填寫：\n1. 合作項目\n2. 預計時間\n3. 預計地點\n4. 項目內容／活動規模\n5. 希望的合作方式\n6. 需要我們協助或回覆的事項'}
};
function clearTimers(){if(confirmTimer){clearTimeout(confirmTimer);confirmTimer=null;}if(progressTimer){clearTimeout(progressTimer);progressTimer=null;}}
function clearDraft(){try{sessionStorage.removeItem('contactDraft');localStorage.removeItem('contactDraft');}catch(e){}}
const resetUi=(text)=>{done=true;waiting=false;clearTimers();if(msg)msg.textContent=text;form?.reset();clearDraft();if(typeInput)typeInput.value='';if(selected)selected.textContent='請先選擇上方聯絡類型';if(contentLabelText)contentLabelText.textContent='事實內容';if(contentGuide)contentGuide.textContent='請先選擇上方聯絡類型，系統會固定顯示對應填寫項目；輸入文字後提示不會消失。';if(contentText){contentText.value='';contentText.placeholder='請在此輸入內容';}document.querySelectorAll('[data-type]').forEach(b=>b.classList.remove('active'));if(submit){submit.disabled=false;submit.textContent='送出資料';}};
function focusTypes(){requestAnimationFrame(()=>typesSection?.scrollIntoView({behavior:'auto',block:'start'}));}
function clearFormOnLoad(){form?.reset();clearDraft();clearTimers();waiting=false;done=false;if(typeInput)typeInput.value='';if(contentText)contentText.value='';document.querySelectorAll('[data-type]').forEach(b=>b.classList.remove('active'));if(selected)selected.textContent='請先選擇上方聯絡類型';if(contentLabelText)contentLabelText.textContent='事實內容';if(contentGuide)contentGuide.textContent='請先選擇上方聯絡類型，系統會固定顯示對應填寫項目；輸入文字後提示不會消失。';if(submit){submit.disabled=false;submit.textContent='送出資料';}focusTypes();}
window.addEventListener('pageshow',clearFormOnLoad);
window.addEventListener('beforeunload',clearDraft);

document.querySelectorAll('[data-type]').forEach(btn=>btn.addEventListener('click',()=>{
 document.querySelectorAll('[data-type]').forEach(b=>b.classList.toggle('active',b===btn));
 const type=btn.dataset.type;if(typeInput)typeInput.value=type;if(selected)selected.textContent='目前選擇：'+type;if(msg)msg.textContent='';
 const p=prompts[type];if(p){if(contentLabelText)contentLabelText.textContent=p.label;if(contentGuide){contentGuide.textContent=p.guide;contentGuide.style.whiteSpace='pre-line';}if(contentText)contentText.placeholder='請依照上方項目填寫內容';}
 document.querySelector('.formbox')?.scrollIntoView({behavior:'smooth',block:'start'});
}));

if(form){form.addEventListener('submit',e=>{
 if(!typeInput?.value){e.preventDefault();if(msg)msg.textContent='請先選擇聯絡類型。';focusTypes();return;}
 if(!form.reportValidity()){e.preventDefault();return;}
 clearTimers();waiting=true;done=false;
 if(submit){submit.disabled=true;submit.textContent='送出中…';}
 if(msg)msg.textContent='資料送出中，請稍候…';
 progressTimer=setTimeout(()=>{if(waiting&&!done&&msg)msg.textContent='資料仍在處理中，請稍候，不要重複送出。';},8000);
 confirmTimer=setTimeout(()=>{if(waiting&&!done){waiting=false;if(msg)msg.textContent='系統尚未收到完成確認。若已收到案件通知信，代表資料已送達，請勿重複送出；若未收到通知信，再重新送出。';if(submit){submit.disabled=false;submit.textContent='重新送出';}}},30000);
});}
if(receiver){receiver.addEventListener('load',()=>{if(waiting&&!done&&msg)msg.textContent='資料已提交，等待系統確認…';});}
window.addEventListener('message',e=>{
 if(!receiver||e.source!==receiver.contentWindow||!waiting||done)return;
 const d=e.data;if(!d||typeof d!=='object'||typeof d.ok==='undefined')return;
 clearTimers();
 if(d.ok){resetUi('資料已送出並完成存檔。案件編號：'+(d.id||''));focusTypes();}
 else{done=true;waiting=false;if(msg)msg.textContent='送出失敗：'+(d.message||'請稍後再試');if(submit){submit.disabled=false;submit.textContent='重新送出';}}
});
})();
