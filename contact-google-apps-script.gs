const SHEET_ID = '1OsP6JygCRd5FN4XHZsba8TM6hEU8h96k3cqHTJfr6Sk';
const SHEET_NAME = '案件紀錄';
const NOTIFY_EMAIL = 'kao72302428@gmail.com';
const PHOTO_FOLDER_ID = '1EVW-eWrvDlhsDFR7IFN6KlGOQ7OADnUT';
const ADMIN_AUTH_URL = 'https://lantian-live-map.vercel.app/api/admin-auth';

function doPost(e) {
  try {
    const p = e && e.parameter ? e.parameter : {};
    if (p.adminAction) return handleAdmin_(p);

    const now = new Date();
    const tz = 'Asia/Taipei';
    const caseId = 'LT-' + Utilities.formatDate(now, tz, 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 5).toUpperCase();
    const submittedAt = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss');
    const type = clean_(p['聯絡類型']), name = clean_(p['姓名']), phone = clean_(p['電話']), email = clean_(p['email']), content = clean_(p['事實內容']);
    const photoBase64 = String(p['照片Base64'] || ''), photoName = clean_(p['照片檔名']) || '', photoMime = clean_(p['照片格式']) || '';
    if (!type || !name || !phone || !email || !content) return result_(false, '', '缺少必要欄位');

    let photoUrl='', photoSavedName='', photoSavedMime='', photoBlob=null;
    if (photoBase64) {
      const allowed=['image/jpeg','image/png','image/webp'], effectiveMime=photoMime||'image/jpeg';
      if (!allowed.includes(effectiveMime)) throw new Error('不支援的照片格式');
      const bytes=Utilities.base64Decode(photoBase64);
      if (bytes.length>2500000) throw new Error('照片檔案過大，請改用較小圖片');
      const safeOriginalName=(photoName||'photo.jpg').replace(/[^0-9A-Za-z._\-\u4e00-\u9fff]/g,'_');
      photoSavedName=caseId+'-'+safeOriginalName; photoSavedMime=effectiveMime;
      photoBlob=Utilities.newBlob(bytes,effectiveMime,photoSavedName);
      photoUrl=DriveApp.getFolderById(PHOTO_FOLDER_ID).createFile(photoBlob.copyBlob()).getUrl();
    }

    const sheet=SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if(!sheet)throw new Error('找不到工作表：'+SHEET_NAME);
    const lock=LockService.getScriptLock(); lock.waitLock(10000);
    try{sheet.appendRow([caseId,submittedAt,type,name,phone,email,content,'未處理','',submittedAt,'智慧藍田 LIVE 一點通｜建言與合作',photoUrl,photoSavedName,photoSavedMime]);}finally{lock.releaseLock();}

    const subject='【智慧藍田】新案件 '+caseId+'｜'+type;
    const body=['案件編號：'+caseId,'送出時間：'+submittedAt,'聯絡類型：'+type,'姓名：'+name,'電話：'+phone,'Email：'+email,'','事實內容：',content,'','附件照片：'+(photoUrl||'無'),'附件檔名：'+(photoSavedName||'無'),'附件格式：'+(photoSavedMime||'無'),'','Google Sheets 案件紀錄：','https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/edit'].join('\n');
    const mailOptions={to:NOTIFY_EMAIL,subject,body,replyTo:email,name:'智慧藍田 LIVE 一點通'}; if(photoBlob)mailOptions.attachments=[photoBlob]; MailApp.sendEmail(mailOptions);
    try{
      MailApp.sendEmail({to:email,subject:'【智慧藍田】已收到您的留言｜'+caseId,body:[name+' 您好：','','我們已收到您的留言，後續將依案件內容儘速檢視、處理並回覆。','以下為您本次提交的內容，請留存案件編號供後續查詢。','','案件編號：'+caseId,'送出時間：'+submittedAt,'留言類型：'+type,'','您的留言內容：',content,'','如後續需要補充資料，可直接回覆本信或透過「智慧藍田 LIVE 一點通」再次聯絡。','','智慧藍田 LIVE 一點通','高雄市工商發展協會','聯絡電話：0933-101-434','Email：'+NOTIFY_EMAIL].join('\n'),replyTo:NOTIFY_EMAIL,name:'智慧藍田 LIVE 一點通'});
    }catch(receiptErr){console.log('使用者收件確認信寄送失敗：'+String(receiptErr&&receiptErr.message?receiptErr.message:receiptErr));}
    return result_(true,caseId,'已送出');
  } catch (err) { return result_(false,'',String(err&&err.message?err.message:err)); }
}

