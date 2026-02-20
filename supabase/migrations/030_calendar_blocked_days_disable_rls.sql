-- =====================================================
-- Deshabilitar RLS en calendar_blocked_days
-- =====================================================
-- El proyecto usa autenticación desde users_profile, no Supabase Auth.
-- Por tanto auth.uid() es NULL y las políticas RLS bloquean a todos.
-- La verificación de permisos (solo supervisores) se hace en la app.
-- =====================================================

ALTER TABLE calendar_blocked_days DISABLE ROW LEVEL SECURITY;
