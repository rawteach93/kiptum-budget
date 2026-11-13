import { get, head, put, list, del, BlobPreconditionFailedError, BlobNotFoundError } from '@vercel/blob';

export const DB_PATH = 'db/budget.json';
export const COLLECTIONS = ['categories', 'transactions', 'bills', 'balances'];

const PALETTE = ['#34D399', '#FBBF24', '#22D3EE', '#A78BFA', '#FB7185', '#60A5FA', '#F472B6', '#A3E635', '#FB923C', '#2DD4BF'];

const DEFAULT_EXPENSE = [
  ['rent', 'Rent', true], ['electricity', 'Electricity (Tokens)', true], ['water', 'Water Bill', true],
  ['internet', 'Internet', true], ['cooking_gas', 'Cooking Gas', true], ['school_fees', 'School Fees', true],
  ['loan_repayment', 'Loan Repayment', true], ['insurance', 'Insurance', true], ['car_fuel', 'Car Fuel', false],
  ['car_service', 'Car Service & Maintenance', false], ['groceries', 'Groceries & Food', false],
  ['health', 'Hospital & Health', false], ['kids_treats', 'Kids & Treats', false],
  ['entertainment', 'Entertainment', false], ['subscriptions', 'Subscriptions', false],
  ['airtime_data', 'Airtime & Data', false], ['personal_care', 'Personal Care', false],
  ['clothing', 'Clothing', false], ['giving', 'Church & Giving', false], ['household_misc', 'Household & Misc', false],
];
const DEFAULT_INCOME = [
  ['graphic_design', 'Graphic Design'], ['photography', 'Photography'], ['video_production', 'Video Production'],
  ['web_design', 'Web Design'], ['digital_marketing', 'Digital Marketing'], ['alisend', 'Alisend Errands'],
  ['sportfans_tv', 'SportFans TV'], ['raw_teach', 'Raw Teach'], ['freelance_other', 'Other Freelance'],
  ['gifts', 'Gifts & Other'],
];

export function emptyDb() {
  let i = 0;
  const categories = [];
  DEFAULT_EXPENSE.forEach(([id, name, essential]) =>
    categories.push({ id, name, kind: 'expense', essential, color: PALETTE[i++ % PALETTE.length], custom: false }));
  DEFAULT_INCOME.forEach(([id, name]) =>
    categories.push({ id, name, kind: 'income', essential: false, color: PALETTE[i++ % PALETTE.length], custom: false }));
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    categories,
    transactions: [],
    bills: [],
    balances: [],
    settings: {},
  };
}

async function streamToText(stream) {
  return await new Response(stream).text();
}

export async function readDb() {
  // The etag must come from head(): get() returns the CDN's etag header, which
  // put({ ifMatch }) does not accept. Reading head first, then the content,
  // means a write in between only makes our ifMatch fail and retry (safe).
  let meta = null;
  try { meta = await head(DB_PATH); } catch (e) { if (!(e instanceof BlobNotFoundError)) throw e; }
  if (!meta) return { db: emptyDb(), etag: null };
  const r = await get(DB_PATH, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return { db: emptyDb(), etag: null };
  const text = await streamToText(r.stream);
  const db = JSON.parse(text);
  COLLECTIONS.forEach((c) => { if (!Array.isArray(db[c])) db[c] = []; });
  if (!db.settings) db.settings = {};
  return { db, etag: meta.etag };
}

async function writeDb(db, etag) {
  const opts = {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: !!etag, // first-ever write must not clobber a concurrent first write
    cacheControlMaxAge: 60,
  };
  if (etag) opts.ifMatch = etag;
  return put(DB_PATH, JSON.stringify(db), opts);
}

/** Read-modify-write with optimistic concurrency (two phones writing at once is safe). */
export async function mutate(fn) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { db, etag } = await readDb();
    const result = fn(db);
    db.version = (db.version || 0) + 1;
    db.updatedAt = new Date().toISOString();
    try {
      await writeDb(db, etag);
      return { db, result };
    } catch (e) {
      const conflict = e instanceof BlobPreconditionFailedError || /precondition|etag|already exists/i.test(String(e && e.message));
      if (!conflict) throw e;
      await new Promise((r) => setTimeout(r, 80 + Math.random() * 200));
    }
  }
  throw new Error('Too many simultaneous saves, please retry');
}

/* ---------------- operations ---------------- */

const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));
const str = (v, max = 300) => (v === null || v === undefined ? null : String(v).slice(0, max));

