/* Kiptum Household Budget — v2 (Vercel + Blob, glass UI) */
(function () {
  'use strict';

  /* ================= constants ================= */
  var PALETTE = ['#34D399', '#FBBF24', '#22D3EE', '#A78BFA', '#FB7185', '#60A5FA', '#F472B6', '#A3E635', '#FB923C', '#2DD4BF', '#E879F9', '#FACC15'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var LS = { cache: 'kb_cache', queue: 'kb_queue', me: 'kb_me', theme: 'kb_theme', seen: 'kb_seen_', notified: 'kb_notified_' };
  var I = {
    home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    activity: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    bills: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>',
    loans: '<path d="M3 10l9-6 9 6M5 10v9M19 10v9M9 10v9M15 10v9M3 21h18"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  };
  var NAV = [
    { id: 'home', label: 'Overview', short: 'Home' },
    { id: 'activity', label: 'Activity', short: 'Activity' },
    { id: 'bills', label: 'Bills', short: 'Bills' },
    { id: 'loans', label: 'Loans & balances', short: 'Loans' },
    { id: 'settings', label: 'Settings', short: 'Settings' },
  ];

  /* ================= state ================= */
  var db = null;
  var queue = loadJSON(LS.queue, []);
  var view = 'home';
  var now = new Date();
  var month = { y: now.getFullYear(), m: now.getMonth() };
  var act = { q: '', kind: 'all', month: monthKey(now.getFullYear(), now.getMonth()) };
  var me = localStorage.getItem(LS.me) || null;
  var charts = {};
  var pollTimer = null;
  var flushing = false;

  /* ================= utils ================= */
  function $(id) { return document.getElementById(id); }
  function loadJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n, compact) {
    n = Math.round(n || 0);
    if (compact && Math.abs(n) >= 100000) return 'KSh ' + (n / 1000).toFixed(Math.abs(n) >= 1e6 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return (n < 0 ? '−' : '') + 'KSh ' + Math.abs(n).toLocaleString('en-US');
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function monthKey(y, m) { return y + '-' + pad(m + 1); }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function fmtDate(iso) { if (!iso) return ''; var d = new Date(iso + 'T00:00:00'); return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear(); }
  function dayLabel(iso) {
    var t = todayISO(); var y = new Date(); y.setDate(y.getDate() - 1);
    var yI = y.getFullYear() + '-' + pad(y.getMonth() + 1) + '-' + pad(y.getDate());
    if (iso === t) return 'Today'; if (iso === yI) return 'Yesterday';
    var d = new Date(iso + 'T00:00:00');
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ', ' + fmtDate(iso);
  }
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function uid(p) { return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function avg(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : 0; }
  function sum(a, f) { return a.reduce(function (s, x) { return s + (f ? f(x) : x); }, 0); }
  function svg(name) { return '<svg viewBox="0 0 24 24">' + I[name] + '</svg>'; }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function initials(s) { return (s || '?').replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || '•'; }
  function hexA(hex, a) { var h = (hex || '#888888').replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }

  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2400); }
  function setSync(stateName, txt) {
    ['sync-pill', 'sync-pill-side'].forEach(function (id) {
      var el = $(id); if (!el) return;
      el.className = 'sync-pill' + (id === 'sync-pill' ? ' mobile-only' : '') + (stateName ? ' ' + stateName : '');
      el.querySelector('.txt').textContent = txt;
    });
  }

  /* ================= data access ================= */
  function cats(kind) { return (db.categories || []).filter(function (c) { return !kind || c.kind === kind; }).sort(function (a, b) { return a.name.localeCompare(b.name); }); }
  function catById(id) { return (db.categories || []).find(function (c) { return c.id === id; }) || null; }
  function txs() { return db.transactions || []; }
  function monthTx(y, m) { var k = monthKey(y, m); return txs().filter(function (t) { return (t.date || '').slice(0, 7) === k; }); }
  function totals(list) {
    return { inc: sum(list.filter(function (t) { return t.kind === 'income'; }), function (t) { return t.amount; }),
             exp: sum(list.filter(function (t) { return t.kind === 'expense'; }), function (t) { return t.amount; }) };
  }
  function sortTx(a) { return a.slice().sort(function (x, y) { return (y.date || '').localeCompare(x.date || '') || String(y.createdAt || '').localeCompare(String(x.createdAt || '')); }); }

  /* ================= network ================= */
  function api(path, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    return fetch(path, opts).then(function (r) {
      if (r.status === 401) { showLock(); throw new Error('locked'); }
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; });
    });
  }

  function applyLocal(ops) {
    ops.forEach(function (op) {
      if (op.op === 'setting') { db.settings = db.settings || {}; db.settings[op.key] = op.value; return; }
      if (op.op === 'import') return;
      var arr = db[op.coll]; if (!arr) return;
      if (op.op === 'add') { var i = arr.findIndex(function (x) { return x.id === op.item.id; }); if (i >= 0) arr[i] = op.item; else arr.push(op.item); }
      else if (op.op === 'update') { var j = arr.findIndex(function (x) { return x.id === op.id; }); if (j >= 0) arr[j] = Object.assign({}, arr[j], op.patch); }
      else if (op.op === 'remove') { db[op.coll] = arr.filter(function (x) { return x.id !== op.id; }); }
    });
  }

  function commit(ops) {
    applyLocal(ops);
    queue = queue.concat(ops);
    saveJSON(LS.queue, queue);
    saveJSON(LS.cache, db);
    render();
    return flush();
  }

  function flush() {
    if (flushing || !queue.length) return Promise.resolve();
    flushing = true;
    var batch = queue.slice();
    setSync('busy', 'Saving…');
    return api('/api/data', { method: 'POST', body: JSON.stringify({ ops: batch }) }).then(function (j) {
      queue = queue.slice(batch.length);
      saveJSON(LS.queue, queue);
      if (!queue.length) { db = j.db; saveJSON(LS.cache, db); render(); }
      setSync('', 'Synced');
    }).catch(function (e) {
      if (e.message !== 'locked') setSync('off', 'Offline – will retry');
    }).then(function () {
      flushing = false;
      if (queue.length) setTimeout(flush, 8000);
    });
  }

  function pull(force) {
    if (queue.length) return flush();
    var v = db && !force ? db.version : 0;
    return api('/api/data' + (v ? '?since=' + v : '')).then(function (j) {
      if (j.unchanged) { setSync('', 'Synced'); return; }
      var prev = db;
      db = j.db; saveJSON(LS.cache, db);
      notifyPartnerEntries(prev, db);
      render();
      setSync('', 'Synced');
      checkDueReminders();
    }).catch(function (e) { if (e.message !== 'locked') setSync('off', 'Offline'); });
  }

  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(function () { if (!document.hidden) pull(); }, 15000);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && db) pull(); });
  window.addEventListener('online', function () { if (db) flush(); });

  /* ================= lock ================= */
  function showLock() {
    clearInterval(pollTimer);
    $('app').hidden = true; $('lock').hidden = false;
    setTimeout(function () { $('pin').focus(); }, 100);
  }
  $('lock-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('unlock-btn'); btn.disabled = true; btn.textContent = 'Unlocking…'; $('lock-err').textContent = '';
    fetch('/api/auth', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: $('pin').value, name: me }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.error || 'Wrong passcode');
        $('pin').value = '';
        return enterApp();
      })
      .catch(function (err) {
        $('lock-err').textContent = err.message;
        var c = document.querySelector('.lock-card'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
      })
      .then(function () { btn.disabled = false; btn.textContent = 'Unlock'; });
  });

  function enterApp() {
    $('lock').hidden = true; $('app').hidden = false;
    var cached = loadJSON(LS.cache, null);
    if (cached && !db) { db = cached; render(); }
    return pull(true).then(function () {
      flush();
      startPolling();
      if (!me) setTimeout(askWho, 600);
    });
  }

  /* ================= navigation ================= */
  function buildNav() {
    $('side-nav').innerHTML = NAV.map(function (n) { return '<button data-go="' + n.id + '">' + svg(n.id) + '<span>' + n.label + '</span></button>'; }).join('');
    var d = NAV.slice(0, 4).map(function (n) { return '<button data-go="' + n.id + '">' + svg(n.id) + n.short + '</button>'; });
    d.splice(2, 0, '<button class="fab add-trigger" aria-label="New entry">' + svg('plus') + '</button>');
    $('dock').innerHTML = d.join('');
  }
  document.addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]'); if (go) { show(go.dataset.go); return; }
    if (e.target.closest('.add-trigger')) entrySheet();
  });
  function show(v) {
    view = v;
    document.querySelectorAll('.view').forEach(function (s) { s.classList.toggle('active', s.id === 'view-' + v); });
    document.querySelectorAll('[data-go]').forEach(function (b) { b.classList.toggle('on', b.dataset.go === v); });
    var n = NAV.find(function (x) { return x.id === v; });
    $('page-title').textContent = n ? n.label : '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    render();
  }

  function greet() {
    var h = new Date().getHours();
    var g = h < 12 ? 'Habari za asubuhi' : h < 17 ? 'Habari za mchana' : 'Habari za jioni';
    $('hello').textContent = g + (me ? ', ' + me : '');
  }

  /* ================= theme ================= */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(LS.theme, t); } catch (e) {}
    $('theme-ic').innerHTML = t === 'dark' ? I.sun : I.moon;
    document.querySelector('meta[name=theme-color]').setAttribute('content', t === 'dark' ? '#070A12' : '#EDF0F7');
    Object.keys(charts).forEach(function (k) { if (charts[k]) { charts[k].destroy(); charts[k] = null; } });
    if (db) render();
  }
  $('theme-btn').addEventListener('click', function () { applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); });

  /* ================= render ================= */
  function render() {
    if (!db) return;
    greet();
    if (view === 'home') renderHome();
    if (view === 'activity') renderActivity();
    if (view === 'bills') renderBills();
    if (view === 'loans') renderLoans();
    if (view === 'settings') renderSettings();
  }

  var anim = {};
  function animateMoney(el, to) {
    var from = anim[el.id] != null ? anim[el.id] : 0; anim[el.id] = to;
    if (Math.abs(to - from) < 1) { el.textContent = money(to); return; }
    var st = null;
    function step(ts) { if (!st) st = ts; var p = Math.min(1, (ts - st) / 700); var e = 1 - Math.pow(1 - p, 3); el.textContent = money(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }

  function txRow(t) {
    var c = catById(t.categoryId);
    var color = (c && c.color) || t.categoryColor || '#94A3B8';
    var name = (c && c.name) || t.categoryName || 'Uncategorised';
    var sub = [t.note, t.addedByName ? 'by ' + t.addedByName : null, t.recurring ? 'monthly' : null].filter(Boolean).join(' · ') || fmtDate(t.date);
    return '<div class="tx" data-tx="' + esc(t.id) + '">' +
      '<div class="tx-ic" style="background:' + hexA(color, .18) + ';color:' + color + '">' + esc(initials(name)) + '</div>' +
      '<div class="tx-main"><div class="tx-t">' + esc(name) + '</div><div class="tx-s">' + esc(sub) + '</div></div>' +
      '<div class="tx-amt ' + (t.kind === 'income' ? 'inc' : '') + '">' + (t.kind === 'income' ? '+' : '−') + money(t.amount).replace('−', '') + '</div></div>';
  }
  document.addEventListener('click', function (e) {
    var r = e.target.closest('[data-tx]'); if (!r) return;
    var t = txs().find(function (x) { return x.id === r.dataset.tx; }); if (t) entrySheet({ edit: t });
  });

  function empty(em, text) { return '<div class="empty"><div class="em">' + em + '</div>' + text + '</div>'; }

  /* ---------- HOME ---------- */
  function renderHome() {
    var y = month.y, m = month.m;
    $('m-label').textContent = MONTHS[m] + ' ' + y;
    var isCur = y === now.getFullYear() && m === now.getMonth();
    $('m-next').disabled = isCur; $('m-next').style.opacity = isCur ? .35 : 1;

    var list = monthTx(y, m), t = totals(list), net = t.inc - t.exp;
    animateMoney($('h-net'), net);
    $('h-inc').textContent = money(t.inc); $('h-exp').textContent = money(t.exp);
    var pct = t.inc > 0 ? Math.round(t.exp / t.inc * 100) : (t.exp > 0 ? 100 : 0);
    var fill = $('h-fill');
    fill.style.width = Math.min(100, pct) + '%';
    fill.className = 'spend-fill' + (pct > 100 ? ' over' : '');
    $('h-spendnote').textContent = t.inc > 0 ? 'Spent ' + pct + '% of what came in' + (pct > 100 ? ' — over by ' + money(t.exp - t.inc) : '') : (t.exp > 0 ? 'No income logged yet this month' : 'Nothing logged yet — tap + to add your first entry');
    var badge = $('h-badge');
    if (!list.length) { badge.className = 'hero-badge'; badge.textContent = 'No entries'; }
    else if (net >= 0) { badge.className = 'hero-badge good'; badge.textContent = '▲ In the green'; }
    else { badge.className = 'hero-badge bad'; badge.textContent = '▼ Overspent'; }

    // stats
    var expByCat = groupBy(list.filter(function (x) { return x.kind === 'expense'; }));
    var top = expByCat[0];
    var days = isCur ? now.getDate() : daysInMonth(y, m);
    var prev = new Date(y, m - 1, 1), pt = totals(monthTx(prev.getFullYear(), prev.getMonth()));
    var diff = pt.exp ? Math.round((t.exp - pt.exp) / pt.exp * 100) : null;
    $('h-stats').innerHTML = [
      ['Daily average spend', money(t.exp / Math.max(1, days))],
      ['Biggest category', top ? top.name : '—'],
      ['Spend vs last month', diff == null ? '—' : (diff > 0 ? '▲ ' : '▼ ') + Math.abs(diff) + '%'],
      ['Entries', String(list.length)],
    ].map(function (s) { return '<div class="stat glass"><div class="k">' + s[0] + '</div><div class="v">' + esc(s[1]) + '</div></div>'; }).join('');

    // up next
    var unpaid = billsWithStatus().filter(function (b) { return !b.paid; }).sort(function (a, b) { return a.daysUntil - b.daysUntil; }).slice(0, 4);
    var loansDue = (db.balances || []).filter(function (b) { return b.dueDate && b.status !== 'paid_off'; }).map(function (b) {
      return { name: b.name, amt: b.installmentAmount, days: Math.round((new Date(b.dueDate + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000) };
    }).filter(function (b) { return b.days <= 14; });
    var up = unpaid.map(function (b) { return { name: b.categoryName, amt: b.predicted, days: b.daysUntil, color: b.color }; }).concat(loansDue).sort(function (a, b) { return a.days - b.days; }).slice(0, 4);
    $('h-upnext').innerHTML = up.length ? up.map(function (u) {
      var cls = u.days < 0 ? 'overdue' : u.days <= 5 ? 'soon' : '';
      var lbl = u.days < 0 ? Math.abs(u.days) + 'd overdue' : u.days === 0 ? 'Due today' : 'In ' + u.days + ' day' + (u.days === 1 ? '' : 's');
      return '<div class="bill"><div class="tx-ic" style="background:' + hexA(u.color || '#60A5FA', .18) + ';color:' + (u.color || '#60A5FA') + '">' + esc(initials(u.name)) + '</div><div class="tx-main"><div class="tx-t">' + esc(u.name) + '</div><span class="due ' + cls + '">' + lbl + '</span></div><div class="tx-amt">' + (u.amt ? money(u.amt) : '') + '</div></div>';
    }).join('') : empty('🎉', db.bills.length ? 'Nothing due right now.' : 'Track your fixed bills to see what’s coming up.');

    // recent
    var rec = sortTx(txs()).slice(0, 5);
    $('h-recent').innerHTML = rec.length ? rec.map(txRow).join('') : empty('✍️', 'Your latest entries will show here.');

    donut('exp', expByCat, 'spent');
    donut('inc', groupBy(list.filter(function (x) { return x.kind === 'income'; })), 'earned');
    trend();
  }
  $('m-prev').addEventListener('click', function () { month.m--; if (month.m < 0) { month.m = 11; month.y--; } renderHome(); });
  $('m-next').addEventListener('click', function () {
    if (month.y === now.getFullYear() && month.m === now.getMonth()) return;
    month.m++; if (month.m > 11) { month.m = 0; month.y++; } renderHome();
  });

  function groupBy(list) {
    var map = {};
    list.forEach(function (t) {
      var c = catById(t.categoryId); var k = (c && c.name) || t.categoryName || 'Other';
      if (!map[k]) map[k] = { name: k, total: 0, color: (c && c.color) || t.categoryColor || '#94A3B8' };
      map[k].total += t.amount;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.total - a.total; });
  }

  function donut(key, entries, word) {
    var canvas = $('c-' + key), legend = $('l-' + key), center = $('c-' + key + '-center');
    if (charts[key]) { charts[key].destroy(); charts[key] = null; }
    var total = sum(entries, function (e) { return e.total; });
    if (!entries.length) {
      canvas.parentElement.style.display = 'none';
      legend.innerHTML = empty(key === 'exp' ? '📊' : '💼', 'Nothing ' + word + ' in ' + MONTHS[month.m] + ' yet.');
      return;
    }
    canvas.parentElement.style.display = '';
    center.innerHTML = '<div><b>' + money(total, true) + '</b><span>' + word + '</span></div>';
    legend.innerHTML = entries.slice(0, 8).map(function (c) {
      return '<div class="lg"><span class="dot" style="background:' + c.color + '"></span><span class="nm">' + esc(c.name) + '</span><span class="pc">' + Math.round(c.total / total * 100) + '%</span><span class="vl">' + money(c.total) + '</span></div>';
    }).join('') + (entries.length > 8 ? '<div class="lg"><span class="nm">+' + (entries.length - 8) + ' more</span></div>' : '');
    if (!window.Chart) return;
    charts[key] = new Chart(canvas, {
      type: 'doughnut',
      data: { labels: entries.map(function (c) { return c.name; }), datasets: [{ data: entries.map(function (c) { return c.total; }), backgroundColor: entries.map(function (c) { return c.color; }), borderColor: 'transparent', borderRadius: 6, spacing: 3, hoverOffset: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '72%', animation: { animateRotate: true, duration: 900 },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ' ' + c.label + ': ' + money(c.raw); } } } } },
    });
  }

  function trend() {
    if (charts.trend) { charts.trend.destroy(); charts.trend = null; }
    if (!window.Chart) return;
    var ms = [];
    for (var i = 5; i >= 0; i--) { var d = new Date(month.y, month.m - i, 1); ms.push({ y: d.getFullYear(), m: d.getMonth() }); }
    var inc = ms.map(function (x) { return totals(monthTx(x.y, x.m)).inc; });
    var exp = ms.map(function (x) { return totals(monthTx(x.y, x.m)).exp; });
    var ctx = $('c-trend').getContext('2d');
    function grad(c1) { var g = ctx.createLinearGradient(0, 0, 0, 230); g.addColorStop(0, c1); g.addColorStop(1, hexA(c1, .25)); return g; }
    var incC = cssVar('--inc'), expC = cssVar('--exp');
    charts.trend = new Chart(ctx, {
      type: 'bar',
      data: { labels: ms.map(function (x) { return MONTHS[x.m].slice(0, 3); }),
        datasets: [{ label: 'Income', data: inc, backgroundColor: grad(incC), borderRadius: 8, borderSkipped: false, maxBarThickness: 26 },
                   { label: 'Expenses', data: exp, backgroundColor: grad(expC), borderRadius: 8, borderSkipped: false, maxBarThickness: 26 }] },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'rectRounded', color: cssVar('--ink-2'), font: { family: 'Plus Jakarta Sans', weight: 600 } } },
          tooltip: { callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + money(c.raw); } } } },
        scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: cssVar('--ink-3'), font: { family: 'Plus Jakarta Sans', weight: 600 } } },
          y: { border: { display: false }, grid: { color: hexA('#888888', .15) }, ticks: { color: cssVar('--ink-3'), callback: function (v) { return v >= 1000 ? (v / 1000) + 'k' : v; } } } } },
    });
  }

  /* ---------- ACTIVITY ---------- */
  function renderActivity() {
    var sel = $('a-month');
    var keys = {}; txs().forEach(function (t) { if (t.date) keys[t.date.slice(0, 7)] = 1; });
    keys[monthKey(now.getFullYear(), now.getMonth())] = 1;
    var opts = Object.keys(keys).sort().reverse();
    sel.innerHTML = '<option value="all">All time</option>' + opts.map(function (k) { var p = k.split('-'); return '<option value="' + k + '"' + (k === act.month ? ' selected' : '') + '>' + MONTHS[+p[1] - 1] + ' ' + p[0] + '</option>'; }).join('');
    if (act.month === 'all') sel.value = 'all';

    var q = act.q.trim().toLowerCase();
    var list = sortTx(txs()).filter(function (t) {
      if (act.kind !== 'all' && t.kind !== act.kind) return false;
      if (act.month !== 'all' && (t.date || '').slice(0, 7) !== act.month) return false;
      if (!q) return true;
      var c = catById(t.categoryId);
      return [(c && c.name) || t.categoryName, t.note, t.addedByName, String(Math.round(t.amount))].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    var t = totals(list);
    $('a-totals').innerHTML = '<span class="pill">' + list.length + ' entries</span><span class="pill inc">+' + money(t.inc) + '</span><span class="pill exp">−' + money(t.exp) + '</span>';
    if (!list.length) { $('a-list').innerHTML = '<div class="card glass">' + empty('🔎', q ? 'No entries match “' + esc(act.q) + '”.' : 'No entries for this period yet.') + '</div>'; return; }
    var groups = [], cur = null;
    list.slice(0, 400).forEach(function (x) { if (!cur || cur.date !== x.date) { cur = { date: x.date, items: [] }; groups.push(cur); } cur.items.push(x); });
    $('a-list').innerHTML = groups.map(function (g) {
      var gt = totals(g.items);
      return '<div class="day-head"><span>' + esc(dayLabel(g.date)) + '</span><span>' + (gt.exp ? '−' + money(gt.exp) : '') + (gt.inc ? ' +' + money(gt.inc) : '') + '</span></div><div class="day-group glass">' + g.items.map(txRow).join('') + '</div>';
    }).join('');
  }
  $('a-search').addEventListener('input', function () { act.q = this.value; renderActivity(); });
  $('a-month').addEventListener('change', function () { act.month = this.value; renderActivity(); });
  $('a-kind').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    act.kind = b.dataset.k; this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); renderActivity();
  });

  /* ---------- BILLS ---------- */
  function lastAmounts(catId, n) { return sortTx(txs().filter(function (t) { return t.kind === 'expense' && t.categoryId === catId; })).slice(0, n).map(function (t) { return t.amount; }); }
  function billsWithStatus() {
    var curKey = monthKey(now.getFullYear(), now.getMonth());
    return (db.bills || []).filter(function (b) { return (b.billType || 'fixed') === 'fixed'; }).map(function (b) {
      var paid = txs().some(function (t) { return t.kind === 'expense' && t.categoryId === b.categoryId && (t.date || '').slice(0, 7) === curKey; });
      var rec = lastAmounts(b.categoryId, 3);
      var predicted = rec.length ? avg(rec) : (b.expectedAmount || 0);
      var due = Math.min(b.dueDay || 1, daysInMonth(now.getFullYear(), now.getMonth()));
      var daysUntil = Math.round((new Date(now.getFullYear(), now.getMonth(), due) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
      var c = catById(b.categoryId);
      return { id: b.id, categoryId: b.categoryId, categoryName: (c && c.name) || b.categoryName, color: c ? c.color : '#94A3B8', essential: c ? !!c.essential : false,
        expectedAmount: b.expectedAmount, dueDay: b.dueDay, predicted: predicted, paid: paid, daysUntil: daysUntil };
    });
  }
  function variableBills() {
    return (db.bills || []).filter(function (b) { return b.billType === 'variable'; }).map(function (b) {
      var tx = sortTx(txs().filter(function (t) { return t.kind === 'expense' && t.categoryId === b.categoryId; }));
      var c = catById(b.categoryId);
      var monthTotal = sum(monthTx(now.getFullYear(), now.getMonth()).filter(function (t) { return t.categoryId === b.categoryId; }), function (t) { return t.amount; });
      var last = tx.length ? tx[0].date : null;
      var since = last ? Math.round((now - new Date(last + 'T00:00:00')) / 86400000) : null;
      var interval = null;
      if (tx.length >= 2) {
        var ds = tx.slice(0, 5).map(function (t) { return new Date(t.date + 'T00:00:00').getTime(); }).sort(function (a, c) { return a - c; });
        var gaps = []; for (var i = 1; i < ds.length; i++) gaps.push((ds[i] - ds[i - 1]) / 86400000);
        interval = avg(gaps);
      }
      return { id: b.id, categoryId: b.categoryId, name: (c && c.name) || b.categoryName, color: c ? c.color : '#94A3B8', monthTotal: monthTotal, since: since, interval: interval,
        avgAmt: tx.length ? avg(tx.slice(0, 5).map(function (t) { return t.amount; })) : null, nudge: !!(interval && since != null && since > interval * 1.4) };
    });
  }

  function availFunds() {
    var s = db.settings && db.settings.availableFunds;
    var curKey = monthKey(now.getFullYear(), now.getMonth());
    if (s && s.month === curKey && s.amount != null) return s.amount;
    return totals(monthTx(now.getFullYear(), now.getMonth())).inc;
  }

  function renderBills() {
    var bills = billsWithStatus();
    var unpaid = bills.filter(function (b) { return !b.paid; }).sort(function (a, b) { return a.daysUntil - b.daysUntil || (b.essential - a.essential); });
    var paid = bills.filter(function (b) { return b.paid; }).sort(function (a, b) { return a.dueDay - b.dueDay; });

    // forecast
    var ms3 = []; for (var i = 1; i <= 3; i++) { var d = new Date(now.getFullYear(), now.getMonth() - i, 1); ms3.push(monthTx(d.getFullYear(), d.getMonth())); }
    var billCats = bills.map(function (b) { return b.categoryId; });
    var withData = ms3.filter(function (l) { return l.length; });
    var varAvg = avg(withData.map(function (l) { return sum(l.filter(function (t) { return t.kind === 'expense' && billCats.indexOf(t.categoryId) < 0; }), function (t) { return t.amount; }); }));
    var incAvg = avg(withData.map(function (l) { return totals(l).inc; }));
    var predicted = sum(bills, function (b) { return b.predicted; }) + varAvg;
    if (txs().length < 3) { $('b-forecast').textContent = '—'; $('b-forecast-note').textContent = 'Log a few weeks of entries and this will start predicting your month.'; }
    else {
      $('b-forecast').textContent = money(predicted);
      $('b-forecast-note').textContent = incAvg > 0 ? 'Typical income ~' + money(incAvg) + ' → projected net ' + money(incAvg - predicted) + '. A guide, not a guarantee.' : 'Based on ' + bills.length + ' fixed bill' + (bills.length === 1 ? '' : 's') + ' plus your usual everyday spending.';
    }

    // availability
    var avail = availFunds();
    var inp = $('b-avail'); if (document.activeElement !== inp) inp.value = avail ? Math.round(avail) : '';
    var run = 0, cover = {};
    unpaid.forEach(function (b) { run += b.predicted; cover[b.id] = avail > 0 && run <= avail; });
    var sumEl = $('b-avail-sum');
    if (!bills.length) { sumEl.className = 'avail-summary'; sumEl.textContent = 'Defaults to this month’s income. Change it to plan with a different amount.'; }
    else if (!unpaid.length) { sumEl.className = 'avail-summary ok'; sumEl.textContent = 'Every fixed bill is paid for this month. ✨'; }
    else if (!avail) { sumEl.className = 'avail-summary'; sumEl.textContent = 'Enter what you have and I’ll rank unpaid bills by what fits first.'; }
    else {
      var n = unpaid.filter(function (b) { return cover[b.id]; }).length;
      if (n === unpaid.length) { sumEl.className = 'avail-summary ok'; sumEl.textContent = 'Covers all ' + n + ' unpaid bill' + (n === 1 ? '' : 's') + ' — ' + money(avail - run) + ' left over.'; }
      else { sumEl.className = 'avail-summary short'; sumEl.textContent = 'Covers ' + n + ' of ' + unpaid.length + ' unpaid bills in priority order — short by ' + money(run - avail) + ' from ' + unpaid[n].categoryName + ' onwards.'; }
    }

    // tips
    var tips = [];
    unpaid.filter(function (b) { return b.daysUntil < 0; }).slice(0, 3).forEach(function (b) { tips.push(['urgent', '⚠️', '<b>' + esc(b.categoryName) + '</b> was due ' + Math.abs(b.daysUntil) + ' day' + (Math.abs(b.daysUntil) === 1 ? '' : 's') + ' ago — roughly ' + money(b.predicted) + '. Sort this first.']); });
    unpaid.filter(function (b) { return b.daysUntil >= 0 && b.daysUntil <= 5; }).slice(0, 3).forEach(function (b) { tips.push(['soon', '⏰', '<b>' + esc(b.categoryName) + '</b> is due ' + (b.daysUntil === 0 ? 'today' : 'in ' + b.daysUntil + ' day' + (b.daysUntil === 1 ? '' : 's')) + ' — budget about ' + money(b.predicted) + '.']); });
    variableBills().filter(function (v) { return v.nudge; }).forEach(function (v) { tips.push(['soon', '🔌', '<b>' + esc(v.name) + '</b>: it’s been ' + v.since + ' days since the last top-up (usually every ~' + Math.round(v.interval) + ').']); });
    $('b-tips').innerHTML = tips.map(function (t) { return '<div class="tip ' + t[0] + '"><span>' + t[1] + '</span><span>' + t[2] + '</span></div>'; }).join('');

    var ordered = unpaid.concat(paid);
    $('b-list').innerHTML = ordered.length ? ordered.map(function (b, idx) {
      var cls = '', lbl;
      if (b.paid) { cls = 'paid'; lbl = 'Paid this month'; }
      else if (b.daysUntil < 0) { cls = 'overdue'; lbl = Math.abs(b.daysUntil) + ' day' + (Math.abs(b.daysUntil) === 1 ? '' : 's') + ' overdue'; }
      else if (b.daysUntil === 0) { cls = 'soon'; lbl = 'Due today'; }
      else if (b.daysUntil <= 5) { cls = 'soon'; lbl = 'Due in ' + b.daysUntil + ' day' + (b.daysUntil === 1 ? '' : 's'); }
      else lbl = 'Due on the ' + ordinal(b.dueDay);
      var fit = (!b.paid && avail) ? '<span class="fit ' + (cover[b.id] ? 'ok' : 'no') + '">' + (cover[b.id] ? '● fits' : '● short') + '</span>' : '';
      return '<div class="bill"><div class="rank" style="' + (b.paid ? 'opacity:.4' : '') + '">' + (b.paid ? '✓' : idx + 1) + '</div>' +
        '<div class="tx-main"><div class="tx-t">' + esc(b.categoryName) + '' + '</div><span class="due ' + cls + '">' + lbl + '</span>' + fit + '</div>' +
        '<div style="text-align:right"><div class="tx-amt">' + money(b.predicted) + '</div><div class="bill-actions" style="margin-top:6px">' +
        (b.paid ? '' : '<button class="mini go" data-pay-bill="' + b.id + '">Mark paid</button>') +
        '<button class="mini x" data-del-bill="' + b.id + '" aria-label="Remove">' + svg('trash') + '</button></div></div></div>';
    }).join('') : empty('📅', 'No fixed bills yet. Add rent, school fees, insurance — anything with a set date.');

    var vb = variableBills();
    $('b-var').innerHTML = vb.length ? vb.map(function (v) {
      var meta = !v.since && v.since !== 0 ? 'No top-ups logged yet' : 'Last top-up ' + (v.since === 0 ? 'today' : v.since + ' day' + (v.since === 1 ? '' : 's') + ' ago') + (v.interval ? ' · usually every ~' + Math.round(v.interval) + ' days' : '');
      return '<div class="bill"><div class="tx-ic" style="background:' + hexA(v.color, .18) + ';color:' + v.color + '">' + esc(initials(v.name)) + '</div>' +
        '<div class="tx-main"><div class="tx-t">' + esc(v.name) + '</div><div class="tx-s">' + esc(meta) + '</div>' + (v.nudge ? '<span class="due soon">Probably due for a top-up</span>' : '') + '</div>' +
        '<div style="text-align:right"><div class="tx-amt">' + money(v.monthTotal) + '</div><div class="tx-s">this month</div><div class="bill-actions" style="margin-top:6px;justify-content:flex-end">' +
        '<button class="mini go" data-topup="' + v.categoryId + '">Log top-up</button><button class="mini x" data-del-bill="' + v.id + '" aria-label="Stop tracking">' + svg('trash') + '</button></div></div></div>';
    }).join('') : empty('🔌', 'Track tokens, water or gas here — no fixed date, just how often you top up.');
  }
  $('b-avail').addEventListener('change', function () {
    var v = parseFloat(this.value);
    commit([{ op: 'setting', key: 'availableFunds', value: { amount: isNaN(v) ? null : v, month: monthKey(now.getFullYear(), now.getMonth()) } }]);
  });
  $('b-add').addEventListener('click', billSheet);
  document.addEventListener('click', function (e) {
    var p = e.target.closest('[data-pay-bill]');
    if (p) { var b = billsWithStatus().find(function (x) { return x.id === p.dataset.payBill; }); if (b) entrySheet({ kind: 'expense', categoryId: b.categoryId, amount: Math.round(b.predicted), title: 'Pay ' + b.categoryName }); return; }
    var tu = e.target.closest('[data-topup]');
    if (tu) { entrySheet({ kind: 'expense', categoryId: tu.dataset.topup, title: 'Log a top-up' }); return; }
    var d = e.target.closest('[data-del-bill]');
    if (d) { confirmTap(d, function () { commit([{ op: 'remove', coll: 'bills', id: d.dataset.delBill }]); toast('Stopped tracking'); }); }
  });

  function confirmTap(btn, fn) {
    if (btn.dataset.armed) { fn(); return; }
    btn.dataset.armed = '1'; var old = btn.innerHTML; btn.innerHTML = 'Sure?'; btn.style.color = 'var(--bad)';
    setTimeout(function () { if (btn.isConnected) { delete btn.dataset.armed; btn.innerHTML = old; btn.style.color = ''; } }, 2500);
  }

  /* ---------- LOANS ---------- */
  var STATUS = { current: 'Current', not_yet_due: 'Not yet due', defaulted: 'Defaulted', paid_off: 'Paid off' };
  function renderLoans() {
    var list = (db.balances || []).slice().sort(function (a, b) { var r = { defaulted: 0, current: 1, not_yet_due: 2, paid_off: 3 }; return (r[a.status] || 9) - (r[b.status] || 9); });
    var active = list.filter(function (b) { return b.status !== 'paid_off'; });
    var owed = sum(active, function (b) { return b.balanceRemaining || 0; });
    var totalAll = sum(active, function (b) { return b.totalAmount || 0; });
    animateMoney($('l-owed'), owed);
    var pct = totalAll ? Math.round((totalAll - owed) / totalAll * 100) : 0;
    $('l-fill').style.width = pct + '%';
    $('l-note').textContent = list.length ? pct + '% of active balances paid down · ' + active.length + ' active, ' + (list.length - active.length) + ' cleared' : 'Add loans, school-fee balances or anything you’re paying off over time.';
    if (!list.length) { $('l-list').innerHTML = '<div class="card glass span-2">' + empty('🏦', 'No loans or running balances yet.') + '</div>'; return; }
    var C = 2 * Math.PI * 28;
    $('l-list').innerHTML = list.map(function (b) {
      var p = (b.totalAmount && b.balanceRemaining != null) ? Math.max(0, Math.min(100, Math.round((b.totalAmount - b.balanceRemaining) / b.totalAmount * 100))) : 0;
      var due = '';
      if (b.dueDate && b.status !== 'paid_off') {
        var days = Math.round((new Date(b.dueDate + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
        due = days < 0 ? '<span class="due overdue">' + Math.abs(days) + 'd overdue</span>' : days <= 5 ? '<span class="due soon">' + (days === 0 ? 'Due today' : 'Due in ' + days + 'd') + '</span>' : '';
      }
      return '<div class="loan glass"><div class="loan-top">' +
        '<div class="ring"><svg viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="28"/><circle class="fg" cx="32" cy="32" r="28" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - p / 100)) + '"/></svg><b>' + p + '%</b></div>' +
        '<div class="tx-main"><h4>' + esc(b.name) + '</h4><span class="status ' + esc(b.status) + '">' + (STATUS[b.status] || b.status) + '</span> ' + due + '</div>' +
        '<button class="icon-btn sm glass" data-edit-loan="' + b.id + '" aria-label="Edit">' + svg('edit') + '</button></div>' +
        '<div class="loan-meta"><div><div class="k">Remaining</div><div class="v">' + money(b.balanceRemaining) + '</div></div><div><div class="k">Total</div><div class="v">' + (b.totalAmount ? money(b.totalAmount) : '—') + '</div></div><div><div class="k">Instalment</div><div class="v">' + (b.installmentAmount ? money(b.installmentAmount) : '—') + '</div></div></div>' +
        (b.notes ? '<p class="loan-notes">' + esc(b.notes) + '</p>' : '') +
        (b.dueDate ? '<p class="loan-notes">Next due ' + fmtDate(b.dueDate) + '</p>' : '') +
        (b.status !== 'paid_off' ? '<button class="btn primary sm" style="width:100%" data-pay-loan="' + b.id + '">Record a payment</button>' : '') + '</div>';
    }).join('');
  }
  $('l-add').addEventListener('click', function () { loanSheet(); });
  document.addEventListener('click', function (e) {
    var ed = e.target.closest('[data-edit-loan]'); if (ed) { loanSheet((db.balances || []).find(function (b) { return b.id === ed.dataset.editLoan; })); return; }
    var pl = e.target.closest('[data-pay-loan]'); if (pl) paySheet((db.balances || []).find(function (b) { return b.id === pl.dataset.payLoan; }));
  });

  /* ---------- SETTINGS ---------- */
  function renderSettings() {
    var names = ['Rotich', 'Njoki']; if (me && names.indexOf(me) < 0) names.push(me);
    $('s-who').innerHTML = names.map(function (n) { return '<button data-who="' + esc(n) + '" class="' + (n === me ? 'on' : '') + '">' + esc(n) + '</button>'; }).join('');
    var t = document.documentElement.getAttribute('data-theme');
    $('s-theme').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
    var np = ('Notification' in window) ? Notification.permission : 'unsupported';
    $('s-notif').textContent = np === 'granted' ? 'On' : 'Turn on'; $('s-notif').disabled = np === 'granted' || np === 'unsupported';
    if (np === 'denied') $('s-notif-state').textContent = 'Blocked in browser settings';
    if (np === 'unsupported') $('s-notif-state').textContent = 'Not supported here — on iPhone, add to Home Screen first';
    $('s-cats').innerHTML = ['expense', 'income'].map(function (k) {
      return cats(k).map(function (c) {
        return '<div class="cm"><span class="dot" style="background:' + c.color + '"></span><span class="nm">' + esc(c.name) + '</span><span class="kd">' + (k === 'income' ? 'income' : (c.essential ? 'essential' : 'expense')) + '</span><button data-edit-cat="' + c.id + '" aria-label="Edit">' + svg('edit') + '</button></div>';
      }).join('');
    }).join('');
    loadBackups();
  }
  $('s-who').addEventListener('click', function (e) { var b = e.target.closest('[data-who]'); if (b) setMe(b.dataset.who); });
  $('s-who-save').addEventListener('click', function () { var v = $('s-who-other').value.trim(); if (v) { setMe(v); $('s-who-other').value = ''; } });
  function setMe(n) { me = n; try { localStorage.setItem(LS.me, n); } catch (e) {} toast('This phone is now ' + n + '’s'); render(); }
  $('s-theme').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { applyTheme(b.dataset.t); renderSettings(); } });
  $('s-notif').addEventListener('click', function () {
    if (!('Notification' in window)) return;
    Notification.requestPermission().then(function (p) { renderSettings(); if (p === 'granted') notify('Our Budget', 'You’ll get a ping when a bill is due soon or ' + (me ? 'someone other than ' + me : 'the other person') + ' adds an entry.'); });
  });
  $('s-lock').addEventListener('click', function () {
    api('/api/auth', { method: 'DELETE' }).catch(function () {}).then(function () {
      try { localStorage.removeItem(LS.cache); } catch (e) {}
      db = null; showLock();
    });
  });
  $('s-cat-add').addEventListener('click', function () { catSheet(); });
  document.addEventListener('click', function (e) { var c = e.target.closest('[data-edit-cat]'); if (c) catSheet(catById(c.dataset.editCat)); });

  function loadBackups() {
    api('/api/backup?list=1').then(function (j) {
      $('s-backups').innerHTML = j.backups.length ? j.backups.slice(0, 30).map(function (b) {
        var name = b.pathname.replace('backups/', '').replace('.json', '');
        return '<div class="bk"><span>' + esc(name) + ' <span class="muted sm-txt">· ' + Math.max(1, Math.round(b.size / 1024)) + ' KB</span></span><button class="mini" data-restore="' + esc(b.pathname) + '">Restore</button></div>';
      }).join('') : '<div class="muted sm-txt">No backups yet — the first one runs tonight.</div>';
    }).catch(function () {});
  }
  $('s-backup-now').addEventListener('click', function () {
    var b = this; b.disabled = true;
    api('/api/backup', { method: 'POST' }).then(function () { toast('Backup saved'); loadBackups(); }).catch(function (e) { toast('Backup failed: ' + e.message); }).then(function () { b.disabled = false; });
  });
  document.addEventListener('click', function (e) {
    var r = e.target.closest('[data-restore]'); if (!r) return;
    confirmTap(r, function () {
      api('/api/backup?file=' + encodeURIComponent(r.dataset.restore)).then(function (j) {
        return api('/api/data', { method: 'POST', body: JSON.stringify({ ops: [{ op: 'import', mode: 'replace', data: j.db }] }) });
      }).then(function (j) { db = j.db; saveJSON(LS.cache, db); render(); toast('Restored from backup'); }).catch(function (err) { toast('Restore failed: ' + err.message); });
    });
  });

  function download(name, text, type) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  $('s-export').addEventListener('click', function () { download('kiptum-budget-' + todayISO() + '.json', JSON.stringify(db, null, 2), 'application/json'); });
  $('s-export-csv').addEventListener('click', function () {
    var rows = [['date', 'kind', 'category', 'amount', 'note', 'added_by', 'recurring']];
    sortTx(txs()).forEach(function (t) { var c = catById(t.categoryId); rows.push([t.date, t.kind, (c && c.name) || t.categoryName, t.amount, t.note || '', t.addedByName || '', t.recurring ? 'yes' : '']); });
    download('kiptum-transactions-' + todayISO() + '.csv', rows.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\n'), 'text/csv');
  });

  /* ---- import ---- */
  function parseCSV(text) {
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f.length || row.length) { row.push(f); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (v) { return v !== ''; }); });
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim(); });
    return rows.slice(1).map(function (r) { var o = {}; head.forEach(function (h, i) { var v = r[i]; o[h] = v === '' || v === 'NULL' || v === 'null' ? null : v; }); return o; });
  }
  function guessCollection(fname, rows) {
    var n = fname.toLowerCase();
    var known = ['transactions', 'categories', 'balances', 'bills'];
    for (var i = 0; i < known.length; i++) if (n.indexOf(known[i]) >= 0) return known[i];
    var k = rows[0] ? Object.keys(rows[0]) : [];
    if (k.indexOf('balance_remaining') >= 0 || k.indexOf('balanceRemaining') >= 0) return 'balances';
    if (k.indexOf('due_day') >= 0 || k.indexOf('bill_type') >= 0) return 'bills';
    if (k.indexOf('amount') >= 0 && k.indexOf('kind') >= 0) return 'transactions';
    if (k.indexOf('essential') >= 0 && k.indexOf('color') >= 0) return 'categories';
    return null;
  }
  $('s-import').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files || []); this.value = '';
    if (!files.length) return;
    var msg = $('s-import-msg'); msg.textContent = 'Reading ' + files.length + ' file(s)…';
    Promise.all(files.map(function (f) { return f.text().then(function (t) { return { name: f.name, text: t }; }); })).then(function (list) {
      var data = {}, notes = [];
      list.forEach(function (f) {
        if (/\.json$/i.test(f.name) || /^\s*[\[{]/.test(f.text)) {
          var j = JSON.parse(f.text);
          if (Array.isArray(j)) { var c = guessCollection(f.name, j); if (c) { data[c] = (data[c] || []).concat(j); notes.push(j.length + ' ' + c); } }
          else { (j.db || j) && ['transactions', 'categories', 'bills', 'balances'].forEach(function (c) { var src = (j.db || j)[c]; if (Array.isArray(src)) { data[c] = (data[c] || []).concat(src); notes.push(src.length + ' ' + c); } }); if ((j.db || j).settings) data.settings = (j.db || j).settings; }
        } else {
          var rows = parseCSV(f.text); var col = guessCollection(f.name, rows);
          if (col) { data[col] = (data[col] || []).concat(rows); notes.push(rows.length + ' ' + col); } else notes.push('skipped ' + f.name);
        }
      });
      if (!Object.keys(data).length) throw new Error('Nothing recognisable in those files');
      msg.textContent = 'Importing ' + notes.join(', ') + '…';
      return api('/api/data', { method: 'POST', body: JSON.stringify({ ops: [{ op: 'import', mode: 'merge', data: data }] }) }).then(function (j) {
        db = j.db; saveJSON(LS.cache, db); render(); msg.textContent = '✓ Imported ' + notes.join(', ') + '.'; toast('Import complete');
      });
    }).catch(function (e) { msg.textContent = 'Import failed: ' + e.message; });
  });

  /* ================= sheets ================= */
  function openSheet(title, html, mount) {
    $('sheet-title').textContent = title;
    $('sheet-body').innerHTML = html;
    $('scrim').classList.add('on'); $('sheet').classList.add('on');
    document.body.style.overflow = 'hidden';
    if (mount) mount($('sheet-body'));
  }
  function closeSheet() { $('scrim').classList.remove('on'); $('sheet').classList.remove('on'); document.body.style.overflow = ''; }
  $('scrim').addEventListener('click', closeSheet);
  $('sheet-close').addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

  /* ---- entry (add / edit transaction) ---- */
  function entrySheet(o) {
    o = o || {};
    var t = o.edit || null;
    var st = { kind: t ? t.kind : (o.kind || 'expense'), cat: t ? t.categoryId : (o.categoryId || null) };
    var html =
      (t ? '' : '<details class="collapse"><summary>' + svg('msg') + ' Paste an M-Pesa message</summary><div class="inner"><textarea class="input" id="e-mpesa" rows="3" placeholder="e.g. QFH7XXXX Confirmed. Ksh500.00 paid to KPLC PREPAID for account 1234 on 22/9/26 at 3:45 PM…"></textarea><button class="btn ghost sm mt" id="e-mpesa-go">Read message</button><div class="muted sm-txt mt" id="e-mpesa-note"></div></div></details>') +
      '<div class="seg glass" id="e-kind"><button data-k="expense">Expense</button><button data-k="income">Income</button></div>' +
      '<div class="amount-big"><input id="e-amt" type="number" inputmode="decimal" placeholder="0" min="0" step="1" value="' + (t ? t.amount : (o.amount || '')) + '"><div class="cur">KENYA SHILLINGS</div></div>' +
      '<div class="field"><span class="lbl">Category</span><div class="chips" id="e-cats"></div></div>' +
      '<div class="field-row"><div class="field"><label for="e-date">Date</label><input id="e-date" type="date" value="' + (t ? t.date : todayISO()) + '"></div>' +
      '<div class="field"><label for="e-by">Added by</label><input id="e-by" value="' + esc(t ? (t.addedByName || '') : (me || '')) + '" placeholder="Name"></div></div>' +
      '<div class="field"><label for="e-note">Note</label><textarea id="e-note" placeholder="e.g. topped up at Total, Ngong Road">' + esc(t ? t.note || '' : '') + '</textarea></div>' +
      '<label class="toggle"><span><b>Repeats monthly</b><div class="muted sm-txt">Rent, salary, subscriptions…</div></span><span class="switch"><input type="checkbox" id="e-rec"' + (t && t.recurring ? ' checked' : '') + '><span></span></span></label>' +
      '<button class="btn primary wide" id="e-save">' + (t ? 'Save changes' : 'Save entry') + '</button>' +
      (t ? '<button class="btn danger wide" id="e-del" style="margin-top:8px">' + svg('trash') + 'Delete entry</button>' : '');
    openSheet(o.title || (t ? 'Edit entry' : 'New entry'), html, function (root) {
      function drawKind() { root.querySelectorAll('#e-kind button').forEach(function (b) { b.classList.toggle('on', b.dataset.k === st.kind); }); }
      function drawCats() {
        var list = cats(st.kind);
        root.querySelector('#e-cats').innerHTML = list.map(function (c) {
          var on = c.id === st.cat;
          return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-c="' + c.id + '" style="--c:' + c.color + ';' + (on ? 'background:' + c.color : '') + '"><span class="dot" style="background:' + c.color + '"></span>' + esc(c.name) + '</button>';
        }).join('') + '<button type="button" class="chip new" data-c="__new">+ New</button>';
      }
      drawKind(); drawCats();
      root.querySelector('#e-kind').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; st.kind = b.dataset.k; if (st.cat && (catById(st.cat) || {}).kind !== st.kind) st.cat = null; drawKind(); drawCats(); });
      root.querySelector('#e-cats').addEventListener('click', function (e) {
        var b = e.target.closest('[data-c]'); if (!b) return;
        if (b.dataset.c === '__new') {
          var name = prompt('New ' + st.kind + ' category name'); if (!name || !name.trim()) return;
          var c = { id: uid('cat'), name: name.trim().slice(0, 60), kind: st.kind, essential: false, color: PALETTE[(db.categories || []).length % PALETTE.length], custom: true };
          commit([{ op: 'add', coll: 'categories', item: c }]); st.cat = c.id; drawCats(); return;
        }
        st.cat = b.dataset.c; drawCats();
      });
      if (!t) setTimeout(function () { var a = root.querySelector('#e-amt'); if (window.innerWidth > 760 || o.amount == null) a.focus(); }, 350);
      var mp = root.querySelector('#e-mpesa-go');
      if (mp) mp.addEventListener('click', function () {
        var r = parseMpesa(root.querySelector('#e-mpesa').value), note = root.querySelector('#e-mpesa-note');
        if (!r.amount) { note.textContent = 'Couldn’t find an amount — paste the full SMS or fill in below.'; return; }
        st.kind = r.direction === 'in' ? 'income' : 'expense';
        st.cat = r.cat && catById(r.cat) ? r.cat : null;
        root.querySelector('#e-amt').value = r.amount; if (r.date) root.querySelector('#e-date').value = r.date;
        root.querySelector('#e-note').value = r.counterparty || '';
        drawKind(); drawCats();
        note.textContent = '✓ Filled in below' + (st.cat ? ' as ' + catById(st.cat).name : '') + ' — check it, then save.';
        root.querySelector('details').open = false;
      });
      root.querySelector('#e-save').addEventListener('click', function () {
        var amt = parseFloat(root.querySelector('#e-amt').value);
        if (!amt || amt <= 0) { toast('Enter an amount'); return; }
        var c = catById(st.cat); if (!c) { toast('Pick a category'); return; }
        var by = root.querySelector('#e-by').value.trim();
        if (by && !me) setMe(by);
        var item = { id: t ? t.id : uid('tx'), kind: st.kind, categoryId: c.id, categoryName: c.name, categoryColor: c.color, amount: amt,
          date: root.querySelector('#e-date').value || todayISO(), note: root.querySelector('#e-note').value.trim() || null,
          recurring: root.querySelector('#e-rec').checked, addedByName: by || null, balanceId: t ? t.balanceId || null : null,
          createdAt: t ? t.createdAt : new Date().toISOString() };
        commit([{ op: 'add', coll: 'transactions', item: item }]);
        closeSheet(); toast(t ? 'Updated' : (st.kind === 'income' ? 'Income saved 💚' : 'Expense saved'));
      });
      var del = root.querySelector('#e-del');
      if (del) del.addEventListener('click', function () { confirmTap(del, function () { commit([{ op: 'remove', coll: 'transactions', id: t.id }]); closeSheet(); toast('Deleted'); }); });
    });
  }

  /* ---- M-Pesa parser ---- */
  var HINTS = [
    [/kplc|kenya power|prepaid/, 'electricity'], [/water|nawasco|nairobi city water/, 'water'], [/airtime|bundles|safaricom data/, 'airtime_data'],
    [/total|shell|rubis|ola energy|petrol|engen|kobil/, 'car_fuel'], [/school|academy|university|college/, 'school_fees'],
    [/kcb|equity|co-op|coop bank|absa|dtb|ncba|loan|stanbic|family bank|fuliza|m-shwari|tala|branch/, 'loan_repayment'],
    [/hospital|clinic|pharmacy|chemist/, 'health'], [/supermarket|naivas|carrefour|quickmart|chandarana|butchery/, 'groceries'],
    [/netflix|showmax|dstv|spotify|zuku|startimes|gotv/, 'subscriptions'], [/rent|landlord/, 'rent'], [/gas|k-gas|afrigas|proto gas/, 'cooking_gas'],
  ];
  function parseMpesa(text) {
    text = (text || '').trim();
    var r = { amount: null, direction: null, counterparty: null, date: null, cat: null };
    if (!text) return r;
    var a = text.match(/Ksh\s*([\d,]+(?:\.\d{1,2})?)/i); if (a) r.amount = parseFloat(a[1].replace(/,/g, ''));
    var d = text.match(/on\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
    if (d) { var yy = +d[3]; if (yy < 100) yy += 2000; r.date = yy + '-' + pad(+d[2]) + '-' + pad(+d[1]); }
    var m;
    if (/received/i.test(text) && /from/i.test(text)) { r.direction = 'in'; m = text.match(/from\s+([A-Za-z0-9 .'&-]+?)\s+(?:\d{9,}|0\d{6,}|on\s)/i); r.counterparty = m ? m[1].trim() : 'Money received'; }
    else if (/paid to/i.test(text)) { r.direction = 'out'; m = text.match(/paid to\s+([A-Za-z0-9 .'&-]+?)(?:\s+for account|\.|,|\s+on\s)/i); r.counterparty = m ? m[1].trim() : 'Payment'; }
    else if (/sent to/i.test(text)) { r.direction = 'out'; m = text.match(/sent to\s+([A-Za-z0-9 .'&-]+?)\s+(?:for account|\d{9,}|0\d{6,}|on\s)/i); r.counterparty = m ? m[1].trim() : 'Money sent'; }
    else if (/withdraw/i.test(text)) { r.direction = 'out'; m = text.match(/from\s+([A-Za-z0-9 .'&-]+?)\s+on\s/i); r.counterparty = m ? m[1].trim() : 'Cash withdrawal'; }
    else if (/airtime/i.test(text)) { r.direction = 'out'; r.counterparty = 'Airtime'; }
    if (r.counterparty) { var cp = r.counterparty.toLowerCase(); for (var i = 0; i < HINTS.length; i++) if (HINTS[i][0].test(cp)) { r.cat = HINTS[i][1]; break; } }
    return r;
  }
  window.__parseMpesa = parseMpesa;

  /* ---- bill ---- */
  function billSheet() {
    var tracked = (db.bills || []).map(function (b) { return b.categoryId; });
    var options = cats('expense').filter(function (c) { return tracked.indexOf(c.id) < 0; });
    var type = 'fixed';
    openSheet('Track a bill',
      '<div class="seg glass" id="bl-type"><button data-t="fixed" class="on">Fixed date &amp; amount</button><button data-t="variable">Pay-as-you-go</button></div>' +
      '<div class="field mt"><label for="bl-cat">Category</label><select class="input" id="bl-cat">' + options.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field-row" id="bl-fixed"><div class="field"><label for="bl-amt">Typical amount (KSh)</label><input type="number" inputmode="decimal" id="bl-amt" placeholder="e.g. 25000"></div><div class="field"><label for="bl-day">Due day of month</label><input type="number" id="bl-day" min="1" max="31" placeholder="1–31"></div></div>' +
      '<p class="muted sm-txt" id="bl-var-note" hidden>No fixed date — the app watches how often you top up and nudges you when it’s been longer than usual.</p>' +
      '<button class="btn primary wide" id="bl-save">Start tracking</button>',
      function (root) {
        root.querySelector('#bl-type').addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return; type = b.dataset.t;
          this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
          root.querySelector('#bl-fixed').hidden = type !== 'fixed'; root.querySelector('#bl-var-note').hidden = type === 'fixed';
        });
        root.querySelector('#bl-save').addEventListener('click', function () {
          var c = catById(root.querySelector('#bl-cat').value); if (!c) { toast('Pick a category'); return; }
          var item = { id: uid('bill'), categoryId: c.id, categoryName: c.name, billType: type, expectedAmount: null, dueDay: null };
          if (type === 'fixed') {
            item.expectedAmount = parseFloat(root.querySelector('#bl-amt').value); item.dueDay = parseInt(root.querySelector('#bl-day').value, 10);
            if (!item.expectedAmount || item.expectedAmount <= 0) { toast('Enter a typical amount'); return; }
            if (!item.dueDay || item.dueDay < 1 || item.dueDay > 31) { toast('Due day must be 1–31'); return; }
          }
          commit([{ op: 'add', coll: 'bills', item: item }]); closeSheet(); toast('Now tracking ' + c.name);
        });
      });
  }

  /* ---- loan / balance ---- */
  function loanSheet(b) {
    b = b || null;
    openSheet(b ? 'Edit balance' : 'Add a loan or balance',
      '<div class="field"><label for="ln-name">Name</label><input class="input" id="ln-name" placeholder="e.g. Car loan – KCB, School fees Term 3" value="' + esc(b ? b.name : '') + '"></div>' +
      '<div class="field-row"><div class="field"><label for="ln-total">Total amount</label><input type="number" inputmode="decimal" id="ln-total" value="' + (b && b.totalAmount != null ? b.totalAmount : '') + '" placeholder="KSh"></div>' +
      '<div class="field"><label for="ln-rem">Still remaining</label><input type="number" inputmode="decimal" id="ln-rem" value="' + (b && b.balanceRemaining != null ? b.balanceRemaining : '') + '" placeholder="KSh"></div></div>' +
      '<div class="field-row"><div class="field"><label for="ln-inst">Instalment</label><input type="number" inputmode="decimal" id="ln-inst" value="' + (b && b.installmentAmount != null ? b.installmentAmount : '') + '" placeholder="KSh (optional)"></div>' +
      '<div class="field"><label for="ln-due">Next due date</label><input type="date" id="ln-due" value="' + (b && b.dueDate ? b.dueDate : '') + '"></div></div>' +
      '<div class="field"><label for="ln-status">Status</label><select class="input" id="ln-status">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (b && b.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="ln-notes">Notes</label><textarea id="ln-notes" placeholder="e.g. KCB M-Pesa loan">' + esc(b ? b.notes || '' : '') + '</textarea></div>' +
      '<button class="btn primary wide" id="ln-save">' + (b ? 'Save changes' : 'Add balance') + '</button>' + (b ? '<button class="btn danger wide" id="ln-del" style="margin-top:8px">' + svg('trash') + 'Remove</button>' : ''),
      function (root) {
        root.querySelector('#ln-save').addEventListener('click', function () {
          var name = root.querySelector('#ln-name').value.trim(); if (!name) { toast('Give it a name'); return; }
          var tot = parseFloat(root.querySelector('#ln-total').value), rem = parseFloat(root.querySelector('#ln-rem').value);
          if (isNaN(rem)) rem = isNaN(tot) ? null : tot;
          var item = { id: b ? b.id : uid('bal'), name: name, categoryId: b ? b.categoryId : 'loan_repayment', totalAmount: isNaN(tot) ? null : tot, balanceRemaining: rem,
            installmentAmount: parseFloat(root.querySelector('#ln-inst').value) || null, dueDate: root.querySelector('#ln-due').value || null,
            status: root.querySelector('#ln-status').value, notes: root.querySelector('#ln-notes').value.trim() || null };
          commit([{ op: 'add', coll: 'balances', item: item }]); closeSheet(); toast(b ? 'Updated' : 'Added');
        });
        var del = root.querySelector('#ln-del');
        if (del) del.addEventListener('click', function () { confirmTap(del, function () { commit([{ op: 'remove', coll: 'balances', id: b.id }]); closeSheet(); toast('Removed'); }); });
      });
  }

  function paySheet(b) {
    if (!b) return;
    openSheet('Payment · ' + b.name,
      '<div class="amount-big"><input id="p-amt" type="number" inputmode="decimal" placeholder="0" value="' + (b.installmentAmount || '') + '"><div class="cur">AMOUNT PAID</div></div>' +
      '<div class="field-row"><div class="field"><label for="p-date">Date paid</label><input type="date" id="p-date" value="' + todayISO() + '"></div>' +
      '<div class="field"><label for="p-next">Next due date</label><input type="date" id="p-next" value=""></div></div>' +
      '<label class="toggle"><span><b>Also log as an expense</b><div class="muted sm-txt">Adds it under Loan Repayment</div></span><span class="switch"><input type="checkbox" id="p-log" checked><span></span></span></label>' +
      '<p class="muted sm-txt">Remaining now: <b>' + money(b.balanceRemaining) + '</b></p>' +
      '<button class="btn primary wide" id="p-save">Record payment</button>',
      function (root) {
        root.querySelector('#p-save').addEventListener('click', function () {
          var amt = parseFloat(root.querySelector('#p-amt').value); if (!amt || amt <= 0) { toast('Enter the amount paid'); return; }
          var rem = Math.max(0, (b.balanceRemaining || 0) - amt);
          var patch = { balanceRemaining: rem };
          if (rem === 0) patch.status = 'paid_off';
          var nd = root.querySelector('#p-next').value; if (nd) patch.dueDate = nd;
          var ops = [{ op: 'update', coll: 'balances', id: b.id, patch: patch }];
          if (root.querySelector('#p-log').checked) {
            var c = catById(b.categoryId) || catById('loan_repayment') || cats('expense')[0];
            ops.push({ op: 'add', coll: 'transactions', item: { id: uid('tx'), kind: 'expense', categoryId: c.id, categoryName: c.name, categoryColor: c.color, amount: amt,
              date: root.querySelector('#p-date').value || todayISO(), note: 'Payment – ' + b.name, recurring: false, addedByName: me, balanceId: b.id, createdAt: new Date().toISOString() } });
          }
          commit(ops); closeSheet(); toast(rem === 0 ? 'Paid off! 🎉' : 'Payment recorded — ' + money(rem) + ' to go');
        });
      });
  }

  /* ---- category ---- */
  function catSheet(c) {
    c = c || null;
    var st = { color: c ? c.color : PALETTE[(db.categories || []).length % PALETTE.length], kind: c ? c.kind : 'expense' };
    var used = c ? txs().some(function (t) { return t.categoryId === c.id; }) : false;
    openSheet(c ? 'Edit category' : 'New category',
      '<div class="field"><label for="ct-name">Name</label><input class="input" id="ct-name" value="' + esc(c ? c.name : '') + '" placeholder="e.g. House help"></div>' +
      (c ? '' : '<div class="seg glass" id="ct-kind" style="margin-bottom:12px"><button data-k="expense" class="on">Expense</button><button data-k="income">Income</button></div>') +
      '<div class="field"><span class="lbl">Colour</span><div class="swatches" id="ct-sw"></div></div>' +
      '<label class="toggle"><span><b>Essential</b><div class="muted sm-txt">Essentials win ties when ranking bills</div></span><span class="switch"><input type="checkbox" id="ct-ess"' + (c && c.essential ? ' checked' : '') + '><span></span></span></label>' +
      '<button class="btn primary wide" id="ct-save">Save</button>' + (c ? '<button class="btn danger wide" id="ct-del" style="margin-top:8px">' + svg('trash') + (used ? 'Delete (entries keep their name)' : 'Delete') + '</button>' : ''),
      function (root) {
        function sw() { root.querySelector('#ct-sw').innerHTML = PALETTE.map(function (p) { return '<button type="button" class="sw' + (p === st.color ? ' on' : '') + '" data-p="' + p + '" style="background:' + p + '" aria-label="' + p + '"></button>'; }).join(''); }
        sw();
        root.querySelector('#ct-sw').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (b) { st.color = b.dataset.p; sw(); } });
        var k = root.querySelector('#ct-kind');
        if (k) k.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; st.kind = b.dataset.k; k.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); });
        root.querySelector('#ct-save').addEventListener('click', function () {
          var name = root.querySelector('#ct-name').value.trim(); if (!name) { toast('Give it a name'); return; }
          commit([{ op: 'add', coll: 'categories', item: { id: c ? c.id : uid('cat'), name: name, kind: st.kind, color: st.color, essential: root.querySelector('#ct-ess').checked, custom: c ? c.custom : true } }]);
          closeSheet(); toast('Saved');
        });
        var del = root.querySelector('#ct-del');
        if (del) del.addEventListener('click', function () { confirmTap(del, function () { commit([{ op: 'remove', coll: 'categories', id: c.id }]); closeSheet(); toast('Category deleted'); }); });
      });
  }

  function askWho() {
    openSheet('Who’s using this phone?',
      '<p class="muted">Entries get tagged with this name so you can see who logged what — and get a ping when the other person adds something.</p>' +
      '<div class="seg glass mt" id="w-pick" style="display:flex"><button data-n="Rotich">Rotich</button><button data-n="Njoki">Njoki</button></div>' +
      '<div class="row gap mt"><input class="input" id="w-other" placeholder="Someone else"><button class="btn ghost" id="w-set">Set</button></div>',
      function (root) {
        root.querySelector('#w-pick').addEventListener('click', function (e) { var b = e.target.closest('[data-n]'); if (b) { setMe(b.dataset.n); closeSheet(); } });
        root.querySelector('#w-set').addEventListener('click', function () { var v = root.querySelector('#w-other').value.trim(); if (v) { setMe(v); closeSheet(); } });
      });
  }

  /* ================= notifications ================= */
  function notify(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(function (r) { r.showNotification(title, { body: body, icon: '/icon-192.png', badge: '/icon-192.png' }); });
      else new Notification(title, { body: body, icon: '/icon-192.png' });
    } catch (e) {}
  }
  function notifyPartnerEntries(prev, next) {
    if (!prev || !me) return;
    var known = {}; (prev.transactions || []).forEach(function (t) { known[t.id] = 1; });
    var fresh = (next.transactions || []).filter(function (t) { return !known[t.id] && t.addedByName && t.addedByName !== me; });
    fresh.slice(0, 3).forEach(function (t) { notify(t.addedByName + ' added an entry', (t.kind === 'income' ? '+' : '−') + money(t.amount).replace('−', '') + ' · ' + t.categoryName); });
    if (fresh.length) toast(fresh[0].addedByName + ' just added ' + fresh.length + ' entr' + (fresh.length === 1 ? 'y' : 'ies'));
  }
  function checkDueReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !db) return;
    var urgent = [];
    billsWithStatus().forEach(function (b) { if (!b.paid && b.daysUntil <= 2) urgent.push({ id: 'b:' + b.id, t: b.categoryName + (b.daysUntil < 0 ? ' is overdue' : b.daysUntil === 0 ? ' is due today' : ' is due soon') }); });
    (db.balances || []).forEach(function (b) {
      if (!b.dueDate || b.status === 'paid_off') return;
      var d = Math.round((new Date(b.dueDate + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
      if (d <= 2) urgent.push({ id: 'l:' + b.id, t: b.name + (d < 0 ? ' is overdue' : d === 0 ? ' is due today' : ' is due soon') });
    });
    var key = LS.notified + todayISO(), seen = loadJSON(key, []);
    var fresh = urgent.filter(function (u) { return seen.indexOf(u.id) < 0; });
    if (fresh.length) { notify('Due soon', fresh.map(function (f) { return f.t; }).slice(0, 4).join('; ')); saveJSON(key, seen.concat(fresh.map(function (f) { return f.id; }))); }
  }

  /* ================= boot ================= */
  function boot() {
    buildNav();
    document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22D3EE"/><stop offset="1" stop-color="#34D399"/></linearGradient></defs></svg>');
    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    show('home');
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () {});
    fetch('/api/auth', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.authed) enterApp(); else { showLock(); if (!j.configured) $('lock-err').textContent = 'Server not configured yet (APP_PIN / SESSION_SECRET).'; }
    }).catch(function () {
      var cached = loadJSON(LS.cache, null);
      if (cached) { db = cached; $('lock').hidden = true; $('app').hidden = false; render(); setSync('off', 'Offline'); }
      else showLock();
    });
    // re-render charts once Chart.js arrives
    var tries = 0; var iv = setInterval(function () { if (window.Chart || ++tries > 40) { clearInterval(iv); if (window.Chart && db && view === 'home') renderHome(); } }, 150);
    setInterval(function () { now = new Date(); }, 60000);
  }
  boot();
})();
