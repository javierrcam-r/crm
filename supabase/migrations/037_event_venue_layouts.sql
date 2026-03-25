-- Venue layout designer for events (sections, seats, stage, etc.)
-- The layout is stored as JSONB for flexible schema evolution.
-- Requires: 026_events_module.sql (creates "events" table)
CREATE TABLE IF NOT EXISTS event_venue_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL DEFAULT 'Principal',
    layout JSONB NOT NULL DEFAULT '{"elements":[]}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_venue_layout_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venue_layout_updated
    BEFORE UPDATE ON event_venue_layouts
    FOR EACH ROW
    EXECUTE FUNCTION update_venue_layout_timestamp();
