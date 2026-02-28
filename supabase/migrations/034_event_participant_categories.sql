-- Categorías de participantes en eventos (e.g., Gold, Silver, Diamante)
-- Se guardan como JSONB en events: [{ "nombre": "DIAMANTE", "cupo": 10 }, { "nombre": "PLATA", "cupo": null }]

ALTER TABLE events ADD COLUMN IF NOT EXISTS categorias_participantes JSONB DEFAULT '[]'::jsonb;

ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS categoria VARCHAR(200);

COMMENT ON COLUMN events.categorias_participantes IS 'Categorías de participantes con cupo opcional: [{"nombre":"Gold","cupo":10}]';
COMMENT ON COLUMN event_participants.categoria IS 'Categoría asignada al participante (e.g., Gold, Silver)';
