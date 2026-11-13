import { checkPin, makeToken, setSessionCookie, clearSessionCookie, readSession, readJson } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    let s = null;
    try { s = readSession(req); } catch { /* missing secret */ }
    return res.status(200).json({ authed: !!s, configured: !!process.env.APP_PIN && !!process.env.SESSION_SECRET });
  }
  if (req.method === 'POST') {
    const body = await readJson(req);
    if (!checkPin(body.pin)) {
      await new Promise((r) => setTimeout(r, 900)); // slow down guessing
      return res.status(401).json({ error: 'Wrong passcode' });
    }
    setSessionCookie(res, makeToken(body.name));
    return res.status(200).json({ authed: true });
  }
  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(200).json({ authed: false });
  }
  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).end();
}
