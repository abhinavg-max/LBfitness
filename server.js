require('dotenv').config();
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const express = require('express'), cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken'), multer = require('multer');
const { Pool } = require('pg');
const helmet = require('helmet');
const { Readable } = require('stream');
const cloudinary = require('cloudinary').v2;

for (const k of ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_MOBILE', 'ADMIN_PASSWORD', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
  if (!process.env[k]) { console.error('Missing ' + k + ' in your .env file. See README.md.'); process.exit(1); }
}
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});
// SSL is on for any database that is not on this computer (Supabase, Neon, Railway, ...).
// Override with DATABASE_SSL=true/false. Add DATABASE_SSL_CA=path/to/ca.crt to also verify the server's identity.
function sslConfig(url) {
  let host = '';
  try { host = new URL(url).hostname; } catch { host = String(url).split('@').pop().split(/[:/?]/)[0]; }
  host = host.replace(/^\[|\]$/g, '');
  const local = ['', 'localhost', '127.0.0.1', '::1'].includes(host);
  const on = process.env.DATABASE_SSL ? process.env.DATABASE_SSL === 'true' : !local;
  if (!on) return false;
  if (process.env.DATABASE_SSL_CA) {
    let ca;
    try { ca = fs.readFileSync(process.env.DATABASE_SSL_CA, 'utf8'); }
    catch (e) { console.error('Cannot read the certificate file DATABASE_SSL_CA=' + process.env.DATABASE_SSL_CA + ' (' + e.message + ').\nCheck the path in .env, or remove DATABASE_SSL_CA.'); process.exit(1); }
    return { ca, rejectUnauthorized: true };
  }
  if (process.env.DATABASE_SSL_VERIFY === 'true') return { rejectUnauthorized: true };
  console.warn('NOTE: the database connection is encrypted but the server identity is not verified. Set DATABASE_SSL_CA (or DATABASE_SSL_VERIFY=true) to verify it.');
  return { rejectUnauthorized: false };
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: sslConfig(process.env.DATABASE_URL) });
pool.on('error', (err) => {
  console.error('Unexpected idle client error in PostgreSQL pool', err);
});

// Safety checks on the settings
for (const k of ['ADMIN_PASSWORD', 'JWT_SECRET']) {
  if (/change-this/i.test(process.env[k])) { console.error(k + ' still has the example value. Set your own value in .env.'); process.exit(1); }
}
if (/YOUR_PASSWORD/.test(process.env.DATABASE_URL)) { console.error('DATABASE_URL still has YOUR_PASSWORD. Put your real database password in .env.'); process.exit(1); }
if (process.env.ADMIN_PASSWORD.length < 12) { console.error('ADMIN_PASSWORD must be 12 or more characters.'); process.exit(1); }
if (process.env.JWT_SECRET.length < 32) { console.error('JWT_SECRET must be 32 or more characters.'); process.exit(1); }
if (process.env.PIN_ENCRYPTION_KEY && process.env.PIN_ENCRYPTION_KEY.length < 32) { console.error('PIN_ENCRYPTION_KEY must be 32 or more characters (or remove it from .env).'); process.exit(1); }
const adminMobile = String(process.env.ADMIN_MOBILE).replace(/\D/g, '').slice(-10);
if (adminMobile.length !== 10 || /^(\d)\1{9}$/.test(adminMobile) || adminMobile === '1234567890') { console.error('ADMIN_MOBILE must be your real 10 digit mobile number.'); process.exit(1); }

const app = express();
app.disable('x-powered-by');
// Set TRUST_PROXY=1 when the site runs behind a host proxy (Render, Railway, Fly...), so each visitor gets their own rate limit.
const behindHost = process.env.TRUST_PROXY || (['RENDER', 'RAILWAY_ENVIRONMENT', 'FLY_APP_NAME', 'DYNO', 'K_SERVICE'].some(k => process.env[k]) ? '1' : '');
if (behindHost) app.set('trust proxy', Number(behindHost) || 1);
else if (process.env.NODE_ENV === 'production') console.warn('WARNING: TRUST_PROXY is not set. Behind a host proxy every visitor shares one login limit.');
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], scriptSrcAttr: ["'none'"],
    styleSrc: ["'self'", 'https://fonts.googleapis.com'], styleSrcAttr: ["'unsafe-inline'"],
    fontSrc: ['https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'blob:'],
    connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"], frameAncestors: ["'self'"], upgradeInsecureRequests: null
  } }
}));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const COOKIE = 'lb_admin';
const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const wrap = f => (req, res, next) => f(req, res, next).catch(next);

