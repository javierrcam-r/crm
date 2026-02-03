-- =====================================================
-- MIGRACIÓN: Nuevos Roles del Sistema
-- =====================================================
-- Agrega los roles: supervisor_vendedor, marketing, tecnico
-- =====================================================

-- Eliminar la restricción existente
ALTER TABLE users_profile DROP CONSTRAINT IF EXISTS users_profile_rol_check;

-- Crear nueva restricción con todos los roles
ALTER TABLE users_profile ADD CONSTRAINT users_profile_rol_check 
    CHECK (rol IN (
        'admin', 
        'vendedor', 
        'supervisor', 
        'supervisor_nivel1',
        'supervisor_vendedor',
        'marketing', 
        'tecnico'
    ));

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Migración completada: Nuevos roles agregados (supervisor_vendedor, marketing, tecnico)';
END $$;
