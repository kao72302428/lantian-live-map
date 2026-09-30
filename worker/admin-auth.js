const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';
const LINE_CHANNEL_ID = '2011802000';
const ALLOWED_ORIGIN = 'https://kao72302428.github.io';

function cors(origin) {
  const allow = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: cors(origin) });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, code: 'INVALID_JSON' }, 400, origin);
    }

    const idToken = String(payload?.idToken || '').trim();
    if (!idToken) {
      return json({ ok: false, code: 'MISSING_ID_TOKEN' }, 400, origin);
    }

    const form = new URLSearchParams({
      id_token: idToken,
      client_id: LINE_CHANNEL_ID
    });

    let verifyResponse;
    try {
      verifyResponse = await fetch(LINE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form
      });
    } catch {
      return json({ ok: false, code: 'LINE_VERIFY_UNREACHABLE' }, 502, origin);
    }

    let verified;
    try {
      verified = await verifyResponse.json();
    } catch {
      return json({ ok: false, code: 'LINE_VERIFY_BAD_RESPONSE' }, 502, origin);
    }

    if (!verifyResponse.ok || !verified?.sub) {
      return json({ ok: false, code: 'INVALID_LINE_ID_TOKEN' }, 401, origin);
    }

    const admins = String(env.ADMIN_LINE_USER_IDS || '')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);

    if (!admins.length) {
      return json({
        ok: false,
        code: 'ADMIN_LIST_NOT_CONFIGURED',
        verifiedUserId: verified.sub
      }, 503, origin);
    }

    if (!admins.includes(verified.sub)) {
      return json({ ok: false, code: 'NOT_AUTHORIZED' }, 403, origin);
    }

    return json({
      ok: true,
      user: {
        id: verified.sub,
        name: verified.name || '',
        picture: verified.picture || ''
      }
    }, 200, origin);
  }
};
