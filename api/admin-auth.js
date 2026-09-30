module.exports = async function handler(req, res) {
  const allowedOrigin = 'https://kao72302428.github.io';
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', origin === allowedOrigin ? origin : allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });

  const idToken = String(req.body?.idToken || '').trim();
  if (!idToken) return res.status(400).json({ ok: false, code: 'MISSING_ID_TOKEN' });

  const form = new URLSearchParams({
    id_token: idToken,
    client_id: '2011802000'
  });

  let lineResponse;
  try {
    lineResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });
  } catch {
    return res.status(502).json({ ok: false, code: 'LINE_VERIFY_UNREACHABLE' });
  }

  let verified;
  try {
    verified = await lineResponse.json();
  } catch {
    return res.status(502).json({ ok: false, code: 'LINE_VERIFY_BAD_RESPONSE' });
  }

  if (!lineResponse.ok || !verified?.sub) {
    return res.status(401).json({ ok: false, code: 'INVALID_LINE_ID_TOKEN' });
  }

  const admins = String(process.env.ADMIN_LINE_USER_IDS || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

  if (!admins.length) {
    return res.status(503).json({
      ok: false,
      code: 'ADMIN_LIST_NOT_CONFIGURED',
      verifiedUserId: verified.sub
    });
  }

  if (!admins.includes(verified.sub)) {
    return res.status(403).json({ ok: false, code: 'NOT_AUTHORIZED' });
  }

  return res.status(200).json({
    ok: true,
    user: {
      id: verified.sub,
      name: verified.name || '',
      picture: verified.picture || ''
    }
  });
};
