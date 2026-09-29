-- Migration 005 — viewings, billing rates, meter readings, view counts
-- Applied programmatically via pooler; safe to re-run (IF NOT EXISTS)

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS water_rate_per_unit NUMERIC(10,2) DEFAULT 150,
  ADD COLUMN IF NOT EXISTS garbage_fee NUMERIC(10,2) DEFAULT 200,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS main_meter_reading NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS viewing_requests (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferred_date DATE,
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viewing_requests_property ON viewing_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_user ON viewing_requests(user_id);

CREATE TABLE IF NOT EXISTS meter_readings (
  id SERIAL PRIMARY KEY,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  period VARCHAR(7) NOT NULL,
  previous_reading NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_reading NUMERIC(12,2) NOT NULL DEFAULT 0,
  water_units NUMERIC(12,2) NOT NULL DEFAULT 0,
  water_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  garbage_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  rent_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (unit_id, period)
);

CREATE INDEX IF NOT EXISTS idx_meter_readings_unit ON meter_readings(unit_id);
CREATE INDEX IF NOT EXISTS idx_meter_readings_period ON meter_readings(period);
