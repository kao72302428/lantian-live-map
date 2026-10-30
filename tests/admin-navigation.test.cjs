'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const expected={
 'admin-cases.html':'./contact.html',
 'admin-greenlife.html':'./greenlife.html',
 'admin-members.html':'./vision.html',
 'admin-merchant.html':'./merchant.html',
 'admin-news.html':'./news.html',
 'admin-vision.html':'./home.html',
 'admin-whitepaper.html':'./whitepaper.html'
};

test('every module admin has return-to-front and return-to-admin links',()=>{
 for(const [file,front] of Object.entries(expected)){
  const html=fs.readFileSync(file,'utf8');
  assert.match(html,/href="\.\/admin\.html"[^>]*>[^<]*返回管理中心/,'missing admin link: '+file);
  assert.ok(html.includes('href="'+front+'"'),'missing front link: '+file);
  assert.match(html,/返回前台/,'missing front label: '+file);
 }
});
