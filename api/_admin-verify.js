const crypto = require('crypto');

async function verifyAdminToken(idToken) {
  if (!idToken) return { status: 400, body: { ok: false, code: 'MISSING_ID_TOKEN' } };
  let response;
  try {
    response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: '2011802000' })
    });
  } catch {
    return { status: 502, body: { ok: false, code: 'LINE_VERIFY_UNREACHABLE' } };
  }
  let verified;
  try { verified = await response.json(); }
  catch { return { status: 502, body: { ok: false, code: 'LINE_VERIFY_BAD_RESPONSE' } }; }
  if (!response.ok || !verified?.sub)
    return { status: 401, body: { ok: false, code: 'INVALID_LINE_ID_TOKEN' } };
  const subjectHash = crypto.createHash('sha256').update(String(verified.sub)).digest('hex');
  const admins = String(process.env.ADMIN_LINE_USER_HASHES || '')
    .split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  if (!admins.length)
    return { status: 503, body: { ok: false, code: 'ADMIN_LIST_NOT_CONFIGURED', bootstrapHash: subjectHash } };
  if (!admins.includes(subjectHash))
    return { status: 403, body: { ok: false, code: 'NOT_AUTHORIZED' } };
  return { status: 200, body: { ok: true, user: {
    name: verified.name || '', picture: verified.picture || ''
  } } };
}
module.exports = { verifyAdminToken };
