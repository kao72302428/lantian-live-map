(function(){
'use strict';
const M=window.LantianMembers;
const samples=[
 {memberType:'business',name:'示意聯絡人乙',displayName:'示意店家',shopName:'示意店家（非真實店家）',memberStatus:'待驗證',shopIdentity:'existing',shopBound:false,shopReviewStatus:'待審核',shopChangeReviewStatus:'未提出',emailVerified:false,mobileVerified:false,suspended:false},
 {memberType:'individual',name:'示意會員甲',displayName:'示意暱稱',memberStatus:'待驗證',emailVerified:false,mobileVerified:false,suspended:false}
];
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function value(item,key){
 if(key==='memberType')return M.schemas[item.memberType].memberLabel;
 if(key==='shopIdentity')return item.shopIdentity==='existing'?'平台既有店家':'新申請店家';
 if(['emailVerified','mobileVerified'].includes(key))return item[key]?'已驗證':'未驗證';
 if(key==='suspended')return item.suspended?'是':'否';
 if(key==='shopBound')return item.shopBound?'已完成':'未完成';
 if(key==='lastLoginAt')return '尚未登入';
 if(['registeredAt','updatedAt','memberId','shopId'].includes(key))return '尚未建立';
 return item[key]||'未填（示意）';
}
function render(){
 const host=document.getElementById('memberSkeletons');host.replaceChildren();
 const selected=document.getElementById('memberTypeFilter').value;
 const shown=samples.filter(x=>selected==='all'||x.memberType===selected);
 document.getElementById('sampleCount').textContent='顯示 '+shown.length+' 張固定示意卡';
 for(const item of shown){
  const article=el('article',undefined,'panel schema-card');
  article.append(el('span',M.schemas[item.memberType].icon+' '+M.schemas[item.memberType].memberLabel,'badge '+item.memberType),el('h2',item.name,'profile-name'));
  if(item.memberType==='business')article.append(el('p','店家會員｜'+item.shopName,'profile-shop'));
  const list=el('dl');
  const fields=[...M.commonAdmin,...(item.memberType==='business'?M.businessAdmin:[])];
  for(const [key,label]of fields)list.append(el('dt',label),el('dd',value(item,key)));
  article.append(list);host.append(article);
 }
}
document.getElementById('memberTypeFilter').addEventListener('change',render);render();
})();
