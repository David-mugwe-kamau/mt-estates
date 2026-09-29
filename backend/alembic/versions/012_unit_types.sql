-- Apartment types (bedsitter, 1BR, …) with photos on the type, not copied per door.
CREATE TABLE IF NOT EXISTS unit_types (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    category VARCHAR(40) NOT NULL,
    custom_label VARCHAR(100),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_unit_types_property_id ON unit_types (property_id);

ALTER TABLE units ADD COLUMN IF NOT EXISTS unit_type_id INTEGER REFERENCES unit_types(id) ON DELETE SET NULL;

ALTER TABLE property_images ADD COLUMN IF NOT EXISTS unit_type_id INTEGER REFERENCES unit_types(id) ON DELETE SET NULL;

ALTER TABLE properties ADD COLUMN IF NOT EXISTS cover_image_id INTEGER;
