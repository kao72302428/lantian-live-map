// Independent project. Never replace the accepted contact/cases Apps Script.
// Script property MEMBER_SHEET_SECRET must match Vercel's sensitive variable.
const MEMBER_SHEET_ID='1N1m_GBw7vQK0KZ6SncyZj3io0G8bt9_ksMX9t_UCsK8';
const MEMBER_SHEET_TAB='會員基本資料';
const MEMBER_SHEET_HEADERS=['會員編號','會員類別','姓名／聯絡人','店家名稱','手機','Email','會員方案','註冊時間（台灣）'];
function doGet(){return memberSheetJson_({ok:false});}
function doPost(e){
 try{
  const p=e&&e.parameter||{},payload=String(p.payload||''),signature=String(p.signature||'');
  const secret=PropertiesService.getScriptProperties().getProperty('MEMBER_SHEET_SECRET');
  if(!secret||secret.length<32||payload.length>6000||!/^[a-f0-9]{64}$/.test(signature))return memberSheetJson_({ok:false});
  const expected=Utilities.computeHmacSha256Signature(payload,secret).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
  let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i);
  if(diff)return memberSheetJson_({ok:false});
  const m=JSON.parse(payload);
  if(!validSheetMember_(m))return memberSheetJson_({ok:false});
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
   const book=SpreadsheetApp.openById(MEMBER_SHEET_ID),sheet=book.getSheetByName(MEMBER_SHEET_TAB);
   if(!sheet||JSON.stringify(sheet.getRange(1,1,1,8).getValues()[0])!==JSON.stringify(MEMBER_SHEET_HEADERS))return memberSheetJson_({ok:false});
   // The member ID is the idempotency key, including after a network timeout.
   const last=sheet.getLastRow();
   if(last>1&&sheet.getRange(2,1,last-1,1).createTextFinder(m.memberId).matchEntireCell(true).findNext())return memberSheetJson_({ok:true,memberId:m.memberId});
   const row=Math.max(2,last+1),texts=[m.memberId,m.memberType==='business'?'店家會員':'一般會員',m.name,m.shopName,m.mobile,m.email,'免費會員'];
   sheet.getRange(row,1,1,7).setNumberFormat('@').setValues([texts.map(sheetLiteral_)]);
   sheet.getRange(row,8).setValue(new Date(m.registeredAt)).setNumberFormat('yyyy-mm-dd hh:mm:ss');
   SpreadsheetApp.flush();
   const readback=sheet.getRange(row,1,1,8).getValues()[0];
   if(readback[0]!==m.memberId||!(readback[7] instanceof Date)||readback[7].getTime()!==new Date(m.registeredAt).getTime())return memberSheetJson_({ok:false});
   return memberSheetJson_({ok:true,memberId:m.memberId});
  }finally{lock.releaseLock();}
 }catch(_){return memberSheetJson_({ok:false});}
}
function validSheetMember_(m){
 if(!m||m.purpose!=='member-basic-sheet'||!Number.isFinite(m.timestamp)||Math.abs(Date.now()-m.timestamp)>300000||!/^MEM-[0-9]{8}-[A-F0-9]{32}$/.test(m.memberId)||!['individual','business'].includes(m.memberType)||m.membershipPlan!=='free')return false;
 const limits={name:120,shopName:200,mobile:40,email:254};
 for(const k in limits)if(typeof m[k]!=='string'||m[k].length>limits[k]||/[\r\n\0]/.test(m[k]))return false;
 if(!m.name.trim()||!m.mobile.trim()||!/^\S+@\S+\.\S+$/.test(m.email)||!Number.isFinite(new Date(m.registeredAt).getTime())||(m.memberType==='business'&&!m.shopName.trim()))return false;
 return true;
}
function sheetLiteral_(text){return /^[\s]*[=+\-@]/.test(text)?"'"+text:text;}
function memberSheetJson_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