// Rate limiter with window cleanup to prevent memory leaks
const hits = new Map();
// scope: count every URL of a route group together (e.g. all member photos) instead of each URL on its own.
const limit = (max, windowMs = 60000, scope = '') => (req, res, next) => {
  const key = req.ip + (scope || req.path), now = Date.now();
  const list = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (list.length >= max) {
    return res.status(429).json({ error: 'Too many attempts. Wait a minute and try again.' });
  }
  list.push(now);
  hits.set(key, list);
  next();
};

// Periodic cleanup of stale rate limiter entries
setInterval(() => {
  const now = Date.now();
  for (const [key, list] of hits.entries()) {
    const fresh = list.filter(t => now - t < 60000);
    if (fresh.length === 0) hits.delete(key);
    else hits.set(key, fresh);
  }
}, 60000).unref();

const safeEq = (a, b) => {
  const hashA = crypto.createHash('sha256').update(String(a || '')).digest();
  const hashB = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(hashA, hashB);
};

// Failed-login lockouts and logged-out admin sessions are kept in the database, so a server restart does not clear them.
// A lock lasts `ms` after the `max`-th wrong try. The counter starts again 15 minutes after the last wrong try.
const lockedOut = async k => (await pool.query('SELECT 1 FROM login_lockouts WHERE key=$1 AND locked_until > now()', [k])).rowCount > 0;
async function noteFail(k, max, ms) {
  const { rows } = await pool.query(`
    INSERT INTO login_lockouts(key, fails, locked_until, updated_at) VALUES($1, 1, NULL, now())
    ON CONFLICT (key) DO UPDATE SET
      fails        = CASE WHEN (login_lockouts.locked_until IS NOT NULL AND login_lockouts.locked_until <= now()) OR login_lockouts.updated_at < now() - interval '15 minutes'
                          THEN 1 ELSE login_lockouts.fails + 1 END,
      locked_until = CASE WHEN (login_lockouts.locked_until IS NOT NULL AND login_lockouts.locked_until <= now()) OR login_lockouts.updated_at < now() - interval '15 minutes'
                          THEN NULL ELSE login_lockouts.locked_until END,
      updated_at   = now()
    RETURNING fails`, [k]);
  if (rows[0].fails >= max) await pool.query('UPDATE login_lockouts SET locked_until = now() + make_interval(secs => $2::float8) WHERE key=$1', [k, ms / 1000]);
}
const clearFail = k => pool.query('DELETE FROM login_lockouts WHERE key=$1', [k]);
async function purge() { // expired sessions and old counters are removed (also runs every hour)
  await pool.query('DELETE FROM revoked_tokens WHERE expires_at < now()');
  await pool.query("DELETE FROM login_lockouts WHERE updated_at < now() - interval '1 day'");
}
setInterval(() => purge().catch(e => console.error('Cleanup failed:', e.message)), 3600000).unref();

