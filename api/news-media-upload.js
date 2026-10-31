const crypto = require('crypto');

const LINE_CHANNEL_ID = '2011802000';
const ALLOWED_ORIGIN = 'https://kao72302428.github.io';
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 20 * 1024 * 1024;

function setCors(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');
}

async function verifyAdmin(idToken) {
  const form = new URLSearchParams({ id_token: idToken, client_id: LINE_CHANNEL_ID });
  const lineResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const verified = await lineResponse.json().catch(() => ({}));
  if (!lineResponse.ok || !verified?.sub) return { ok: false, code: 'INVALID_LINE_ID_TOKEN' };

  const subjectHash = crypto.createHash('sha256').update(String(verified.sub)).digest('hex');
  const admins = String(process.env.ADMIN_LINE_USER_HASHES || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);

  if (!admins.includes(subjectHash)) return { ok: false, code: 'NOT_AUTHORIZED' };
  return { ok: true, user: verified };
}

function mediaRules(pathname) {
  const path = String(pathname || '');
  if (path.startsWith('news-images/')) {
    return {
      kind: 'image',
      allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maximumSizeInBytes: IMAGE_MAX_BYTES
    };
  }
  if (path.startsWith('news-videos/')) {
    return {
      kind: 'video',
      allowedContentTypes: ['video/mp4', 'video/webm'],
      maximumSizeInBytes: VIDEO_MAX_BYTES
    };
  }
  throw new Error('INVALID_MEDIA_PATH');
}

function parseAdminPayload(clientPayload) {
  let parsed = {};
  try { parsed = JSON.parse(String(clientPayload || '{}')); }
  catch { throw new Error('INVALID_CLIENT_PAYLOAD'); }
  const idToken = String(parsed.idToken || '').trim();
  if (!idToken) throw new Error('MISSING_ID_TOKEN');
  return { idToken };
}

async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });

  try {
    const { handleUpload } = await import('@vercel/blob/client');
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { idToken } = parseAdminPayload(clientPayload);
        const verified = await verifyAdmin(idToken);
        if (!verified.ok) {
          const err = new Error(verified.code || 'NOT_AUTHORIZED');
          err.code = verified.code || 'NOT_AUTHORIZED';
          throw err;
        }
        const rules = mediaRules(pathname);
        return {
          allowedContentTypes: rules.allowedContentTypes,
          maximumSizeInBytes: rules.maximumSizeInBytes,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ kind: rules.kind })
        };
      },
      onUploadCompleted: async () => {}
    });
    return res.status(200).json(jsonResponse);
  } catch (err) {
    const code = err?.code || err?.message || 'MEDIA_UPLOAD_FAILED';
    const status = ['NOT_AUTHORIZED','INVALID_LINE_ID_TOKEN'].includes(code) ? 403 : 400;
    return res.status(status).json({ ok: false, code });
  }
}

module.exports = handler;
module.exports._test = {
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  mediaRules,
  parseAdminPayload
};
