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

CREATE INDEX IF NOT EXISTS packages_member_idx ON packages(member_id);
CREATE INDEX IF NOT EXISTS payments_member_idx ON payments(member_id);
