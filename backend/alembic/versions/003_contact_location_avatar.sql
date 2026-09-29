-- Migration 003 — contact fields, location coords, listing type, availability badge, avatar
-- Run this in your Supabase SQL Editor

-- ── properties table ─────────────────────────────────────────────────────────

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS listing_type      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS is_published      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS description       TEXT,
  ADD COLUMN IF NOT EXISTS image_url         VARCHAR(500),
  ADD COLUMN IF NOT EXISTS contact_phone     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS contact_whatsapp  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS contact_email     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS latitude          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude         DOUBLE PRECISION;

-- Index for fast location search
CREATE INDEX IF NOT EXISTS idx_properties_listing_type ON properties(listing_type);
CREATE INDEX IF NOT EXISTS idx_properties_is_published ON properties(is_published);

-- ── wishlist_items table ──────────────────────────────────────────────────────

ALTER TABLE wishlist_items
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN;

-- ── users table ───────────────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
