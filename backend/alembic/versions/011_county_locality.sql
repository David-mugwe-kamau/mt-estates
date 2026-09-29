-- Structured Kenya place fields for rental scope search.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS county VARCHAR(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS locality VARCHAR(150);
