-- =====================================================
-- MIGRACIÓN: Supervisor Nivel 1 - Reuniones y Actividades
-- =====================================================
-- Agrega el rol supervisor_nivel1 y las tablas necesarias
-- para gestionar reuniones y actividades con el personal
-- =====================================================

-- Actualizar el CHECK constraint para incluir el nuevo rol
ALTER TABLE users_profile DROP CONSTRAINT IF EXISTS users_profile_rol_check;
ALTER TABLE users_profile ADD CONSTRAINT users_profile_rol_check 
    CHECK (rol IN ('admin', 'vendedor', 'supervisor', 'supervisor_nivel1'));

-- =====================================================
-- TABLA: activities (Actividades y Reuniones)
-- =====================================================
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Usuario que crea la actividad (supervisor nivel 1)
    created_by_user_id UUID NOT NULL,
    
    -- Información de la actividad
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL DEFAULT 'reunion' CHECK (tipo IN ('reunion', 'tarea', 'seguimiento', 'capacitacion', 'otro')),
    
    -- Estado de la actividad (Kanban)
    estado VARCHAR(50) NOT NULL DEFAULT 'planificacion' CHECK (estado IN ('planificacion', 'haciendo', 'realizado', 'cancelado')),
    
    -- Prioridad
    prioridad VARCHAR(20) DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
    
    -- Fechas
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ,
    fecha_limite TIMESTAMPTZ,
    
    -- Ubicación (opcional)
    ubicacion VARCHAR(255),
    es_virtual BOOLEAN DEFAULT FALSE,
    enlace_reunion VARCHAR(500),
    
    -- Notas y resultado
    notas TEXT,
    resultado TEXT,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: activity_participants (Participantes de actividades)
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    user_profile_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
    
    -- Estado de confirmación
    estado_confirmacion VARCHAR(50) DEFAULT 'pendiente' CHECK (estado_confirmacion IN ('pendiente', 'confirmado', 'rechazado', 'tentativo')),
    
    -- Notas del participante
    notas TEXT,
    
    -- Si asistió o no
    asistio BOOLEAN,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Un usuario solo puede estar una vez por actividad
    UNIQUE(activity_id, user_profile_id)
);

-- =====================================================
-- TABLA: activity_comments (Comentarios en actividades)
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    user_profile_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
    
    comentario TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX idx_activities_created_by ON activities(created_by_user_id);
CREATE INDEX idx_activities_estado ON activities(estado);
CREATE INDEX idx_activities_tipo ON activities(tipo);
CREATE INDEX idx_activities_fecha_inicio ON activities(fecha_inicio);
CREATE INDEX idx_activities_fecha_limite ON activities(fecha_limite);

CREATE INDEX idx_activity_participants_activity ON activity_participants(activity_id);
CREATE INDEX idx_activity_participants_user ON activity_participants(user_profile_id);

CREATE INDEX idx_activity_comments_activity ON activity_comments(activity_id);

-- =====================================================
-- TRIGGERS para updated_at
-- =====================================================
CREATE TRIGGER update_activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activity_participants_updated_at
    BEFORE UPDATE ON activity_participants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activity_comments_updated_at
    BEFORE UPDATE ON activity_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DESHABILITAR RLS para desarrollo
-- =====================================================
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_comments DISABLE ROW LEVEL SECURITY;
