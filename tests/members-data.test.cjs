'use strict';
const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const {PGlite} = require('@electric-sql/pglite');
const {readFileSync} = require('node:fs');
const {migrate} = require('../lib/members-migrate.cjs');
const {repository,prepare} = require('../lib/members-repository.cjs');
let db,client,repo,n=0;
const input = (extra={})=>({memberType:'individual',name:'UAT',displayName:'UAT',mobile:'TEST',email:`unit-${++n}@example.invalid`,...extra});
before(async()=>{
 db=new PGlite();
 client={query:async(sql,params)=> params === undefined && sql.includes('CREATE SCHEMA') ? (await db.exec(sql)).at(-1) : db.query(sql,params)};
 repo=repository(client);
});
after(async()=>db.close());
test('schema migration creates tables and tracked version',async()=>assert.equal(await migrate(client),'APPLIED'));
test('same migration is repeatable without data reset',async()=>assert.equal(await migrate(client),'ALREADY_APPLIED'));
test('individual INSERT then SELECT by member ID',async()=>{
 const row=await repo.createMember(input()); const got=await repo.getMemberByMemberId(row.member_id);assert.equal(got.id,row.id);
});
test('email normalization and case-insensitive duplicate rejected',async()=>{
 const data=input({email:' Case-Test@Example.invalid '});await repo.createMember(data);
 await assert.rejects(repo.createMember({...data,email:'CASE-TEST@example.invalid'}),/MEMBER_CONFLICT/);
 assert.ok(await repo.getMemberByEmail('CASE-TEST@example.invalid'));
});
test('DB rejects duplicate member ID',async()=>{
 const r=await repo.createMember(input());
 await assert.rejects(client.query("INSERT INTO lantian_members.members(member_id,member_type,name,display_name,mobile,email) VALUES ($1,'individual','UAT','UAT','TEST',$2)",[r.member_id,input().email]),e=>e.code==='23505');
});
test('DB rejects invalid member type',async()=>assert.rejects(client.query("INSERT INTO lantian_members.members(member_type,name,display_name,mobile,email) VALUES ('bad','UAT','UAT','TEST',$1)",[input().email]),e=>e.code==='23514'));
test('DB rejects invalid member status',async()=>assert.rejects(client.query("INSERT INTO lantian_members.members(member_status,member_type,name,display_name,mobile,email) VALUES ('bad','individual','UAT','UAT','TEST',$1)",[input().email]),e=>e.code==='23514'));
for(const field of ['email_verified','mobile_verified','suspended'])test(`${field} defaults false`,async()=>assert.equal((await repo.createMember(input()))[field],false));
test('server fields cannot be supplied through registration input',async()=>{
 const r=await repo.createMember(input({memberId:'0001',memberStatus:'active',emailVerified:true,adminNotes:'injected',registeredAt:'2000-01-01',password:'NOT-A-REAL-PASSWORD'}));
 assert.match(r.member_id,/^MEM-\d{8}-[A-F0-9]{32}$/);assert.equal(r.member_status,'pending');assert.equal(r.email_verified,false);
 const saved=(await client.query('SELECT admin_notes,password_hash,registration_profile FROM lantian_members.members WHERE id=$1',[r.id])).rows[0];
 assert.equal(saved.admin_notes,'');assert.equal(saved.password_hash,null);assert.ok(!JSON.stringify(saved).includes('NOT-A-REAL-PASSWORD'));
});
test('plaintext hash rejected by application and DB',async()=>{
 assert.throws(()=>prepare(input(),{passwordHash:'INVALID-PLAINTEXT-SENTINEL'}),/HASH_REQUIRED/);
 await assert.rejects(client.query("INSERT INTO lantian_members.members(password_hash,member_type,name,display_name,mobile,email) VALUES ('INVALID-PLAINTEXT-SENTINEL','individual','UAT','UAT','TEST',$1)",[input().email]),e=>e.code==='23514');
});
test('read and create projections never expose hash/admin notes',async()=>{
 const r=await repo.createMember(input(),{isTest:true,passwordHash:'TEST-ONLY-NOT-AUTHENTICATION'});
 for(const value of [r,await repo.getMemberByMemberId(r.member_id),await repo.getMemberByEmail(r.email)])for(const key of ['password','password_hash','admin_notes']) assert.ok(!Object.hasOwn(value,key));
});
for(const identity of ['existing','new'])test(`business ${identity} stays pending and unbound`,async()=>{
 const r=await repo.createMember(input({memberType:'business',shopName:'UAT SHOP',shopIdentity:identity,shopId:'injected',shopBound:true,shopReviewStatus:'approved'}));
 const b=(await client.query('SELECT * FROM lantian_members.business_member_profiles WHERE member_fk=$1',[r.id])).rows[0];
 assert.equal(b.shop_id,null);assert.equal(b.shop_bound,false);assert.equal(b.shop_review_status,'pending');assert.equal(b.shop_change_review_status,'none');
});
test('failed business profile insert rolls back entire member',async()=>{
 const data=input({memberType:'business',shopName:'x'.repeat(201),shopIdentity:'new'});
 // DB business-profile check fails AFTER contact INSERT: both must roll back.
 await assert.rejects(repo.createMember(data),/MEMBER_WRITE_FAILED/);assert.equal(await repo.getMemberByEmail(data.email),null);
});
test('updated_at maintained by database trigger',async()=>{
 const r=await repo.createMember(input());await client.query('UPDATE lantian_members.members SET display_name=$1 WHERE id=$2',['changed',r.id]);
 assert.ok(new Date((await repo.getMemberByMemberId(r.member_id)).updated_at)>new Date(r.updated_at));
});
test('unknown table causes HOLD and remains intact',async()=>{
 await client.query('CREATE TABLE public.unknown_uat_guard (id integer)');
 await assert.rejects(migrate(client),/UNKNOWN_SCHEMA_HOLD/);
 assert.ok((await client.query("SELECT to_regclass('public.unknown_uat_guard') AS present")).rows[0].present);
});
test('DB module fails closed and exports no config',()=>{
 const mod=require('../lib/db.cjs');assert.deepEqual(Object.keys(mod),['createPool']);
 const old=process.env.DATABASE_URL;delete process.env.DATABASE_URL;
 try {assert.throws(()=>mod.createPool(),/^Error: DB_NOT_CONFIGURED$/);}finally {if(old!==undefined)process.env.DATABASE_URL=old;}
});
