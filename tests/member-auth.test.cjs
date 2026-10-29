'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {randomBytes}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const {migrate}=require('../lib/members-migrate.cjs');
const {migrateAuth}=require('../lib/member-auth-migrate.cjs');
const {migrateApplication}=require('../lib/member-application-migrate.cjs');
const {handler,createRuntime,ORIGIN}=require('../lib/member-auth-handler.cjs');
const {fixture}=require('../scripts/member-auth-uat.cjs');
let db,pool,server,base,person,business,account,cookie;let ip=0;let oldProfiles;
async function call(action,data,options={}){
 const res=await fetch(`${base}/api/members/${action}`,{method:options.method||(data===undefined?'GET':'POST'),headers:{Origin:ORIGIN,'x-forwarded-proto':'https','x-real-ip':options.ip||`unit-${++ip}`,...(data===undefined?{}:{'Content-Type':'application/json'}),...(options.cookie?{Cookie:options.cookie}:{}),...options.headers},body:data===undefined?undefined:JSON.stringify(data)});
 return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')};
}
before(async()=>{
 db=new PGlite();
 async function query(sql,args){let r;
  if(args===undefined&&sql.includes('CREATE '))r=(await db.exec(sql)).at(-1);
  else r=await db.query(sql,args?.map(x=>x instanceof Date?x.toISOString():x));
  return {...r,rowCount:r.affectedRows??r.rows?.length??0};
 }
 const client={query,release(){}};pool={query,connect:async()=>client};
 await migrate(client);await migrateAuth(client);
 for(const identity of ['existing','new'])await require('../lib/members-repository.cjs').repository(client).createMember({...fixture('business'),displayName:'Legacy shop',shopIdentity:identity});
 oldProfiles=(await pool.query('SELECT * FROM lantian_members.business_member_profiles ORDER BY member_fk')).rows;
 await migrateApplication(client);
 assert.deepEqual((await pool.query('SELECT * FROM lantian_members.business_member_profiles ORDER BY member_fk')).rows,oldProfiles);
 const rt=createRuntime(pool,randomBytes(48).toString('base64url'));
 server=http.createServer(async(req,res)=>{
  res.status=n=>{res.statusCode=n;return res;};res.json=d=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(d));};
  try{
   let raw='';for await(const chunk of req)raw+=chunk;
   req.body=raw?JSON.parse(raw):undefined;
   const action=new URL(req.url,'http://local').pathname.split('/').pop();
   await handler(action,rt)(req,res);
  }catch{res.status(500).json({ok:false});}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 person=fixture('individual');business=fixture('business');
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
test('valid individual register',async()=>{const r=await call('register',person);assert.equal(r.status,201);account=r.data.member;assert.ok(account.memberId);assert.equal(account.memberStatus,'active');assert.equal(account.membershipPlan,'free');assert.equal(r.data.memberSheet.status,'not_configured');});
test('valid business register and pending/unbound',async()=>{const r=await call('register',business);assert.equal(r.status,201);assert.equal(r.data.member.shopReviewStatus,'pending');assert.equal(r.data.member.shopBound,false);assert.equal(r.data.member.memberStatus,'active');assert.equal(r.data.member.shopReviewRequired,false);});
test('duplicate email case insensitive reject',async()=>assert.equal((await call('register',{...person,email:person.email.toUpperCase()})).status,409));
test('invalid email reject',async()=>assert.equal((await call('register',{...fixture('individual'),email:'bad'})).status,400));
test('weak password reject',async()=>assert.equal((await call('register',{...fixture('individual'),password:'short'})).status,400));
test('blank password reject',async()=>assert.equal((await call('register',{...fixture('individual'),password:'        '})).status,400));
test('bcrypt over 72 bytes rejected rather than truncated',async()=>assert.equal((await call('register',{...fixture('individual'),password:'密'.repeat(25)})).status,400));
test('required terms and privacy enforced server side',async()=>assert.equal((await call('register',{...fixture('individual'),privacyAccepted:false})).status,400));
test('required business fields enforced',async()=>assert.equal((await call('register',{...fixture('business'),shopName:''})).status,400));
test('invalid member type reject',async()=>assert.equal((await call('register',{...fixture('individual'),memberType:'admin'})).status,400));
test('password hash is bcrypt not plaintext',async()=>{const row=(await pool.query('SELECT password_hash FROM lantian_members.members WHERE email=$1',[person.email])).rows[0];assert.match(row.password_hash,/^\$2[aby]\$12\$/);assert.notEqual(row.password_hash,person.password);});
test('login wrong password and missing email return same error',async()=>{
 const bad=await call('login',{email:person.email,password:'incorrect-test-value'}),missing=await call('login',{email:'missing@example.invalid',password:'incorrect-test-value'});
 assert.equal(bad.status,401);assert.deepEqual(bad.data,missing.data);
});
test('login succeeds and creates persisted session',async()=>{const r=await call('login',{email:person.email,password:person.password});assert.equal(r.status,200);assert.ok(r.cookie);cookie=r.cookie.split(';')[0];assert.ok((await pool.query('SELECT sid FROM lantian_members.sessions')).rows.length);});
test('cookie security flags',async()=>{const r=await call('login',{email:person.email,password:person.password});for(const f of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert.ok(r.cookie.includes(f));});
test('me requires authentication',async()=>assert.equal((await call('me')).status,401));
test('me reads current member ignoring arbitrary query',async()=>{const r=await call('me?member_id=someone-else',undefined,{cookie});assert.equal(r.status,200);assert.equal(r.data.member.memberId,account.memberId);assert.ok(r.data.member.lastLoginAt);});
test('me never returns password hash admin notes or internal ID',async()=>{const r=await call('me',undefined,{cookie});for(const k of ['password','password_hash','admin_notes','id'])assert.ok(!Object.hasOwn(r.data.member,k));});
test('tampered cookie rejected',async()=>assert.equal((await call('me',undefined,{cookie:cookie+'altered'})).status,401));
test('logout invalidates old server session',async()=>{const r=await call('logout',{}, {cookie});assert.equal(r.status,200);assert.ok(r.cookie.includes('Max-Age=0'));assert.equal((await call('me',undefined,{cookie})).status,401);});
for(const [field,value] of [['suspended',true],['member_status','disabled']])test(`${field} account cannot login`,async()=>{
 await pool.query(`UPDATE lantian_members.members SET ${field}=$1 WHERE email=$2`,[value,person.email]);
 assert.equal((await call('login',{email:person.email,password:person.password})).status,403);
 await pool.query(`UPDATE lantian_members.members SET ${field}=$1 WHERE email=$2`,[field==='suspended'?false:'pending',person.email]);
});
test('status checked on existing session too',async()=>{
 const login=await call('login',{email:person.email,password:person.password});const c=login.cookie.split(';')[0];
 await pool.query('UPDATE lantian_members.members SET suspended=true WHERE email=$1',[person.email]);
 assert.equal((await call('me',undefined,{cookie:c})).status,401);
 await pool.query('UPDATE lantian_members.members SET suspended=false WHERE email=$1',[person.email]);assert.equal((await call('me',undefined,{cookie:c})).status,401);
});
test('CSRF origin rejected',async()=>assert.equal((await call('logout',{}, {headers:{Origin:'https://untrusted.invalid'}})).status,403));
test('mutations reject GET',async()=>assert.equal((await call('register')).status,405));
test('rate limit persists across requests',async()=>{let r;for(let i=0;i<11;i++)r=await call('login',{email:'limited@example.invalid',password:'short'},{ip:'same-rate-test'});assert.equal(r.status,429);});
test('business profile failure rolls back member',async()=>{
 const d={...fixture('business'),shopName:'x'.repeat(201),shopDisplayName:'UAT'};
 assert.equal((await call('register',d)).status,503);assert.equal((await pool.query('SELECT id FROM lantian_members.members WHERE email=$1',[d.email])).rows.length,0);
});
test('application migration repeatable',async()=>assert.equal(await migrateApplication(await pool.connect()),'ALREADY_APPLIED'));
test('expired session rejected',async()=>{
 const login=await call('login',{email:person.email,password:person.password});const c=login.cookie.split(';')[0];
 await pool.query("UPDATE lantian_members.sessions SET expire=now()-interval '1 day'");assert.equal((await call('me',undefined,{cookie:c})).status,401);
});


test('minimal individual defaults display name and preserves omitted optional fields',async()=>{
 const d=fixture('individual'),r=await call('register',d);assert.equal(r.status,201);assert.equal(r.data.member.displayName,d.name);
 const row=(await pool.query('SELECT registration_profile FROM lantian_members.members WHERE email=$1',[d.email])).rows[0];
 for(const key of ['residenceArea','birthMonth','gender','preferredContact'])assert.equal(row.registration_profile[key],'');
});
for(const type of ['individual','business']){
 for(const key of ['name','mobile','email','password','termsAccepted','privacyAccepted',...(type==='business'?['shopName']:[])])test(`${type} missing ${key} rejected`,async()=>{
  const d=fixture(type);delete d[key];assert.equal((await call('register',d)).status,400);
 });
}
test('client cannot classify or bind shop',async()=>{const r=await call('register',{...fixture('business'),shopIdentity:'existing',shopBound:true,shopId:'client'});assert.equal(r.status,201);assert.equal(r.data.member.shopIdentity,'application');assert.equal(r.data.member.shopBound,false);});
test('new business minimal registration pending unbound no public shop id',async()=>{
 const d={...fixture('business'),shopIdentity:'new'},r=await call('register',d);assert.equal(r.status,201);
 assert.equal(r.data.member.shopReviewStatus,'pending');assert.equal(r.data.member.shopBound,false);
 const b=(await pool.query('SELECT shop_id FROM lantian_members.business_member_profiles WHERE member_fk=(SELECT id FROM lantian_members.members WHERE email=$1)',[d.email])).rows[0];assert.equal(b.shop_id,null);
});
test('unclassified application does not create binding claim',async()=>{
 const d=fixture('business'),r=await call('register',d);assert.equal(r.status,201);
 const row=(await pool.query('SELECT registration_profile FROM lantian_members.members WHERE email=$1',[d.email])).rows[0];
 assert.equal(row.registration_profile.existingShopName,'');assert.equal(row.registration_profile.existingShopId,'');
});
test('previous full-profile account can login me logout without losing profile',async()=>{
 const d=fixture('individual');d.displayName='Existing nickname';d.residenceArea='Existing area';d.birthMonth='2000-01';d.gender='不提供';
 const hash=await require('bcryptjs').hash(d.password,12);
 await require('../lib/members-repository.cjs').repository(await pool.connect()).createMember(d,{passwordHash:hash});
 const before=(await pool.query('SELECT display_name,registration_profile,password_hash FROM lantian_members.members WHERE email=$1',[d.email])).rows[0];
 const login=await call('login',{email:d.email,password:d.password});assert.equal(login.status,200);const c=login.cookie.split(';')[0];
 const me=await call('me',undefined,{cookie:c});assert.equal(me.status,200);assert.equal(me.data.member.displayName,d.displayName);
 assert.equal((await call('logout',{}, {cookie:c})).status,200);assert.equal((await call('me',undefined,{cookie:c})).status,401);
 assert.deepEqual((await pool.query('SELECT display_name,registration_profile,password_hash FROM lantian_members.members WHERE email=$1',[d.email])).rows[0],before);
});

test('activity is POST with trusted origin only',async()=>{
 await pool.query('DELETE FROM lantian_members.rate_limits'); // Isolated test DB; keep new session tests independent of the earlier rate-limit scenario.
 assert.equal((await call('activity')).status,405);
 assert.equal((await call('activity',{}, {headers:{Origin:'https://untrusted.invalid'}})).status,403);
 assert.equal((await call('activity',{})).status,401);
});
test('login has 30 minute cookie and activity extends idle but not absolute expiry',async()=>{
 const r=await call('login',{email:person.email,password:person.password}),c=r.cookie.split(';')[0];assert.equal(r.status,200);const expiry=new Date(r.cookie.match(/Expires=([^;]+)/)[1]).getTime();assert.ok(Math.abs(expiry-Date.now()-1800000)<2000);
 assert.ok(r.data.idleExpiresAt>Date.now());const absolute=r.data.sessionExpiresAt;
 const active=await call('activity',{}, {cookie:c});assert.equal(active.status,200);assert.ok(active.data.idleExpiresAt>=r.data.idleExpiresAt);assert.equal(active.data.sessionExpiresAt,absolute);
});
test('background me does not advance idle deadline',async()=>{
 const r=await call('login',{email:person.email,password:person.password}),c=r.cookie.split(';')[0];
 const me=await call('me',undefined,{cookie:c});assert.equal(me.data.idleExpiresAt,r.data.idleExpiresAt);
});
for(const field of ['lastActivityAt','createdAt'])test(`${field} expiry destroys persisted session and cannot be revived by activity`,async()=>{
 const r=await call('login',{email:person.email,password:person.password}),c=r.cookie.split(';')[0];
 const id=(await pool.query('SELECT id FROM lantian_members.members WHERE email=$1',[person.email])).rows[0].id;
 await pool.query(`UPDATE lantian_members.sessions SET sess=jsonb_set(sess::jsonb,$1::text[],$2::jsonb)::json WHERE sess->>'memberId'=$3`,[[field],JSON.stringify(Date.now()-(field==='createdAt'?604800000:1800000)),id]);
 const me=await call('me',undefined,{cookie:c});assert.equal(me.status,401);assert.equal(me.data.code,'SESSION_EXPIRED');assert.ok(me.cookie.includes('Max-Age=0'));
 assert.equal((await call('activity',{}, {cookie:c})).status,401);
});
test('legacy session without server timestamps requires fresh login',async()=>{
 const r=await call('login',{email:person.email,password:person.password}),c=r.cookie.split(';')[0];
 const id=(await pool.query('SELECT id FROM lantian_members.members WHERE email=$1',[person.email])).rows[0].id;
 await pool.query("UPDATE lantian_members.sessions SET sess=(sess::jsonb-'createdAt'-'lastActivityAt')::json WHERE sess->>'memberId'=$1",[id]);
 assert.equal((await call('me',undefined,{cookie:c})).status,401);
});
