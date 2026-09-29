-- Migration 006 — arrears carry-forward on monthly statements
-- Mirrors the "Balance" column on the landlord's paper readings sheet:
-- unpaid balance from last month flows into this month's outstanding total.
-- Safe to re-run.

ALTER TABLE meter_readings
  ADD COLUMN IF NOT EXISTS arrears NUMERIC(12,2) NOT NULL DEFAULT 0;
