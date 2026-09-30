const crypto = require('crypto');

const REPO = 'kao72302428/lantian-live-map';
const FILE_PATH = 'news.json';
const BRANCH = 'main';
const LINE_CHANNEL_ID = '2011802000';
const ALLOWED_ORIGIN = 'https://kao72302428.github.io';

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

function ghHeaders(token) {
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
}

async function readNews(token) {
  const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;
  const r = await fetch(url, { headers: ghHeaders(token) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.content || !data.sha) throw new Error('READ_FAILED');
  const text = Buffer.from(String(data.content).replace(/\n/g, ''), 'base64').toString('utf8');
  const items = JSON.parse(text);
  if (!Array.isArray(items)) throw new Error('INVALID_NEWS_DATA');
  return { items, sha: data.sha };
}

async function writeNews(token, items, sha, message) {
  const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
  const body = {
    message,
    content: Buffer.from(JSON.stringify(items, null, 2) + '\n', 'utf8').toString('base64'),
    sha,
    branch: BRANCH
  };
  const r = await fetch(url, { method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || 'WRITE_FAILED');
  return data;
}

function cleanItem(raw, existingId, existingPublished) {
  const now = Date.now();
  const id = String(existingId || raw?.id || `news-${now}`).trim();
  return {
    id,
    date: String(raw?.date || '').trim(),
    title: String(raw?.title || '').trim(),
    summary: String(raw?.summary || '').trim(),
    content: String(raw?.content || '').trim(),
    image: String(raw?.image || '').trim(),
    map: String(raw?.map || '').trim(),
    link: String(raw?.link || '').trim(),
    linkText: String(raw?.linkText || '').trim(),
    published: typeof raw?.published === 'boolean' ? raw.published : (existingPublished !== false)
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });

  const idToken = String(req.body?.idToken || '').trim();
  if (!idToken) return res.status(400).json({ ok: false, code: 'MISSING_ID_TOKEN' });

  let verified;
  try { verified = await verifyAdmin(idToken); }
  catch { return res.status(502).json({ ok: false, code: 'LINE_VERIFY_FAILED' }); }
  if (!verified.ok) return res.status(403).json(verified);

  const token = String(process.env.GITHUB_CONTENT_TOKEN || '').trim();
  if (!token) return res.status(503).json({ ok: false, code: 'STORAGE_NOT_CONFIGURED' });

  const action = String(req.body?.action || '').trim();
  try {
    const { items, sha } = await readNews(token);

    if (action === 'list') {
      return res.status(200).json({ ok: true, items });
    }

    if (action === 'upsert') {
      const raw = req.body?.item || {};
      const current = items.find(x => String(x.id) === String(raw.id || ''));
      const incoming = cleanItem(raw, raw.id, current?.published);
      if (!incoming.date || !incoming.title || !incoming.summary || !incoming.content) {
        return res.status(400).json({ ok: false, code: 'REQUIRED_FIELDS_MISSING' });
      }
      const index = items.findIndex(x => String(x.id) === incoming.id);
      if (index >= 0) items[index] = incoming;
      else items.push(incoming);
      items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      await writeNews(token, items, sha, `Admin ${index >= 0 ? 'update' : 'publish'} news: ${incoming.title}`);
      return res.status(200).json({ ok: true, items, item: incoming });
    }

    if (action === 'setPublished') {
      const id = String(req.body?.id || '').trim();
      const published = !!req.body?.published;
      const index = items.findIndex(x => String(x.id) === id);
      if (index < 0) return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
      items[index] = { ...items[index], published };
      await writeNews(token, items, sha, `Admin ${published ? 'publish' : 'unpublish'} news: ${id}`);
      return res.status(200).json({ ok: true, items, item: items[index] });
    }

    if (action === 'delete') {
      const id = String(req.body?.id || '').trim();
      if (!id) return res.status(400).json({ ok: false, code: 'MISSING_ID' });
      const next = items.filter(x => String(x.id) !== id);
      if (next.length === items.length) return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
      await writeNews(token, next, sha, `Admin delete news: ${id}`);
      return res.status(200).json({ ok: true, items: next });
    }

    return res.status(400).json({ ok: false, code: 'UNKNOWN_ACTION' });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ ok: false, code: 'GITHUB_WRITE_FAILED' });
  }
};
