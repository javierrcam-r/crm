-- =====================================================
-- MIGRACIÓN: Agregar rol supervisor_tecnico
-- =====================================================
-- Combina permisos de supervisor + capacidades técnicas

ALTER TABLE users_profile DROP CONSTRAINT IF EXISTS users_profile_rol_check;
ALTER TABLE users_profile ADD CONSTRAINT users_profile_rol_check
  CHECK (rol IN (
    'admin',
    'vendedor',
    'supervisor',
    'supervisor_nivel1',
    'supervisor_vendedor',
    'supervisor_tecnico',
    'vendedor_tecnico',
    'marketing',
    'tecnico',
    'event_assistant',
    'ruleta'
  ));
