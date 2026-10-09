const { verifyAdminToken } = require('./_admin-verify');

module.exports = async function handler(req, res) {
  const allowedOrigin='https://kao72302428.github.io';
  const origin=req.headers.origin||'';
  res.setHeader('Access-Control-Allow-Origin',origin===allowedOrigin?origin:allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Vary','Origin');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({ok:false,code:'METHOD_NOT_ALLOWED'});
  const result=await verifyAdminToken(String(req.body?.idToken||'').trim());
  return res.status(result.status).json(result.body);
};
