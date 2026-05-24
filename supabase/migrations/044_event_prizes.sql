-- =============================================================
-- 044: Ruleta de premios para eventos + rol "ruleta"
-- =============================================================

-- 1) Agregar rol "ruleta" al constraint de users_profile
ALTER TABLE users_profile DROP CONSTRAINT IF EXISTS users_profile_rol_check;

ALTER TABLE users_profile ADD CONSTRAINT users_profile_rol_check
    CHECK (rol IN (
        'admin',
        'vendedor',
        'supervisor',
        'supervisor_nivel1',
        'supervisor_vendedor',
        'vendedor_tecnico',
        'marketing',
        'tecnico',
        'event_assistant',
        'ruleta'
    ));

-- 2) Tabla de premios configurados por evento
CREATE TABLE IF NOT EXISTS event_prizes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    nombre      text NOT NULL,
    descripcion text,
    cantidad    int NOT NULL DEFAULT 1,
    imagen_url  text,
    orden       int NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_prizes_event ON event_prizes(event_id);

-- 3) Tabla de ganadores (sin reposición)
CREATE TABLE IF NOT EXISTS event_prize_winners (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id         uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    prize_id         uuid NOT NULL REFERENCES event_prizes(id) ON DELETE CASCADE,
    participant_id   uuid NOT NULL REFERENCES event_participants(id) ON DELETE CASCADE,
    participant_name text NOT NULL,
    won_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_prize_winners_event ON event_prize_winners(event_id);
CREATE UNIQUE INDEX idx_event_prize_winners_unique_participant
    ON event_prize_winners(event_id, participant_id);

-- 4) Deshabilitar RLS (consistente con el resto del módulo de eventos)
ALTER TABLE event_prizes DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_prize_winners DISABLE ROW LEVEL SECURITY;

-- 5) Sidebar config para el rol ruleta (solo eventos visible)
INSERT INTO sidebar_config (menu_key, menu_label, rol, visible)
VALUES
    ('eventos', 'Eventos', 'ruleta', true),
    ('configuracion', 'Configuración', 'ruleta', true)
ON CONFLICT (menu_key, rol) DO NOTHING;
