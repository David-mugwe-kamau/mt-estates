-- Migration 004 — property gallery images (free tier: up to 6 per listing)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS property_images (
  id          SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_cover    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);
