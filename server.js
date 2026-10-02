require('dotenv').config();
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const express = require('express'), cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken'), multer = require('multer');
const { Pool } = require('pg');
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
const isRemoteDb = /supabase|aws|render|neon|fly/i.test(process.env.DATABASE_URL || '');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false
});
const app = express();
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const COOKIE = 'lb_admin';
const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const wrap = f => (req, res, next) => f(req, res, next).catch(next);

// simple login rate limit: max N tries per minute per address
const hits = new Map();
const limit = max => (req, res, next) => {
  const key = req.ip + req.path, now = Date.now();
  const list = (hits.get(key) || []).filter(t => now - t < 60000);
  if (list.length >= max) return res.status(429).json({ error: 'Too many attempts. Wait a minute and try again.' });
  list.push(now); hits.set(key, list); next();
};
const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
function auth(req, res, next) {
  try { jwt.verify(req.cookies[COOKIE] || '', process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Please sign in again.' }); }
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
app.post('/api/admin/login', limit(10), (req, res) => {
  const { mobile, password } = req.body || {};
  const ok = safeEq(String(mobile || '').replace(/\D/g, '').slice(-10), String(process.env.ADMIN_MOBILE).replace(/\D/g, '').slice(-10))
          && safeEq(password || '', process.env.ADMIN_PASSWORD);
  if (!ok) return res.status(401).json({ error: 'Wrong mobile number or password.' });
  const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', maxAge: 12 * 3600 * 1000 });
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie(COOKIE); res.json({ ok: true }); });

// Member login: mobile number only. Returns only the basics (no payments, no photo).
app.post('/api/member/login', limit(20), wrap(async (req, res) => {
  const mobile = String((req.body || {}).mobile || '').replace(/\D/g, '').slice(-10);
  if (mobile.length !== 10) throw bad('Enter your 10 digit mobile number.');
  const { rows } = await pool.query(`
    SELECT m.name, m.mobile, p.plan, p.months,
           to_char(p.start_date,'YYYY-MM-DD') AS start, to_char(p.end_date,'YYYY-MM-DD') AS exp,
           (SELECT to_char(min(start_date),'YYYY-MM-DD') FROM packages WHERE member_id = m.id) AS joined
    FROM members m
    JOIN LATERAL (SELECT * FROM packages WHERE member_id = m.id ORDER BY start_date DESC, id DESC LIMIT 1) p ON true
    WHERE m.mobile = $1`, [mobile]);
  if (!rows.length) throw bad('This mobile number is not registered. Please visit the front desk.', 404);
  res.json(rows[0]);
}));

/* ---------- admin: members ---------- */
const D = /^\d{4}-\d{2}-\d{2}$/;
function clean(b = {}) {
  const name = String(b.name || '').trim();
  const mobile = String(b.mobile || '').replace(/\D/g, '').slice(-10);
  if (!name || name.length > 80) throw bad('Enter the member name.');
  if (mobile.length !== 10) throw bad('Enter a valid 10 digit mobile number.');
  const terms = Array.isArray(b.terms) ? b.terms : [], pays = Array.isArray(b.pays) ? b.pays : [];
  if (!terms.length) throw bad('At least one package is required.');
  for (const t of terms) {
    if (!['Open', 'Coached'].includes(t.plan) || ![1, 3, 6, 12].includes(+t.months) || !D.test(t.start) || !D.test(t.at || t.start) || !(+t.total > 0))
      throw bad('Invalid package details.');
  }
  for (const p of pays) {
    if (!(+p.a > 0) || !D.test(p.d) || !['Cash', 'UPI', 'Card'].includes(p.m)) throw bad('Invalid payment details.');
  }
  const fee = terms.reduce((s, t) => s + +t.total, 0), paid = pays.reduce((s, p) => s + +p.a, 0);
  if (paid > fee + 0.001) throw bad('Total paid cannot be more than the total fee.');
  return { name, mobile, terms, pays };
}
async function saveMember(c, id, d) {
  if (id) {
    const r = await c.query('UPDATE members SET name=$1, mobile=$2 WHERE id=$3', [d.name, d.mobile, id]);
    if (!r.rowCount) throw bad('Member not found.', 404);
    await c.query('DELETE FROM packages WHERE member_id=$1', [id]);
    await c.query('DELETE FROM payments WHERE member_id=$1', [id]);
  } else {
    id = (await c.query('INSERT INTO members(name, mobile) VALUES($1,$2) RETURNING id', [d.name, d.mobile])).rows[0].id;
  }
  for (const t of d.terms) {
    await c.query(`INSERT INTO packages(member_id, plan, months, start_date, end_date, booked_on, total_amount)
                   VALUES($1, $2, $3::int, $4::date, ($4::date + make_interval(months => $3::int))::date, $5::date, $6)`,
      [id, t.plan, +t.months, t.start, t.at || t.start, +t.total]);
  }
  for (const p of d.pays) {
    await c.query('INSERT INTO payments(member_id, amount, mode, paid_on) VALUES($1,$2,$3,$4::date)', [id, +p.a, p.m, p.d]);
  }
  return id;
}

app.get('/api/admin/members', auth, wrap(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT m.id, m.name, m.mobile, m.photo_public_id,
      COALESCE((SELECT json_agg(json_build_object('id', p.id, 'plan', p.plan, 'months', p.months,
                 'start', to_char(p.start_date,'YYYY-MM-DD'), 'at', to_char(p.booked_on,'YYYY-MM-DD'), 'total', p.total_amount::float8)
                 ORDER BY p.start_date, p.id) FROM packages p WHERE p.member_id = m.id), '[]') AS terms,
      COALESCE((SELECT json_agg(json_build_object('id', y.id, 'd', to_char(y.paid_on,'YYYY-MM-DD'), 'a', y.amount::float8, 'm', y.mode)
                 ORDER BY y.paid_on, y.id) FROM payments y WHERE y.member_id = m.id), '[]') AS pays
    FROM members m ORDER BY m.created_at DESC, m.id DESC`);
  res.json(rows.map(r => ({ id: r.id, name: r.name, mobile: r.mobile, photo: photoUrl(r.photo_public_id), terms: r.terms, pays: r.pays })));
}));
app.post('/api/admin/members', auth, wrap(async (req, res) => {
  const id = await tx(c => saveMember(c, null, clean(req.body)));
  res.json({ id });
}));
app.put('/api/admin/members/:id', auth, wrap(async (req, res) => {
  const id = +req.params.id;
  if (!Number.isInteger(id)) throw bad('Member not found.', 404);
  await tx(c => saveMember(c, id, clean(req.body)));
  res.json({ ok: true });
}));

/* ---------- admin: photo (Cloudinary) ---------- */
const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, f, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(f.mimetype))
});
app.post('/api/admin/members/:id/photo', auth, upload.single('photo'), wrap(async (req, res) => {
  const id = +req.params.id;
  if (!req.file) throw bad('Choose a JPG, PNG or WebP photo (max 5 MB).');
  const old = (await pool.query('SELECT photo_public_id FROM members WHERE id=$1', [id])).rows[0];
  if (!old) throw bad('Member not found.', 404);
  const result = await new Promise((ok, no) => cloudinary.uploader.upload_stream(
    { folder: 'lb-fitness/members', type: 'authenticated', resource_type: 'image' },
    (e, r) => e ? no(e) : ok(r)).end(req.file.buffer));
  await pool.query('UPDATE members SET photo_public_id=$1 WHERE id=$2', [result.public_id, id]);
  if (old.photo_public_id) cloudinary.uploader.destroy(old.photo_public_id, { type: 'authenticated' }).catch(() => {});
  res.json({ photo: photoUrl(result.public_id) });
}));

/* ---------- errors ---------- */
app.use((e, req, res, next) => {
  if (e.code === '23505') return res.status(409).json({ error: 'This mobile number is already registered.' });
  if (e.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Photo is too large (max 5 MB).' });
  if (e.status) return res.status(e.status).json({ error: e.message });
  console.error(e);
  res.status(500).json({ error: 'Server error. Check the server window for details.' });
});

const PORT = process.env.PORT || 3000;
pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'))
  .then(() => app.listen(PORT, () => console.log('LB FITNESS running at http://localhost:' + PORT)))
  .catch(e => { console.error('Could not connect to the database: ' + e.message + '\nCheck DATABASE_URL in .env and that PostgreSQL is running.'); process.exit(1); });
