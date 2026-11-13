import { requireAuth, readJson } from '../lib/auth.js';
import { readDb, mutate, applyOps } from '../lib/store.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    if (req.method === 'GET') {
      const { db } = await readDb();
      const since = Number(req.query?.since || 0);
      if (since && since === db.version) return res.status(200).json({ unchanged: true, version: db.version });
      return res.status(200).json({ db });
    }
    if (req.method === 'POST') {
      const body = await readJson(req);
      if (!Array.isArray(body.ops) || body.ops.length > 2000) return res.status(400).json({ error: 'Bad request' });
      const { db } = await mutate((d) => applyOps(d, body.ops));
      return res.status(200).json({ db });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
