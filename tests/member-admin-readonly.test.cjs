'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {listMembers,normalizeLimit}=require('../lib/members-admin-read.cjs');

test('limit is bounded',()=>{
 assert.equal(normalizeLimit(undefined),250);
 assert.equal(normalizeLimit(0),1);
 assert.equal(normalizeLimit(9999),500);
});
test('member admin projection excludes secrets and internal ids',async()=>{
 const calls=[];
 const q={query:async(sql,args)=>{
  calls.push({sql,args});
  if(/count\(\*\)/i.test(sql))return {rows:[{total:1}]};
  return {rows:[{memberId:'MEM-20261030-ABC',memberType:'business',name:'測試',displayName:'測試店',mobile:'0900000000',email:'test@example.invalid',memberStatus:'active',registeredAt:new Date('2026-10-30T00:00:00Z'),lastLoginAt:null,emailVerified:false,mobileVerified:false,suspended:false,updatedAt:new Date('2026-10-30T00:00:00Z'),shopId:null,shopName:'測試店',shopIdentity:'application',shopBound:false,shopReviewStatus:'pending',shopChangeReviewStatus:'none'}]};
 }};
 const out=await listMembers(q,{limit:250});
 assert.equal(out.total,1);assert.equal(out.items[0].shopBound,false);
 const payload=JSON.stringify(out);
 for(const forbidden of ['password_hash','admin_notes','\"id\"','session','secret'])assert.equal(payload.toLowerCase().includes(forbidden.toLowerCase()),false,forbidden);
 const sql=calls.map(x=>x.sql).join('\n').toLowerCase();
 for(const forbidden of ['password_hash','admin_notes',' update ',' delete ',' insert '])assert.equal(sql.includes(forbidden),false,forbidden);
});
test('api is LINE-admin protected and list-only',()=>{
 const src=fs.readFileSync('api/members-admin.js','utf8');
 assert.match(src,/verifyAdminToken/);
 assert.match(src,/action!==['"]list['"]/);
 assert.doesNotMatch(src,/\b(update|delete|insert)\b\s+lantian_members/i);
});
test('frontend is read-only and uses existing admin session token',()=>{
 const src=fs.readFileSync('admin-members.js','utf8');
 assert.match(src,/lantianAdminIdToken/);
 assert.match(src,/action:'list'/);
 assert.doesNotMatch(src,/刪除會員|審核通過|saveMember|updateMember|deleteMember|suspendMember/);
 assert.doesNotMatch(src,/innerHTML\s*=/);
});
test('admin center routes former vision module to member management',()=>{
 const html=fs.readFileSync('admin.html','utf8');
 assert.match(html,/會員專用區管理/);
 assert.match(html,/href="\.\/admin-members\.html"/);
 assert.doesNotMatch(html,/藍田新願景管理/);
});

test('admin pages canonicalize Vercel UI to GitHub Pages before LINE auth',()=>{
 const admin=fs.readFileSync('admin.js','utf8');
 const members=fs.readFileSync('admin-members.js','utf8');
 assert.match(admin,/CANONICAL_ADMIN_URL='https:\/\/kao72302428\.github\.io\/lantian-live-map\/admin\.html'/);
 assert.match(admin,/hostname\.endsWith\('\.vercel\.app'\)/);
 assert.ok(admin.indexOf('location.replace(target.href)')<admin.indexOf('liff.init'));
 assert.match(members,/CANONICAL_MEMBER_ADMIN_URL='https:\/\/kao72302428\.github\.io\/lantian-live-map\/admin-members\.html'/);
 assert.match(members,/hostname\.endsWith\('\.vercel\.app'\)/);
});
