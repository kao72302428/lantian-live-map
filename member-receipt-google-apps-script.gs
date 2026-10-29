// Independent member-receipt web app. Do not paste over the contact/cases project.
// Set Script Property MEMBER_RECEIPT_SECRET (same sensitive value as Vercel).
function doPost(e){
 try{
  const p=e&&e.parameter||{},payload=String(p.payload||''),signature=String(p.signature||'');
  const secret=PropertiesService.getScriptProperties().getProperty('MEMBER_RECEIPT_SECRET');
  if(!secret||secret.length<32||payload.length>5000||!/^[a-f0-9]{64}$/.test(signature))return receiptJson_({ok:false});
  const expected=Utilities.computeHmacSha256Signature(payload,secret).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
  let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i);if(diff)return receiptJson_({ok:false});
  const m=JSON.parse(payload);
  if(m.purpose!=='member-registration-receipt'||Math.abs(Date.now()-m.timestamp)>300000||!Number.isFinite(m.timestamp)||!/^MEM-[0-9]{8}-[A-F0-9]{32}$/.test(m.memberId)||!['individual','business'].includes(m.memberType)||!/^\S+@\S+\.\S+$/.test(m.email)||/[\r\n]/.test(m.email)||String(m.name||'').length>120||String(m.shopName||'').length>200)return receiptJson_({ok:false});
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
   const props=PropertiesService.getScriptProperties(),key='receipt:'+m.memberId;
   if(props.getProperty(key))return receiptJson_({ok:true,receiptId:m.memberId});
   const category=m.memberType==='business'?'免費店家會員':'一般會員（免費）';
   const body=[m.name+' 您好：','','您已成功加入「智慧藍田 LIVE 一點通」。','會員類別：'+category,'會員編號：'+m.memberId,'註冊時間：'+Utilities.formatDate(new Date(m.registeredAt),'Asia/Taipei','yyyy-MM-dd HH:mm:ss'),m.shopName?'店家名稱：'+m.shopName:'','','目前免費會員無須資格審核，可使用 Email 與註冊時設定的密碼登入。','會員入口：https://lantian-live-map.vercel.app/vision.html',m.memberType==='business'?'免費店家會員可參與部分行銷推廣，依各活動辦法辦理。未來付費正式會員的費用與福利將另行公告。':'','本信僅為註冊成功通知，不代表 Email 或手機已完成驗證。','本信不會附上您的密碼，請妥善保管登入資料。','','智慧藍田 LIVE 一點通'].join('\n');
   MailApp.sendEmail({to:m.email,subject:'【智慧藍田】會員註冊成功通知',body:body,name:'智慧藍田 LIVE 一點通'});
   props.setProperty(key,String(Date.now()));
   return receiptJson_({ok:true,receiptId:m.memberId});
  }finally{lock.releaseLock();}
 }catch(_){return receiptJson_({ok:false});}
}
function receiptJson_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
