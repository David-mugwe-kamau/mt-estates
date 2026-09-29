-- Migration 009 — soft-hide units (unused) for safe maintenance
-- Landlord "remove" hides units; only platform admin permanently deletes.
-- Safe to re-run.

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS is_unused BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS unused_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_units_unused
  ON units(is_unused)
  WHERE is_unused = TRUE;
