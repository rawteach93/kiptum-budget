import { readSession } from '../lib/auth.js';
import { snapshot, listBackups, readBackup } from '../lib/store.js';

// Daily cron (see vercel.json) + manual "Back up now" / restore list from Settings.
export default async function handler(req, res) {
  const cronOk = process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  let user = null;
  try { user = readSession(req); } catch { /* ignore */ }
  if (!cronOk && !user) return res.status(401).json({ error: 'locked' });
  try {
    if (req.method === 'GET' && user && req.query?.list) return res.status(200).json({ backups: await listBackups() });
    if (req.method === 'GET' && user && req.query?.file) {
      const data = await readBackup(String(req.query.file));
      if (!data) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ db: data });
    }
    const out = await snapshot(user && req.method === 'POST' ? 'manual' : '');
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
