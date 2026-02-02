-- =====================================================
-- MIGRACIÓN: API Simulación
-- =====================================================
-- Permite crear APIs mock con datos simulados
-- =====================================================

CREATE TABLE IF NOT EXISTS api_simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Usuario que crea la simulación
    created_by_user_id UUID NOT NULL,
    
    -- Información de la API
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    slug VARCHAR(100) NOT NULL UNIQUE, -- para la URL: /api/mock/{slug}
    
    -- Estructura de la respuesta (JSON Schema simplificado)
    response_schema JSONB NOT NULL,
    
    -- Datos generados/guardados
    mock_data JSONB,
    
    -- Configuración
    activo BOOLEAN DEFAULT TRUE,
    delay_ms INTEGER DEFAULT 0, -- Simular latencia
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_api_simulations_slug ON api_simulations(slug);
CREATE INDEX idx_api_simulations_created_by ON api_simulations(created_by_user_id);
CREATE INDEX idx_api_simulations_activo ON api_simulations(activo);

-- Deshabilitar RLS para desarrollo
ALTER TABLE api_simulations DISABLE ROW LEVEL SECURITY;