function handleAdmin_(p){
  if(!verifyAdmin_(p.idToken))return json_({ok:false,code:'NOT_AUTHORIZED'});
  const action=clean_(p.adminAction), sheet=SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  if(!sheet)return json_({ok:false,code:'SHEET_NOT_FOUND'});
  if(action==='list')return json_({ok:true,items:readCases_(sheet)});
  const id=clean_(p.id), row=findCaseRow_(sheet,id);
  if(row<2)return json_({ok:false,code:'CASE_NOT_FOUND'});
  const tz='Asia/Taipei', now=Utilities.formatDate(new Date(),tz,'yyyy-MM-dd HH:mm:ss');
  if(action==='setStatus'){
    const status=clean_(p.status);
    if(['未處理','處理中','已完成'].indexOf(status)<0)return json_({ok:false,code:'INVALID_STATUS'});
    sheet.getRange(row,8).setValue(status); sheet.getRange(row,10).setValue(now);
    return json_({ok:true,items:readCases_(sheet)});
  }
  if(action==='reply'){
    const reply=clean_(p.reply), status=clean_(p.status)||'處理中';
    if(!reply)return json_({ok:false,code:'EMPTY_REPLY'});
    if(['未處理','處理中','已完成'].indexOf(status)<0)return json_({ok:false,code:'INVALID_STATUS'});
    const old=String(sheet.getRange(row,9).getValue()||'');
    const entry='['+now+'] '+reply;
    sheet.getRange(row,9).setValue(old?old+'\n'+entry:entry);
    sheet.getRange(row,8).setValue(status); sheet.getRange(row,10).setValue(now);
    const email=String(sheet.getRange(row,6).getValue()||'').trim(), type=String(sheet.getRange(row,3).getValue()||'');
    if(email)MailApp.sendEmail({to:email,subject:'【智慧藍田】案件回覆｜'+id,body:['您好：','','您的案件已有最新回覆。','案件編號：'+id,'案件類型：'+type,'處理狀態：'+status,'','回覆內容：',reply,'','智慧藍田 LIVE 一點通','高雄市工商發展協會','聯絡電話：0933-101-434','Email：'+NOTIFY_EMAIL].join('\n'),replyTo:NOTIFY_EMAIL,name:'智慧藍田 LIVE 一點通'});
    return json_({ok:true,items:readCases_(sheet)});
  }
  return json_({ok:false,code:'UNKNOWN_ACTION'});
}

function verifyAdmin_(idToken){
  if(!idToken)return false;
  try{
    const r=UrlFetchApp.fetch(ADMIN_AUTH_URL,{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:String(idToken)}),muteHttpExceptions:true});
    if(r.getResponseCode()!==200)return false;
    const d=JSON.parse(r.getContentText()); return !!d.ok;
  }catch(e){return false;}
}
function readCases_(sheet){
  const last=sheet.getLastRow(); if(last<2)return [];
  const rows=sheet.getRange(2,1,last-1,14).getDisplayValues();
  return rows.map(r=>({id:r[0],submittedAt:r[1],type:r[2],name:r[3],phone:r[4],email:r[5],content:r[6],status:r[7]||'未處理',note:r[8],updatedAt:r[9],source:r[10],photoUrl:r[11],photoName:r[12],photoMime:r[13]})).reverse();
}
function findCaseRow_(sheet,id){
  if(!id)return -1; const last=sheet.getLastRow(); if(last<2)return -1;
  const ids=sheet.getRange(2,1,last-1,1).getDisplayValues();
  for(let i=0;i<ids.length;i++)if(String(ids[i][0])===id)return i+2;
  return -1;
}
function doGet(){return HtmlService.createHtmlOutput('智慧藍田建言與合作表單服務正常');}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function result_(ok,id,message){
 const payload=JSON.stringify({ok,id,message});
 return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><script>parent.postMessage('+payload+', "*");</script><div style="font-family:sans-serif;padding:16px">'+(ok?'資料已送出':'送出失敗')+'</div>');
}
function clean_(value){return String(value==null?'':value).trim().slice(0,10000);}
