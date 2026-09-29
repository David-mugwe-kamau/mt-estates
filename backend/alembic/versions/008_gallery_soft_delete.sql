-- Migration 008 — soft-hide gallery images (unused) for safe maintenance
-- Landlord "remove" hides photos; only platform admin permanently deletes.
-- Safe to re-run.

ALTER TABLE property_images
  ADD COLUMN IF NOT EXISTS is_unused BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE property_images
  ADD COLUMN IF NOT EXISTS unused_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_property_images_unused
  ON property_images(is_unused)
  WHERE is_unused = TRUE;