function clean(coll, o) {
  if (coll === 'transactions') return {
    id: str(o.id, 80), kind: o.kind === 'income' ? 'income' : 'expense', categoryId: str(o.categoryId, 80),
    categoryName: str(o.categoryName, 120), categoryColor: str(o.categoryColor, 20), amount: num(o.amount) || 0,
    date: str(o.date, 10), note: str(o.note, 500), recurring: !!o.recurring, addedByName: str(o.addedByName, 60),
    balanceId: str(o.balanceId, 80), createdAt: o.createdAt || new Date().toISOString(),
  };
  if (coll === 'categories') return {
    id: str(o.id, 80), name: str(o.name, 120), kind: o.kind === 'income' ? 'income' : 'expense',
    essential: !!o.essential, color: str(o.color, 20) || '#94A3B8', custom: !!o.custom,
  };
  if (coll === 'bills') return {
    id: str(o.id, 80), categoryId: str(o.categoryId, 80), categoryName: str(o.categoryName, 120),
    expectedAmount: num(o.expectedAmount), dueDay: num(o.dueDay), billType: o.billType === 'variable' ? 'variable' : 'fixed',
  };
  if (coll === 'balances') return {
    id: str(o.id, 80), name: str(o.name, 160), categoryId: str(o.categoryId, 80), totalAmount: num(o.totalAmount),
    balanceRemaining: num(o.balanceRemaining), status: str(o.status, 20) || 'current', dueDate: str(o.dueDate, 10),
    installmentAmount: num(o.installmentAmount), notes: str(o.notes, 1000),
  };
  return o;
}

function rid(p) { return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

export function applyOps(db, ops) {
  for (const op of ops || []) {
    if (op.op === 'setting') {
      if (typeof op.key === 'string' && op.key.length < 60) db.settings[op.key] = op.value;
      continue;
    }
    if (op.op === 'import') { importInto(db, op.data, op.mode); continue; }
    if (!COLLECTIONS.includes(op.coll)) continue;
    const arr = db[op.coll];
    if (op.op === 'add') {
      const item = clean(op.coll, { ...op.item, id: op.item?.id || rid(op.coll.slice(0, 3)) });
      const i = arr.findIndex((x) => x.id === item.id);
      if (i >= 0) arr[i] = item; else arr.push(item);
    } else if (op.op === 'update') {
      const i = arr.findIndex((x) => x.id === op.id);
      if (i >= 0) arr[i] = clean(op.coll, { ...arr[i], ...op.patch, id: op.id });
    } else if (op.op === 'remove') {
      db[op.coll] = arr.filter((x) => x.id !== op.id);
    }
  }
}

/* Accepts: a full backup from this app, or the old Supabase tables (snake_case rows),
   either as { transactions:[...], bills:[...], ... } */
const snake = {
  transactions: (r) => ({
    id: r.id, kind: r.kind, categoryId: r.categoryId ?? r.category_id, categoryName: r.categoryName ?? r.category_name,
    categoryColor: r.categoryColor ?? r.category_color, amount: r.amount, date: r.date, note: r.note,
    recurring: r.recurring === true || r.recurring === 'true', addedByName: r.addedByName ?? r.added_by_name,
    createdAt: r.createdAt ?? r.created_at,
  }),
  categories: (r) => ({ id: r.id, name: r.name, kind: r.kind, essential: r.essential === true || r.essential === 'true', color: r.color, custom: r.custom === true || r.custom === 'true' }),
  bills: (r) => ({ id: r.id, categoryId: r.categoryId ?? r.category_id, categoryName: r.categoryName ?? r.category_name, expectedAmount: r.expectedAmount ?? r.expected_amount, dueDay: r.dueDay ?? r.due_day, billType: r.billType ?? r.bill_type }),
  balances: (r) => ({ id: r.id, name: r.name, categoryId: r.categoryId ?? r.category_id, totalAmount: r.totalAmount ?? r.total_amount, balanceRemaining: r.balanceRemaining ?? r.balance_remaining, status: r.status, dueDate: r.dueDate ?? r.due_date, installmentAmount: r.installmentAmount ?? r.installment_amount, notes: r.notes }),
};

function importInto(db, data, mode) {
  if (!data || typeof data !== 'object') return;
  for (const c of COLLECTIONS) {
    if (!Array.isArray(data[c])) continue;
    const rows = data[c].filter((r) => r && r.id).map((r) => clean(c, snake[c](r)));
    if (mode === 'replace') { db[c] = rows; continue; }
    const byId = new Map(db[c].map((x) => [x.id, x]));
    rows.forEach((r) => byId.set(r.id, r));
    db[c] = [...byId.values()];
  }
  if (data.settings && typeof data.settings === 'object') Object.assign(db.settings, data.settings);
}

/* ---------------- backups ---------------- */
export async function snapshot(label) {
  const { db } = await readDb();
  const day = new Date().toISOString().slice(0, 10);
  const path = `backups/${day}${label ? '-' + label : ''}.json`;
  await put(path, JSON.stringify(db), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
  // keep ~60 daily backups
  const { blobs } = await list({ prefix: 'backups/', limit: 1000 });
  const old = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).slice(60);
  if (old.length) await del(old.map((b) => b.url));
  return { path, count: Math.min(blobs.length, 60) };
}

export async function listBackups() {
  const { blobs } = await list({ prefix: 'backups/', limit: 1000 });
  return blobs.map((b) => ({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt }))
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

export async function readBackup(pathname) {
  if (!/^backups\/[\w.-]+\.json$/.test(pathname)) return null;
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await streamToText(r.stream));
}
