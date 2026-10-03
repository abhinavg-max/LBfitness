-- LB FITNESS database. The server runs this file automatically at start (safe to run again).

CREATE TABLE IF NOT EXISTS members (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  mobile          CHAR(10) NOT NULL UNIQUE,
  photo_public_id TEXT,                       -- Cloudinary id of the member photo (admin only)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per package a member buys. The first row is the joining package, later rows are renewals.
CREATE TABLE IF NOT EXISTS packages (
  id           SERIAL PRIMARY KEY,
  member_id    INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  plan         TEXT NOT NULL CHECK (plan IN ('Open', 'Coached')),
  months       INT  NOT NULL CHECK (months IN (1, 3, 6, 12)),
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,                 -- start_date + months, calculated automatically
  booked_on    DATE NOT NULL,                 -- date the deal was made (used for income stats)
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount > 0)   -- negotiated price
);

-- Every payment taken at the front desk.
CREATE TABLE IF NOT EXISTS payments (
  id        SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount    NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  mode      TEXT NOT NULL CHECK (mode IN ('Cash', 'UPI', 'Card')),
  paid_on   DATE NOT NULL
);

-- Member PIN (hashed) for the member login, and a version number so two admins cannot overwrite each other.
ALTER TABLE members ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
-- Member PIN, encrypted (AES-256-GCM) so the admin can look it up in the member card. Members who were added before
-- this column existed have no stored PIN: set a new one in Edit to save it.
ALTER TABLE members ADD COLUMN IF NOT EXISTS pin_enc TEXT;

-- Safety copy: before a member is edited or deleted, their old packages and payments are saved here for 12 months.
-- No foreign key on purpose, so the copy stays after the member is deleted. PINs are never copied.
CREATE TABLE IF NOT EXISTS change_log (
  id        SERIAL PRIMARY KEY,
  member_id INT,
  action    TEXT NOT NULL,                    -- 'edit' or 'delete'
  snapshot  JSONB NOT NULL,
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS change_log_member_idx ON change_log(member_id);
CREATE INDEX IF NOT EXISTS change_log_at_idx ON change_log(at);

CREATE INDEX IF NOT EXISTS packages_member_idx ON packages(member_id);
CREATE INDEX IF NOT EXISTS payments_member_idx ON payments(member_id);

-- Lock the tables so Supabase's public web API cannot read or change them.
-- The server connects with the database owner role, which is not affected.
ALTER TABLE members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_log ENABLE ROW LEVEL SECURITY;

-- Failed-login lockouts and logged-out admin sessions. Stored here (not in memory) so a server restart does not clear them.
CREATE TABLE IF NOT EXISTS login_lockouts (
  key          TEXT PRIMARY KEY,              -- 'admin' or 'm' + member mobile
  fails        INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        TEXT PRIMARY KEY,                -- id of an admin session that was logged out
  expires_at TIMESTAMPTZ NOT NULL             -- the row is deleted after the session would have expired anyway
);
CREATE INDEX IF NOT EXISTS revoked_tokens_exp_idx ON revoked_tokens(expires_at);
ALTER TABLE login_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE revoked_tokens ENABLE ROW LEVEL SECURITY;