// Member PINs are stored twice: hashed (used to check a login) and encrypted (so the admin can look a PIN up in the member card).
// The encryption key comes from PIN_ENCRYPTION_KEY, or from JWT_SECRET when that is not set.
const PIN_KEY = crypto.createHash('sha256').update('lb-fitness-pin-key:' + (process.env.PIN_ENCRYPTION_KEY || process.env.JWT_SECRET)).digest();
const encryptPin = pin => {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', PIN_KEY, iv);
  const enc = Buffer.concat([c.update(String(pin), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map(x => x.toString('base64')).join('.');
};
const decryptPin = stored => { // null when it cannot be read (wrong key, damaged value)
  try {
    const [iv, tag, enc] = String(stored || '').split('.').map(x => Buffer.from(x, 'base64'));
    if (!iv || !tag || !enc || iv.length !== 12 || tag.length !== 16) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', PIN_KEY, iv); d.setAuthTag(tag);
    const pin = Buffer.concat([d.update(enc), d.final()]).toString('utf8');
    return /^\d{4,6}$/.test(pin) ? pin : null;
  } catch { return null; }
};
const hashPin = pin => { const salt = crypto.randomBytes(16); return salt.toString('hex') + ':' + crypto.scryptSync(String(pin), salt, 32).toString('hex'); };
const checkPin = (pin, stored) => {
  const [s, h] = String(stored || '').split(':');
  if (!s || !h) return false;
  const a = crypto.scryptSync(String(pin), Buffer.from(s, 'hex'), 32), b = Buffer.from(h, 'hex');
  return b.length === 32 && crypto.timingSafeEqual(a, b);
};
const DUMMY_PIN = hashPin('0000'); // used so unknown numbers take as long as real ones

async function auth(req, res, next) {
  let p;
  try { p = jwt.verify(req.cookies[COOKIE] || '', process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Please sign in again.' }); }
  try {
    const gone = !p.jti || (await pool.query('SELECT 1 FROM revoked_tokens WHERE jti=$1', [p.jti])).rowCount > 0;
    if (gone) return res.status(401).json({ error: 'Please sign in again.' });
  } catch (e) { return next(e); } // database problem: a server error, not "sign in again"
  next();
}
// Member photos are stored as private ("authenticated") Cloudinary images and only
// ever sent to the admin panel as signed links. The member panel never receives them.
const photoUrl = id => id ? cloudinary.url(id, {
  type: 'authenticated', sign_url: true, secure: true, resource_type: 'image',
  transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
}) : null;

async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
  finally { c.release(); }
}

/* ---------- login ---------- */
app.post('/api/admin/login', limit(10), wrap(async (req, res) => {
  if (await lockedOut('admin')) return res.status(429).json({ error: 'Too many wrong attempts. Try again in 15 minutes.' });
  const { mobile, password } = req.body || {};
  const ok = safeEq(String(mobile || '').replace(/\D/g, '').slice(-10), String(process.env.ADMIN_MOBILE).replace(/\D/g, '').slice(-10))
          && safeEq(password || '', process.env.ADMIN_PASSWORD);
  if (!ok) { await noteFail('admin', 30, 15 * 60000); return res.status(401).json({ error: 'Wrong mobile number or password.' }); }
  await clearFail('admin');
  const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '12h', jwtid: crypto.randomUUID() });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', maxAge: 12 * 3600 * 1000 });
  res.json({ ok: true });
}));
app.post('/api/admin/logout', wrap(async (req, res) => {
  let p = null;
  try { p = jwt.verify(req.cookies[COOKIE] || '', process.env.JWT_SECRET); } catch {} // already expired or invalid: nothing to revoke
  if (p && p.jti) await pool.query('INSERT INTO revoked_tokens(jti, expires_at) VALUES($1, to_timestamp($2::float8)) ON CONFLICT (jti) DO NOTHING', [p.jti, p.exp]);
  res.clearCookie(COOKIE); res.json({ ok: true });
}));

// Member login: mobile number + PIN set by the front desk. Returns only the basics (no payments, no photo).
app.post('/api/member/login', limit(20), wrap(async (req, res) => {
  const body = req.body || {};
  const mobile = String(body.mobile || '').replace(/\D/g, '').slice(-10);
  const pin = body.pin == null ? '' : String(body.pin).trim(); // digits only: "12ab34" is rejected, not turned into "1234"
  if (mobile.length !== 10 || !/^\d{4,6}$/.test(pin)) throw bad('Enter your 10 digit mobile number and your 4 to 6 digit PIN (numbers only).');
  const lockKey = 'm' + mobile;
  if (await lockedOut(lockKey)) throw bad('Too many wrong attempts. Try again in 15 minutes or ask the front desk.', 429);
  const { rows } = await pool.query(`
    SELECT m.pin_hash, m.name, m.mobile, p.plan, p.months,
           to_char(p.start_date,'YYYY-MM-DD') AS start, to_char(p.end_date,'YYYY-MM-DD') AS exp,
           (SELECT to_char(min(start_date),'YYYY-MM-DD') FROM packages WHERE member_id = m.id) AS joined
    FROM members m
    JOIN LATERAL (SELECT * FROM packages WHERE member_id = m.id ORDER BY start_date DESC, id DESC LIMIT 1) p ON true
    WHERE m.mobile = $1`, [mobile]);
  const row = rows[0];
  const good = checkPin(pin, row ? row.pin_hash : DUMMY_PIN) && !!row; // same work and same message whether or not the number exists
  if (!good) { await noteFail(lockKey, 5, 15 * 60000); throw bad('Wrong mobile number or PIN. If you have no PIN yet, ask the front desk.', 401); }
  await clearFail(lockKey);
  delete row.pin_hash;
  res.json(row);
}));

/* ---------- admin: members ---------- */
const D = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MONEY = 99999999.99, MAX_ID = 2147483647; // NUMERIC(10,2) and INTEGER limits in PostgreSQL
// A real calendar date (2026-02-31 matches the pattern but does not exist).
const realDate = s => {
  if (typeof s !== 'string' || !D.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (y < 2000 || y > 2100) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
// An amount above 0 and within the database limit, rounded to paise. Returns null when it is not valid.
const money = v => {
  const n = (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const c = Math.round(n * 100) / 100;
  return c > 0 && c <= MAX_MONEY ? c : null;
};
// Id of an existing package or payment row (empty for a new row).
const rowId = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > MAX_ID) throw bad('Invalid package or payment. Reload the page and try again.');
  return n;
};
// Member id from the URL, checked so a huge number cannot reach the database.
const memberId = req => {
  const s = String(req.params.id), n = Number(s);
  if (!/^\d+$/.test(s) || !Number.isSafeInteger(n) || n < 1 || n > MAX_ID) throw bad('Member not found.', 404);
  return n;
};
function clean(b = {}) {
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const mobile = String(b.mobile || '').replace(/\D/g, '').slice(-10);
  if (!name) throw bad('Enter the member name.');
  if (name.length > 80) throw bad('Name must be 80 characters or fewer.');
  const pin = b.pin === null || b.pin === undefined ? '' : String(b.pin).trim(); // digits only: "12ab34" is rejected, not turned into "1234"
  if (pin && !/^\d{4,6}$/.test(pin)) throw bad('PIN must be 4 to 6 digits (numbers only).');
  if (mobile.length !== 10) throw bad('Enter a valid 10 digit mobile number.');
  const rawTerms = Array.isArray(b.terms) ? b.terms : [], rawPays = Array.isArray(b.pays) ? b.pays : [];
  if (!rawTerms.length) throw bad('At least one package is required.');
  if (rawTerms.length > 100 || rawPays.length > 500) throw bad('Too many packages or payments.');
  const terms = rawTerms.map(t => {
    if (!t || typeof t !== 'object') throw bad('Invalid package details.');
    const months = Number(t.months), total = money(t.total), start = t.start, at = t.at || t.start;
    if (!['Open', 'Coached'].includes(t.plan) || ![1, 3, 6, 12].includes(months) || !realDate(start) || !realDate(at)) throw bad('Invalid package details (check the dates).');
    if (total === null) throw bad('Each package fee must be above 0 and below 1,00,00,000.');
    return { id: rowId(t.id), plan: t.plan, months, start, at, total };
  });
  const pays = rawPays.map(p => {
    if (!p || typeof p !== 'object') throw bad('Invalid payment details.');
    const a = money(p.a);
    if (!realDate(p.d) || !['Cash', 'UPI', 'Card'].includes(p.m)) throw bad('Invalid payment details (check the date).');
    if (a === null) throw bad('Each payment must be above 0 and below 1,00,00,000.');
    return { id: rowId(p.id), a, m: p.m, d: p.d };
  });
  const cents = x => Math.round(x * 100);
  const fee = terms.reduce((s, t) => s + cents(t.total), 0), paid = pays.reduce((s, p) => s + cents(p.a), 0);
  if (paid > fee) throw bad('Total paid cannot be more than the total fee.');
  const v = typeof b.version === 'number' || (typeof b.version === 'string' && b.version !== '') ? Number(b.version) : NaN;
  return { name, mobile, terms, pays, pin, version: Number.isInteger(v) && v >= 1 && v <= MAX_ID ? v : null };
}
// Before a member is edited or deleted, a copy of their packages and payments goes into change_log
// (kept 12 months, see schema.sql). If something is ever changed by mistake, the old rows are still there.
async function snapshot(c, id, action) {
  const m = (await c.query('SELECT id, name, mobile FROM members WHERE id=$1', [id])).rows[0];
  if (!m) return;
  const pk = (await c.query(`SELECT id, plan, months, to_char(start_date,'YYYY-MM-DD') AS start_date, to_char(end_date,'YYYY-MM-DD') AS end_date,
                                    to_char(booked_on,'YYYY-MM-DD') AS booked_on, total_amount FROM packages WHERE member_id=$1 ORDER BY id`, [id])).rows;
  const py = (await c.query(`SELECT id, amount, mode, to_char(paid_on,'YYYY-MM-DD') AS paid_on FROM payments WHERE member_id=$1 ORDER BY id`, [id])).rows;
  await c.query('INSERT INTO change_log(member_id, action, snapshot) VALUES($1, $2, $3)', [id, action, JSON.stringify({ member: m, packages: pk, payments: py })]);
}
async function saveMember(c, id, d) {
  if (id) {
    // Lock the member row, then make sure nobody else saved in the meantime.
    const cur = (await c.query('SELECT version FROM members WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!cur) throw bad('Member not found.', 404);
    if (cur.version !== d.version) throw bad('Someone else changed this member. The latest data was loaded, please redo your change.', 409);
    await snapshot(c, id, 'edit');
    await c.query('UPDATE members SET name=$1, mobile=$2, pin_hash=COALESCE($4, pin_hash), pin_enc=COALESCE($5, pin_enc), version=version+1 WHERE id=$3',
      [d.name, d.mobile, id, d.pin ? hashPin(d.pin) : null, d.pin ? encryptPin(d.pin) : null]);
    // Rows keep their ids: existing ones are updated, new ones added, and only rows the admin removed are deleted.
    const havePk = new Set((await c.query('SELECT id FROM packages WHERE member_id=$1', [id])).rows.map(r => r.id));
    const havePy = new Set((await c.query('SELECT id FROM payments WHERE member_id=$1', [id])).rows.map(r => r.id));
    const keepPk = new Set(), keepPy = new Set();
    for (const t of d.terms) {
      if (t.id === null) {
        await c.query(`INSERT INTO packages(member_id, plan, months, start_date, end_date, booked_on, total_amount)
                       VALUES($1, $2, $3::int, $4::date, ($4::date + make_interval(months => $3::int))::date, $5::date, $6)`,
          [id, t.plan, t.months, t.start, t.at, t.total]);
      } else {
        if (!havePk.has(t.id) || keepPk.has(t.id)) throw bad('This member was changed by someone else. Reload the page and try again.', 409);
        keepPk.add(t.id);
        await c.query(`UPDATE packages SET plan=$1, months=$2::int, start_date=$3::date, end_date=($3::date + make_interval(months => $2::int))::date,
                              booked_on=$4::date, total_amount=$5 WHERE id=$6 AND member_id=$7`,
          [t.plan, t.months, t.start, t.at, t.total, t.id, id]);
      }
    }
    for (const p of d.pays) {
      if (p.id === null) {
        await c.query('INSERT INTO payments(member_id, amount, mode, paid_on) VALUES($1,$2,$3,$4::date)', [id, p.a, p.m, p.d]);
      } else {
        if (!havePy.has(p.id) || keepPy.has(p.id)) throw bad('This member was changed by someone else. Reload the page and try again.', 409);
        keepPy.add(p.id);
        await c.query('UPDATE payments SET amount=$1, mode=$2, paid_on=$3::date WHERE id=$4 AND member_id=$5', [p.a, p.m, p.d, p.id, id]);
      }
    }
    const dropPk = [...havePk].filter(x => !keepPk.has(x)), dropPy = [...havePy].filter(x => !keepPy.has(x));
    if (dropPk.length) await c.query('DELETE FROM packages WHERE member_id=$1 AND id = ANY($2::int[])', [id, dropPk]);
    if (dropPy.length) await c.query('DELETE FROM payments WHERE member_id=$1 AND id = ANY($2::int[])', [id, dropPy]);
  } else {
    id = (await c.query('INSERT INTO members(name, mobile, pin_hash, pin_enc) VALUES($1,$2,$3,$4) RETURNING id', [d.name, d.mobile, hashPin(d.pin), encryptPin(d.pin)])).rows[0].id;
    for (const t of d.terms) {
      await c.query(`INSERT INTO packages(member_id, plan, months, start_date, end_date, booked_on, total_amount)
                     VALUES($1, $2, $3::int, $4::date, ($4::date + make_interval(months => $3::int))::date, $5::date, $6)`,
        [id, t.plan, t.months, t.start, t.at, t.total]);
    }
    for (const p of d.pays) {
      await c.query('INSERT INTO payments(member_id, amount, mode, paid_on) VALUES($1,$2,$3,$4::date)', [id, p.a, p.m, p.d]);
    }
  }
  return id;
}

// Photos are streamed through the server so only a signed-in admin can ever see them (no shareable links).
const photoLink = (mid, pid) => pid ? '/api/admin/members/' + mid + '/photo?v=' + crypto.createHash('sha1').update(pid).digest('hex').slice(0, 8) : null;
// Photo requests wait at most 10 seconds for Cloudinary, and only a few run at the same time, so a slow Cloudinary
// cannot tie up the server. The list can ask for many photos at once: extra requests wait their turn in a queue.
const PHOTO_TIMEOUT_MS = 10000, PHOTO_MAX_PARALLEL = 8, PHOTO_MAX_QUEUE = 300;
let photoActive = 0;
const photoQueue = [];
const photoSlot = () => new Promise((ok, no) => {
  if (photoActive < PHOTO_MAX_PARALLEL) { photoActive++; return ok(); }
  if (photoQueue.length >= PHOTO_MAX_QUEUE) return no(bad('Too many photos requested at once. Try again in a moment.', 503));
  photoQueue.push(ok);
});
const photoFree = () => { const next = photoQueue.shift(); if (next) next(); else photoActive--; };
app.get('/api/admin/members/:id/photo', auth, limit(600, 60000, 'photo'), wrap(async (req, res) => {
  const id = memberId(req);
  const row = (await pool.query('SELECT photo_public_id FROM members WHERE id=$1', [id])).rows[0];
  if (!row || !row.photo_public_id) throw bad('No photo.', 404);
  await photoSlot();
  let freed = false;
  const free = () => { if (!freed) { freed = true; photoFree(); } };
  res.on('close', free); // the slot is given back when the response is finished or the browser went away
  try {
    if (res.destroyed || req.socket.destroyed) return free(); // the browser gave up while waiting in the queue
    let r;
    try { r = await fetch(photoUrl(row.photo_public_id), { signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS) }); }
    catch (e) {
      if (e && e.name === 'TimeoutError') throw bad('The photo took too long to load. Try again.', 504);
      throw bad('Photo not available.', 502);
    }
    if (!r.ok) { if (r.body) r.body.cancel().catch(() => {}); throw bad('Photo not available.', 502); }
    res.set({ 'Content-Type': r.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'private, max-age=86400' });
    const stream = Readable.fromWeb(r.body);
    stream.on('error', () => res.destroy()); // also happens when the 10 second limit is reached while the image is downloading
    stream.pipe(res);
  } catch (e) { free(); throw e; }
}));
app.get('/api/admin/members/:id/pin', auth, limit(60, 60000, 'pin'), wrap(async (req, res) => {
  const id = memberId(req);
  const row = (await pool.query('SELECT pin_enc FROM members WHERE id=$1', [id])).rows[0];
  if (!row) throw bad('Member not found.', 404);
  res.json({ pin: row.pin_enc ? decryptPin(row.pin_enc) : null }); // null: not saved yet, or cannot be read with the current key
}));
app.get('/api/admin/members', auth, wrap(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT m.id, m.name, m.mobile, m.photo_public_id, m.version, (m.pin_hash IS NOT NULL) AS has_pin, (m.pin_enc IS NOT NULL) AS pin_stored,
      COALESCE((SELECT json_agg(json_build_object('id', p.id, 'plan', p.plan, 'months', p.months,
                 'start', to_char(p.start_date,'YYYY-MM-DD'), 'at', to_char(p.booked_on,'YYYY-MM-DD'), 'total', p.total_amount::float8)
                 ORDER BY p.start_date, p.id) FROM packages p WHERE p.member_id = m.id), '[]') AS terms,
      COALESCE((SELECT json_agg(json_build_object('id', y.id, 'd', to_char(y.paid_on,'YYYY-MM-DD'), 'a', y.amount::float8, 'm', y.mode)
                 ORDER BY y.paid_on, y.id) FROM payments y WHERE y.member_id = m.id), '[]') AS pays
    FROM members m ORDER BY m.created_at DESC, m.id DESC`);
  res.json(rows.map(r => ({ id: r.id, name: r.name, mobile: r.mobile, photo: photoLink(r.id, r.photo_public_id), version: r.version, hasPin: r.has_pin, pinStored: r.pin_stored, terms: r.terms, pays: r.pays })));
}));
app.post('/api/admin/members', auth, wrap(async (req, res) => {
  const d = clean(req.body);
  if (!d.pin) throw bad('Set a 4 to 6 digit PIN for the member.');
  const id = await tx(c => saveMember(c, null, d));
  res.json({ id });
}));
app.put('/api/admin/members/:id', auth, wrap(async (req, res) => {
  const id = memberId(req);
  const d = clean(req.body);
  if (d.version === null) throw bad('Please reload the page and try again.');
  await tx(c => saveMember(c, id, d));
  if (d.pin) await clearFail('m' + d.mobile); // a new PIN also lifts a lockout
  res.json({ ok: true });
}));

/* ---------- admin: photo (Cloudinary) ---------- */
const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, f, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(f.mimetype))
});
app.post('/api/admin/members/:id/photo', auth, limit(15), upload.single('photo'), wrap(async (req, res) => {
  const id = memberId(req);
  if (!req.file) throw bad('Choose a JPG, PNG or WebP photo (max 5 MB).');
  const old = (await pool.query('SELECT photo_public_id FROM members WHERE id=$1', [id])).rows[0];
  if (!old) throw bad('Member not found.', 404);
  let result;
  try {
    result = await new Promise((ok, no) => cloudinary.uploader.upload_stream(
      { folder: 'lb-fitness/members', type: 'authenticated', resource_type: 'image', timeout: 20000 },
      (e, r) => e ? no(e) : ok(r)).end(req.file.buffer));
  } catch (e) {
    console.error('Cloudinary upload failed:', (e && e.message) || e);
    if (e && e.http_code === 499) throw bad('Saving the photo took too long. Try again.', 504);
    throw bad('The photo could not be saved. Try again. If it keeps failing, check the Cloudinary settings in .env.', 502);
  }
  await pool.query('UPDATE members SET photo_public_id=$1 WHERE id=$2', [result.public_id, id]);
  if (old.photo_public_id) cloudinary.uploader.destroy(old.photo_public_id, { type: 'authenticated' }).catch(() => {});
  res.json({ photo: photoLink(id, result.public_id) });
}));

app.delete('/api/admin/members/:id', auth, wrap(async (req, res) => {
  const id = memberId(req);
  const photoId = await tx(async c => {
    await snapshot(c, id, 'delete'); // a copy is kept in change_log
    const r = await c.query('DELETE FROM members WHERE id=$1 RETURNING photo_public_id', [id]); // packages and payments go with it
    if (!r.rowCount) throw bad('Member not found.', 404);
    return r.rows[0].photo_public_id;
  });
  if (photoId) cloudinary.uploader.destroy(photoId, { type: 'authenticated' }).catch(() => {});
  res.json({ ok: true });
}));
app.delete('/api/admin/members/:id/photo', auth, wrap(async (req, res) => {
  const id = memberId(req);
  const old = (await pool.query('SELECT photo_public_id FROM members WHERE id=$1', [id])).rows[0];
  if (!old) throw bad('Member not found.', 404);
  await pool.query('UPDATE members SET photo_public_id=NULL WHERE id=$1', [id]);
  if (old.photo_public_id) cloudinary.uploader.destroy(old.photo_public_id, { type: 'authenticated' }).catch(() => {});
  res.json({ ok: true });
}));

/* ---------- errors ---------- */
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
// PostgreSQL rejected a value that slipped past the checks above: answer with a clear message instead of "Server error".
const DB_BAD_INPUT = {
  '22003': 'A number is too large or too small.',
  '22007': 'A date is not valid.',
  '22008': 'A date is not valid.',
  '22P02': 'Some of the details are not valid.',
  '23514': 'Some of the details are not valid.'
};
app.use((e, req, res, next) => {
  if (res.headersSent) return next(e);
  if (e.code === '23505') return res.status(409).json({ error: 'This mobile number is already registered.' });
  if (e instanceof multer.MulterError) {
    return res.status(400).json({ error: e.code === 'LIMIT_FILE_SIZE' ? 'Photo is too large (max 5 MB).' : 'Could not read the photo. Choose one JPG, PNG or WebP photo (max 5 MB).' });
  }
  if (e.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request could not be read. Reload the page and try again.' });
  if (e.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large.' });
  if (DB_BAD_INPUT[e.code]) return res.status(400).json({ error: DB_BAD_INPUT[e.code] });
  if (e.status) return res.status(e.status).json({ error: e.message });
  console.error(e);
  res.status(500).json({ error: 'Server error. Check the server window for details.' });
});

const PORT = process.env.PORT || 3000;
// schema.sql is safe to re-run. For future changes, add numbered files to /migrations (001_name.sql, 002_...);
// each runs once, in order, and is remembered in the schema_migrations table.
async function migrate() {
  try { await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')); }
  catch (e) { e.message = 'schema.sql: ' + e.message; throw e; }
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const dir = path.join(__dirname, 'migrations');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.sql$/.test(f)).sort() : [];
  for (const f of files) {
    if ((await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [f])).rowCount) continue;
    try { await tx(async c => { await c.query(fs.readFileSync(path.join(dir, f), 'utf8')); await c.query('INSERT INTO schema_migrations(name) VALUES($1)', [f]); }); }
    catch (e) { e.message = 'migrations/' + f + ': ' + e.message; throw e; }
    console.log('Applied migration ' + f);
  }
  await pool.query("DELETE FROM change_log WHERE at < now() - interval '12 months'"); // old safety copies are removed after a year
  await purge();
}
async function start() {
  try { await pool.query('SELECT 1'); }
  catch (e) { console.error('Could not connect to the database: ' + e.message + '\nCheck DATABASE_URL in .env and that PostgreSQL is running.'); process.exit(1); }
  try { await migrate(); }
  catch (e) { console.error('Connected to the database, but setting up the tables failed: ' + e.message + '\nThe server did not start. Fix the problem named above and start again.'); process.exit(1); }
  const server = app.listen(PORT, () => console.log('LB FITNESS running at http://localhost:' + PORT));
  server.on('error', e => {
    console.error(e.code === 'EADDRINUSE' ? 'Port ' + PORT + ' is already in use. Close the other program or change PORT in .env.' : 'Could not start the web server: ' + e.message);
    process.exit(1);
  });
}
start();
