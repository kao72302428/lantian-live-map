(()=>{
const typeInput=document.getElementById('caseType'),selected=document.getElementById('selected'),form=document.getElementById('contactForm'),msg=document.getElementById('formMsg'),submit=form?.querySelector('.submit'),receiver=document.getElementById('contactReceiver'),contentText=document.getElementById('contentText'),contentLabelText=document.getElementById('contentLabelText'),contentGuide=document.getElementById('contentGuide'),photoInput=document.getElementById('photoInput'),photoData=document.getElementById('photoData'),photoName=document.getElementById('photoName'),photoType=document.getElementById('photoType'),photoPreview=document.getElementById('photoPreview'),photoPreviewImg=document.getElementById('photoPreviewImg'),photoStatus=document.getElementById('photoStatus'),removePhoto=document.getElementById('removePhoto');
let waiting=false,done=false,photoBusy=false,confirmTimer=null;
const prompts={
'平台資訊修改':{label:'修改內容',guide:'請依序填寫：\n1. 店家／單位名稱\n2. 需要修改的項目（店名、地址、電話、營業時間、類別等）\n3. 正確資料\n4. 其他補充說明'},
'地方問題反映／協助通報':{label:'問題內容',guide:'請依序填寫：\n1. 問題類型（路燈、道路、水溝、環境或其他）\n2. 發生地點／附近明顯地標\n3. 發現時間\n4. 現場狀況與影響\n5. 問題是否仍持續'},
'商圈意見回饋':{label:'回饋內容',guide:'請依序填寫：\n1. 店家／地點名稱\n2. 回饋項目（服務、環境、資訊、食安、推薦等）\n3. 發生／體驗時間\n4. 具體情況\n5. 您的建議或希望改善方式'},
'合作提案':{label:'合作提案內容',guide:'請依序填寫：\n1. 合作項目\n2. 預計時間\n3. 預計地點\n4. 項目內容／活動規模\n5. 希望的合作方式\n6. 需要我們協助或回覆的事項'}
};
function clearDraft(){try{sessionStorage.removeItem('contactDraft');localStorage.removeItem('contactDraft');}catch(e){}}
const resetPhoto=()=>{if(photoInput)photoInput.value='';if(photoData)photoData.value='';if(photoName)photoName.value='';if(photoType)photoType.value='';if(photoPreview)photoPreview.hidden=true;if(photoPreviewImg)photoPreviewImg.removeAttribute('src');if(photoStatus)photoStatus.textContent='目前未選擇相片';};
const resetUi=(text)=>{done=true;waiting=false;if(confirmTimer){clearTimeout(confirmTimer);confirmTimer=null;}if(msg)msg.textContent=text;form?.reset();clearDraft();if(typeInput)typeInput.value='';if(selected)selected.textContent='請先選擇上方聯絡類型';if(contentLabelText)contentLabelText.textContent='事實內容';if(contentGuide)contentGuide.textContent='請先選擇上方聯絡類型，系統會固定顯示對應填寫項目；輸入文字後提示不會消失。';if(contentText){contentText.value='';contentText.placeholder='請在此輸入內容';}resetPhoto();document.querySelectorAll('[data-type]').forEach(b=>b.classList.remove('active'));if(submit){submit.disabled=false;submit.textContent='送出資料';}};
function clearFormOnLoad(){form?.reset();clearDraft();if(typeInput)typeInput.value='';if(contentText)contentText.value='';resetPhoto();document.querySelectorAll('[data-type]').forEach(b=>b.classList.remove('active'));if(selected)selected.textContent='請先選擇上方聯絡類型';if(contentLabelText)contentLabelText.textContent='事實內容';if(contentGuide)contentGuide.textContent='請先選擇上方聯絡類型，系統會固定顯示對應填寫項目；輸入文字後提示不會消失。';}
window.addEventListener('pageshow',clearFormOnLoad);
window.addEventListener('beforeunload',clearDraft);

document.querySelectorAll('[data-type]').forEach(btn=>btn.addEventListener('click',()=>{
 document.querySelectorAll('[data-type]').forEach(b=>b.classList.toggle('active',b===btn));
 const type=btn.dataset.type;if(typeInput)typeInput.value=type;if(selected)selected.textContent='目前選擇：'+type;if(msg)msg.textContent='';
 const p=prompts[type];if(p){if(contentLabelText)contentLabelText.textContent=p.label;if(contentGuide){contentGuide.textContent=p.guide;contentGuide.style.whiteSpace='pre-line';}if(contentText)contentText.placeholder='請依照上方項目填寫內容';}
 document.querySelector('.formbox')?.scrollIntoView({behavior:'smooth',block:'start'});
}));

if(photoInput){photoInput.addEventListener('change',async()=>{
 const file=photoInput.files?.[0];resetPhoto();if(!file)return;
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)){if(msg)msg.textContent='相片僅支援 JPG、PNG、WebP。';return;}
 photoBusy=true;if(msg)msg.textContent='相片處理中…';if(photoStatus)photoStatus.textContent='相片處理中…';
 try{
  const url=URL.createObjectURL(file);const img=new Image();img.src=url;await img.decode();
  const max=1600,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);
  const dataUrl=canvas.toDataURL('image/jpeg',0.82);if(photoData)photoData.value=dataUrl.split(',')[1];if(photoName)photoName.value=(file.name.replace(/\.[^.]+$/,'')||'photo')+'.jpg';if(photoType)photoType.value='image/jpeg';if(photoPreviewImg)photoPreviewImg.src=dataUrl;if(photoPreview)photoPreview.hidden=false;if(photoStatus)photoStatus.textContent='已選擇：'+(photoName?.value||'photo.jpg')+'｜格式：JPG';if(msg)msg.textContent='相片已加入，送出時會一併存檔。';
 }catch(e){resetPhoto();if(msg)msg.textContent='相片處理失敗，請換一張再試。';}
 finally{photoBusy=false;}
});}
if(removePhoto)removePhoto.addEventListener('click',()=>{resetPhoto();if(msg)msg.textContent='已移除相片。';});

if(form){form.addEventListener('submit',e=>{
 if(!typeInput?.value){e.preventDefault();if(msg)msg.textContent='請先選擇聯絡類型。';return;}
 if(photoBusy){e.preventDefault();if(msg)msg.textContent='相片仍在處理中，請稍候再送出。';return;}
 if(!form.reportValidity()){e.preventDefault();return;}
 waiting=true;done=false;if(submit){submit.disabled=true;submit.textContent='送出中…';}if(msg)msg.textContent='資料已提交，等待後端確認…';
 if(confirmTimer)clearTimeout(confirmTimer);
 confirmTimer=setTimeout(()=>{if(waiting&&!done){waiting=false;if(msg)msg.textContent='系統尚未回傳完成確認，這筆資料不能視為已送達。請稍後再試。';if(submit){submit.disabled=false;submit.textContent='重新送出';}}},12000);
});}
if(receiver){receiver.addEventListener('load',()=>{if(waiting&&!done&&msg)msg.textContent='資料已提交，等待後端確認…';});}
window.addEventListener('message',e=>{const d=e.data;if(!d||typeof d!=='object'||typeof d.ok==='undefined'||done)return;if(confirmTimer){clearTimeout(confirmTimer);confirmTimer=null;}if(d.ok){resetUi('資料已送出並完成存檔。案件編號：'+(d.id||''));}else{done=true;waiting=false;if(msg)msg.textContent='送出失敗：'+(d.message||'請稍後再試');if(submit){submit.disabled=false;submit.textContent='重新送出';}}});
})();