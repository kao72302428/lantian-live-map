/* 會員欄位與畫面骨架；不連接身分驗證或正式資料。 */
(function(root){
'use strict';
const field=(key,label,type='text',required=false,options={})=>({key,label,type,required,...options});
const consent=[
 field('termsAccepted','同意會員條款','checkbox',true),
 field('privacyAccepted','同意隱私權政策','checkbox',true)
];
const credentials=[
 field('loginMethod','會員登入方式','reserved',true,{note:'登入方式尚未啟用，待後續工作包核定。'}),
 field('password','會員密碼','password-reserved',true,{note:'密碼欄位預留；目前停用，不收取或保存密碼。'})
];
const schemas={
 individual:{
  entryLabel:'非店家會員',memberLabel:'一般會員',icon:'👤',
  sections:[{title:'個人基本資料',fields:[
   field('name','姓名','text',true),field('displayName','顯示名稱／暱稱','text',true),
   field('mobile','手機號碼','tel',true),field('email','Email','email',true),
   field('residenceArea','居住區域','text',true,{placeholder:'例如：高雄市楠梓區；不用填完整地址'}),
   ...credentials,
   field('birthMonth','出生年月','month'),
   field('gender','性別','select',false,{options:['女','男','其他','不提供']}),
   field('preferredContact','常用聯絡方式','select',false,{options:['手機','Email','LINE']}),
   field('notificationsAccepted','願意接收活動／優惠／平台通知','checkbox'),...consent
  ]}]
 },
 business:{
  entryLabel:'店家會員',memberLabel:'店家會員',icon:'🏪',
  sections:[
   {title:'A. 聯絡人基本資料',fields:[
    field('name','聯絡人姓名','text',true),field('mobile','手機號碼','tel',true),
    field('email','Email','email',true),field('jobTitle','職稱','text',true),
    ...credentials,field('lineContact','LINE 聯絡方式'),...consent.map(f=>({...f,label:f.key==='termsAccepted'?'同意店家會員條款':f.label}))
   ]},
   {title:'B. 店家基本資料',fields:[
    field('shopName','店家名稱','text',true),field('shopDisplayName','店家顯示名稱','text',true),
    field('shopCategory','店家主分類','select',true,{options:['美食餐飲','購物零售','居家服務','醫療保健','生活服務','教育休閒']}),
    field('shopSubcategory','店家次分類','text',true,{placeholder:'例如：咖啡、服飾、美髮'}),
    field('shopPhone','店家電話','tel',true),field('shopAddress','店家地址','text',true),
    field('businessArea','營業區域','text',true),field('shopDescription','店家簡介','textarea',true),
    field('mapsUrl','Google Maps 連結','url'),field('website','官方網站','url'),
    field('facebook','Facebook','url'),field('instagram','Instagram','url'),
    field('officialLine','LINE 官方帳號'),field('businessHours','營業時間'),
    field('logo','店家 Logo','file'),field('cover','店家主圖','file'),
    field('businessNotificationsAccepted','願意接收平台活動／招商通知','checkbox')
   ]}
  ]
 }
};
const states={member:['待驗證','正常','停權','停用'],shopReview:['待審核','已通過','退回補件','停用'],shopChangeReview:['未提出','待審核','已通過','退回補件','停用']};
const commonAdmin=[
 ['memberId','會員編號'],['memberType','會員類別'],['name','會員姓名'],['displayName','顯示名稱'],
 ['mobile','手機'],['email','Email'],['memberStatus','會員狀態'],['registeredAt','註冊時間'],
 ['lastLoginAt','最後登入時間'],['emailVerified','Email 驗證狀態'],['mobileVerified','手機驗證狀態'],
 ['suspended','是否停權'],['adminNotes','管理備註'],['updatedAt','最後更新時間']
];
const businessAdmin=[
 ['shopId','店家 ID'],['shopName','店家名稱'],['shopIdentity','既有店家／新申請店家'],
 ['shopBound','是否完成既有店家綁定'],['shopReviewStatus','店家審核狀態'],['shopChangeReviewStatus','店家資料修改審核狀態']
];
const fieldsFor=type=>schemas[type]?schemas[type].sections.flatMap(s=>s.fields):[];
// First registration is a projection; the complete profile/admin schema stays intact.
const registrationKeys={
 individual:['name','mobile','email','password','termsAccepted','privacyAccepted'],
 business:['name','mobile','email','password','termsAccepted','privacyAccepted','shopName']
};
const registrationFieldsFor=type=>fieldsFor(type).filter(f=>registrationKeys[type]?.includes(f.key));
const registrationSectionsFor=type=>schemas[type]?schemas[type].sections.map(s=>({...s,fields:s.fields.filter(f=>registrationKeys[type].includes(f.key))})).filter(s=>s.fields.length):[];
const validateRegistration=(type,data)=>validatePreview(type,data,true);
function validatePreview(type,data,registration=false){
 const errors=[];
 if(!schemas[type])return ['請先選擇會員類別。'];
 for(const f of fieldsFor(type)){
  if(f.type==='reserved'||f.type==='password-reserved'||f.type==='file')continue;
  const value=data[f.key];
  if(f.required&&(!registration||registrationKeys[type].includes(f.key))&&(f.type==='checkbox'?value!==true:!String(value||'').trim()))errors.push('請填寫／勾選：'+f.label);
  if(value&&f.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))errors.push('Email 格式不正確。');
  if(value&&f.type==='url'){try{if(!['http:','https:'].includes(new URL(value).protocol))throw Error();}catch{errors.push(f.label+'請填寫 http 或 https 網址。');}}
  if(value&&f.type==='select'&&!f.options.includes(value))errors.push(f.label+'選項不正確。');
 }
 if(data.birthMonth&&(!/^\d{4}-(0[1-9]|1[0-2])$/.test(data.birthMonth)||data.birthMonth>new Date().toISOString().slice(0,7)))errors.push('出生資料請使用有效年月，不可填未來年月。');
 if(type==='business'){
  if(!['existing','new'].includes(data.shopIdentity))errors.push('請選擇店家身分類型。');
  if(!registration&&data.shopIdentity==='existing'&&!String(data.existingShopName||'').trim())errors.push('請填寫待綁定的既有店家名稱。');
 }
 return errors;
}
function previewMember(type,data){
 const errors=validatePreview(type,data);
 if(errors.length)return {ok:false,errors};
 const result={memberType:type,memberLabel:schemas[type].memberLabel,memberId:null,memberStatus:'待驗證',registeredAt:null,lastLoginAt:null,emailVerified:false,mobileVerified:false,suspended:false,adminNotes:'',updatedAt:null};
 for(const f of fieldsFor(type)){
  if(['reserved','password-reserved','file'].includes(f.type))continue;
  result[f.key]=f.type==='checkbox'?data[f.key]===true:String(data[f.key]||'').trim();
 }
 if(type==='business'){
  result.displayName=result.shopDisplayName;
  result.shopIdentity=data.shopIdentity;
  result.existingShopId=data.shopIdentity==='existing'?String(data.existingShopId||'').trim():'';
  result.existingShopName=data.shopIdentity==='existing'?String(data.existingShopName||'').trim():'';
  result.shopId=null;result.shopBound=false;result.shopReviewStatus='待審核';result.shopChangeReviewStatus='未提出';
  result.applicationKind=data.shopIdentity==='existing'?'既有店家綁定申請':'待審核店家申請';
 }
 return {ok:true,member:result};
}
function fileError(file){
 if(!file)return '';
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))return '僅支援 JPG、PNG、WebP 圖片。';
 if(file.size<=0||file.size>2500000)return '圖片須大於 0 bytes 且不超過 2.5 MB。';
 return '';
}
const api={schemas,states,commonAdmin,businessAdmin,fieldsFor,registrationFieldsFor,registrationSectionsFor,validateRegistration,validatePreview,previewMember,fileError};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.LantianMembers=api;
})(typeof window!=='undefined'?window:{});

