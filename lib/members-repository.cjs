'use strict';
// Internal server repository. No HTTP route, authentication, or public registration.
const SAFE = 'id, member_id, member_type, name, display_name, mobile, email, member_status, registered_at, last_login_at, email_verified, mobile_verified, suspended, updated_at, is_test, registration_profile';
const OPTIONAL = ['residenceArea','birthMonth','gender','preferredContact','notificationsAccepted','termsAccepted','privacyAccepted','jobTitle','lineContact','shopDisplayName','shopCategory','shopSubcategory','shopPhone','shopAddress','businessArea','shopDescription','mapsUrl','website','facebook','instagram','officialLine','businessHours','businessNotificationsAccepted','existingShopId','existingShopName'];
function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('INVALID_EMAIL');
  return email;
}
function prepare(input, trusted) {
  if (!['individual','business'].includes(input.memberType)) throw new Error('INVALID_MEMBER_TYPE');
  const name = String(input.name || '').trim(), displayName = String(input.displayName || '').trim();
  if (!name || !displayName || name.length > 120 || displayName.length > 120 || !input.mobile) throw new Error('REQUIRED_FIELDS');
  if (input.memberType === 'business' && (!input.shopName || !['existing','new','application'].includes(input.shopIdentity))) throw new Error('INVALID_BUSINESS_PROFILE');
  const profile = {};
  for (const key of OPTIONAL) if (Object.hasOwn(input,key)) {
    if (!['string','boolean'].includes(typeof input[key])) throw new Error('INVALID_PROFILE_FIELD');
    profile[key] = input[key];
  }
  const hash = trusted.passwordHash ?? null;
  if (hash !== null && !(trusted.isTest === true && hash === 'TEST-ONLY-NOT-AUTHENTICATION') &&
      !/^\$(argon2id|argon2i|scrypt)\$/.test(hash) && !/^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$/.test(hash) && !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash)) throw new Error('HASH_REQUIRED');
  return [input.memberType,name,displayName,String(input.mobile),normalizeEmail(input.email),hash,trusted.isTest === true,JSON.stringify(profile)];
}
function repository(client) {
  return {
    async createMember(input, trusted = {}) {
      const values = prepare(input,trusted);
      await client.query('BEGIN');
      try {
        const {rows:[row]} = await client.query(`INSERT INTO lantian_members.members
          (member_type,name,display_name,mobile,email,password_hash,is_test,registration_profile,member_status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${SAFE}`,[...values,trusted.memberStatus==='active'?'active':'pending']);
        if (input.memberType === 'business') await client.query(`INSERT INTO lantian_members.business_member_profiles
          (member_fk,shop_name,shop_identity) VALUES ($1,$2,$3)`,[row.id,input.shopName,input.shopIdentity]);
        await client.query('COMMIT');
        return row;
      } catch(e) {
        await client.query('ROLLBACK');
        throw new Error(e.code === '23505' ? 'MEMBER_CONFLICT' : 'MEMBER_WRITE_FAILED');
      }
    },
    async getMemberByEmail(email) {
      try {return (await client.query(`SELECT ${SAFE} FROM lantian_members.members WHERE lower(email)=$1`,[normalizeEmail(email)])).rows[0] || null;}
      catch {throw new Error('MEMBER_READ_FAILED');}
    },
    async getMemberByMemberId(id) {
      try {return (await client.query(`SELECT ${SAFE} FROM lantian_members.members WHERE member_id=$1`,[id])).rows[0] || null;}
      catch {throw new Error('MEMBER_READ_FAILED');}
    }
  };
}
module.exports = {repository,normalizeEmail,prepare};

