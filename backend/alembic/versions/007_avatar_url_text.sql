-- Migration 007 — allow base64 profile avatars (phone photos exceed VARCHAR(500))
-- Safe to re-run.

ALTER TABLE users
  ALTER COLUMN avatar_url TYPE TEXT;
