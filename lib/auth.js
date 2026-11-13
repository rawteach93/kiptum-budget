import crypto from 'node:crypto';

const COOKIE = 'kb_session';
const MAX_AGE_DAYS = 120;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET is not set');
  return s;
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function makeToken(name) {
  const payload = Buffer.from(JSON.stringify({
    exp: Date.now() + MAX_AGE_DAYS * 86400000,
    n: crypto.randomBytes(6).toString('hex'),
    who: name || null,
  })).toString('base64url');
  return payload + '.' + sign(payload);
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

export function readSession(req) {
  const tok = parseCookies(req)[COOKIE];
  if (!tok || !tok.includes('.')) return null;
  const [payload, sig] = tok.split('.');
  const expected = sign(payload);
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE_DAYS * 86400}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

export function checkPin(pin) {
  const real = process.env.APP_PIN || '';
  if (!real) return false;
  const a = crypto.createHash('sha256').update(String(pin || '')).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export function requireAuth(req, res) {
  let s = null;
  try { s = readSession(req); } catch (e) {
    res.status(500).json({ error: 'Server is missing SESSION_SECRET' });
    return null;
  }
  if (!s) { res.status(401).json({ error: 'locked' }); return null; }
  return s;
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
}
