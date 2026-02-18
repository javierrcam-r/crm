-- =====================================================
-- MIGRACIÓN 028: Preferencia de tema por usuario
-- =====================================================
-- Añade el campo theme_preference a la tabla users_profile
-- para permitir a cada usuario elegir su tema preferido:
-- 'light', 'dark' o 'auto' (sigue la configuración del sistema)
-- =====================================================

-- Añadir columna theme_preference con valor por defecto 'auto'
ALTER TABLE users_profile
ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'auto'
CHECK (theme_preference IN ('light', 'dark', 'auto'));

-- Actualizar usuarios existentes con el valor por defecto
UPDATE users_profile
SET theme_preference = 'auto'
WHERE theme_preference IS NULL;

-- Comentario descriptivo
COMMENT ON COLUMN users_profile.theme_preference IS 'Preferencia de tema del usuario: light (claro), dark (oscuro), auto (sigue la configuración del sistema)';
